import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { cryptoWalletAddresses, incomingVerifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Real-time address tracking endpoint
 * This endpoint should be called by a WebSocket service to track configured addresses
 */
export async function GET(request: NextRequest) {
  try {
    // Get all active Bitcoin addresses from database
    const btcAddresses = await db.select()
      .from(cryptoWalletAddresses)
      .where(and(
        eq(cryptoWalletAddresses.cryptocurrency, 'BTC'),
        eq(cryptoWalletAddresses.isActive, true)
      ));

    const addresses = btcAddresses.map(addr => addr.address);

    return NextResponse.json({
      success: true,
      addresses,
      count: addresses.length,
      note: 'These addresses are being tracked for incoming Bitcoin transactions'
    });

  } catch (error) {
    console.error('Track addresses error:', error);
    return NextResponse.json({
      error: 'Failed to fetch tracked addresses'
    }, { status: 500 });
  }
}

/**
 * Process incoming transaction from WebSocket
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txid, address, amount, confirmed, blockHeight } = body;

    if (!txid || !address || amount === undefined) {
      return NextResponse.json({
        error: 'Missing required fields: txid, address, amount'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Check if this transaction already exists
    const existing = await db.select()
      .from(incomingVerifications)
      .where(and(
        eq(incomingVerifications.txid, txid),
        eq(incomingVerifications.currency, 'BTC')
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      const updated = await db.update(incomingVerifications)
        .set({
          confirmed: confirmed || false,
          confirmedAt: confirmed ? now : existing[0].confirmedAt,
          lastChecked: now,
          updatedAt: now,
          meta: JSON.stringify({ blockHeight, trackingSource: 'websocket', updatedAt: now })
        })
        .where(eq(incomingVerifications.id, existing[0].id))
        .returning();

      return NextResponse.json({
        success: true,
        action: 'updated',
        verification: updated[0]
      });
    } else {
      // Create new record
      const amountFloat = typeof amount === 'number' ? amount : parseFloat(amount);
      const amountSats = Math.floor(amountFloat * 100000000);

      const newVerification = await db.insert(incomingVerifications)
        .values({
          txid,
          currency: 'BTC',
          matchedAddress: address,
          amountSats,
          amountFloat,
          confirmed: confirmed || false,
          confirmedAt: confirmed ? now : null,
          credited: false,
          creditedAt: null,
          firstSeen: now,
          lastChecked: now,
          meta: JSON.stringify({ blockHeight, trackingSource: 'websocket', createdAt: now }),
          createdAt: now,
          updatedAt: now,
          userId: null,
          retryCount: 0,
          errorMessage: null
        })
        .returning();

      return NextResponse.json({
        success: true,
        action: 'created',
        verification: newVerification[0]
      }, { status: 201 });
    }

  } catch (error) {
    console.error('Track addresses POST error:', error);
    return NextResponse.json({
      error: 'Failed to process transaction'
    }, { status: 500 });
  }
}