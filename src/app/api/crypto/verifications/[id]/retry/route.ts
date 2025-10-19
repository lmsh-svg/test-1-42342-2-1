import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { incomingVerifications, cryptoWalletAddresses } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Validate ID is a valid positive integer
    const verificationId = parseInt(id);
    if (!id || isNaN(verificationId) || verificationId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Valid positive integer ID is required',
          code: 'INVALID_ID',
        },
        { status: 400 }
      );
    }

    // Fetch the verification record
    const verification = await db
      .select()
      .from(incomingVerifications)
      .where(eq(incomingVerifications.id, verificationId))
      .limit(1);

    if (verification.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Verification record not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const record = verification[0];

    // Check if already credited
    if (record.credited) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot retry already credited transaction',
          code: 'ALREADY_CREDITED',
        },
        { status: 400 }
      );
    }

    const { txid, currency } = record;

    // Fetch crypto wallet address for the currency
    const walletAddresses = await db
      .select()
      .from(cryptoWalletAddresses)
      .where(
        and(
          eq(cryptoWalletAddresses.cryptocurrency, currency),
          eq(cryptoWalletAddresses.isActive, true)
        )
      )
      .limit(1);

    if (walletAddresses.length === 0) {
      const errorMessage = `No active wallet address found for currency: ${currency}`;
      
      // Update verification record with error
      const updated = await db
        .update(incomingVerifications)
        .set({
          retryCount: record.retryCount + 1,
          errorMessage,
          lastChecked: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(incomingVerifications.id, verificationId))
        .returning();

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: 'NO_WALLET_ADDRESS',
          verification: updated[0],
        },
        { status: 400 }
      );
    }

    const ourAddress = walletAddresses[0].address;

    // Call mempool.space API to verify transaction
    let mempoolApiUrl: string;
    if (currency.toUpperCase() === 'BTC') {
      mempoolApiUrl = `https://mempool.space/api/tx/${txid}`;
    } else {
      const errorMessage = `Unsupported currency for verification: ${currency}`;
      
      const updated = await db
        .update(incomingVerifications)
        .set({
          retryCount: record.retryCount + 1,
          errorMessage,
          lastChecked: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(incomingVerifications.id, verificationId))
        .returning();

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: 'UNSUPPORTED_CURRENCY',
          verification: updated[0],
        },
        { status: 400 }
      );
    }

    let txData: any;
    try {
      const response = await fetch(mempoolApiUrl);
      if (!response.ok) {
        throw new Error(`Mempool API returned status ${response.status}`);
      }
      txData = await response.json();
    } catch (apiError: any) {
      const errorMessage = `Failed to fetch transaction from mempool.space: ${apiError.message}`;
      
      const updated = await db
        .update(incomingVerifications)
        .set({
          retryCount: record.retryCount + 1,
          errorMessage,
          lastChecked: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(incomingVerifications.id, verificationId))
        .returning();

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: 'API_ERROR',
          verification: updated[0],
        },
        { status: 400 }
      );
    }

    // Find matching output for our address
    const matchingOutput = txData.vout?.find((output: any) => 
      output.scriptpubkey_address === ourAddress
    );

    if (!matchingOutput) {
      const errorMessage = `No output found for address ${ourAddress} in transaction ${txid}`;
      
      const updated = await db
        .update(incomingVerifications)
        .set({
          retryCount: record.retryCount + 1,
          errorMessage,
          lastChecked: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          meta: JSON.stringify(txData),
        })
        .where(eq(incomingVerifications.id, verificationId))
        .returning();

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: 'NO_MATCHING_OUTPUT',
          verification: updated[0],
        },
        { status: 400 }
      );
    }

    // Calculate amount
    const amountSats = matchingOutput.value;
    const amountFloat = amountSats / 100000000;

    // Calculate confirmations
    let confirmations = 0;
    if (txData.status?.confirmed) {
      try {
        const tipHeightResponse = await fetch('https://mempool.space/api/blocks/tip/height');
        const tipHeight = await tipHeightResponse.json();
        confirmations = tipHeight - txData.status.block_height + 1;
      } catch (error) {
        console.error('Error fetching tip height:', error);
        confirmations = 0;
      }
    }

    // Determine if confirmed (>= 2 confirmations for BTC)
    const isConfirmed = confirmations >= 2;
    const now = new Date().toISOString();

    // Update the verification record
    const updateData: any = {
      retryCount: record.retryCount + 1,
      amountSats,
      amountFloat,
      confirmed: isConfirmed,
      lastChecked: now,
      updatedAt: now,
      errorMessage: null, // Clear error on successful verification
      meta: JSON.stringify({
        ...txData,
        confirmations,
        verifiedAt: now,
      }),
    };

    // Set confirmedAt if now confirmed and wasn't before
    if (isConfirmed && !record.confirmed) {
      updateData.confirmedAt = now;
    }

    const updated = await db
      .update(incomingVerifications)
      .set(updateData)
      .where(eq(incomingVerifications.id, verificationId))
      .returning();

    const message = isConfirmed
      ? `Transaction verified successfully with ${confirmations} confirmations`
      : `Transaction found but needs more confirmations (${confirmations}/2)`;

    return NextResponse.json(
      {
        success: true,
        verification: updated[0],
        message,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('POST /api/verifications/[id]/retry error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error: ' + error.message,
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}