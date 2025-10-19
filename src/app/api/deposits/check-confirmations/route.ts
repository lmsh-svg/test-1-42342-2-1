import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { deposits, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const depositIdParam = searchParams.get('depositId');

    // Validate depositId is provided
    if (!depositIdParam) {
      return NextResponse.json({
        error: 'depositId is required',
        code: 'MISSING_DEPOSIT_ID'
      }, { status: 400 });
    }

    // Validate depositId is a valid positive integer
    const depositId = parseInt(depositIdParam);
    if (isNaN(depositId) || depositId <= 0) {
      return NextResponse.json({
        error: 'depositId must be a valid positive integer',
        code: 'INVALID_DEPOSIT_ID'
      }, { status: 400 });
    }

    // Fetch the deposit from database
    const depositRecords = await db.select()
      .from(deposits)
      .where(eq(deposits.id, depositId))
      .limit(1);

    if (depositRecords.length === 0) {
      return NextResponse.json({
        error: 'Deposit not found',
        code: 'DEPOSIT_NOT_FOUND'
      }, { status: 404 });
    }

    const deposit = depositRecords[0];

    // Verify the deposit has a transactionId
    if (!deposit.transactionId) {
      return NextResponse.json({
        error: 'Deposit does not have a transaction ID',
        code: 'MISSING_TRANSACTION_ID'
      }, { status: 400 });
    }

    // Only check deposits in 'pending' status
    if (deposit.status !== 'pending') {
      return NextResponse.json({
        error: `Deposit is not in pending status (current status: ${deposit.status})`,
        code: 'INVALID_STATUS'
      }, { status: 400 });
    }

    // Fetch transaction data from mempool.space API
    const txResponse = await fetch(`https://mempool.space/api/tx/${deposit.transactionId}`);
    
    if (!txResponse.ok) {
      if (txResponse.status === 404) {
        return NextResponse.json({
          error: 'Transaction not found on blockchain',
          code: 'TRANSACTION_NOT_FOUND'
        }, { status: 400 });
      }
      throw new Error(`Mempool.space API error: ${txResponse.status} ${txResponse.statusText}`);
    }

    const txData = await txResponse.json();

    // Calculate confirmations
    let confirmations = 0;
    
    if (txData.status.confirmed === false) {
      confirmations = 0;
    } else if (txData.status.confirmed === true && txData.status.block_height) {
      // Fetch current block height
      const tipHeightResponse = await fetch('https://mempool.space/api/blocks/tip/height');
      
      if (!tipHeightResponse.ok) {
        throw new Error(`Failed to fetch current block height: ${tipHeightResponse.status}`);
      }
      
      const currentHeight = await tipHeightResponse.json();
      confirmations = currentHeight - txData.status.block_height + 1;
    }

    // Update deposit confirmations
    const now = new Date().toISOString();

    // Check if we should approve the deposit (2+ confirmations)
    if (confirmations >= 2) {
      // Extract sent amount from matching vout
      let sentAmountSatoshis = 0;
      for (const vout of txData.vout) {
        if (vout.scriptpubkey_address === deposit.walletAddress) {
          sentAmountSatoshis += vout.value;
        }
      }

      // Convert satoshis to BTC
      const sentAmountBTC = sentAmountSatoshis / 100000000;

      // Fetch user to update credits
      const userRecords = await db.select()
        .from(users)
        .where(eq(users.id, deposit.userId))
        .limit(1);

      if (userRecords.length === 0) {
        throw new Error('User not found for deposit');
      }

      const user = userRecords[0];
      const newCredits = (user.credits || 0) + sentAmountBTC;

      // Update user credits
      await db.update(users)
        .set({
          credits: newCredits
        })
        .where(eq(users.id, deposit.userId));

      // Update deposit to completed
      const updatedDeposit = await db.update(deposits)
        .set({
          confirmations,
          status: 'completed',
          verifiedAt: now,
          verificationError: null,
          updatedAt: now
        })
        .where(eq(deposits.id, depositId))
        .returning();

      return NextResponse.json({
        depositId: updatedDeposit[0].id,
        transactionId: updatedDeposit[0].transactionId,
        confirmations,
        status: 'completed',
        message: 'Transaction verified and deposit approved'
      }, { status: 200 });

    } else {
      // Still pending, update confirmations and error message
      const updatedDeposit = await db.update(deposits)
        .set({
          confirmations,
          verificationError: `Waiting for confirmations (${confirmations}/2)`,
          updatedAt: now
        })
        .where(eq(deposits.id, depositId))
        .returning();

      return NextResponse.json({
        depositId: updatedDeposit[0].id,
        transactionId: updatedDeposit[0].transactionId,
        confirmations,
        status: 'pending',
        message: `Waiting for confirmations (${confirmations}/2)`
      }, { status: 200 });
    }

  } catch (error) {
    console.error('GET deposit confirmation check error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error,
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}