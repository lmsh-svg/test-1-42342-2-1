import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { cryptoWalletAddresses, incomingVerifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Server-side WebSocket monitoring service
 * This endpoint manages the WebSocket connection to mempool.space
 * and tracks all configured Bitcoin addresses in real-time
 */

// In-memory store for WebSocket connection (in production, use Redis or similar)
let wsConnection: WebSocket | null = null;
let trackedAddresses = new Set<string>();
let reconnectTimer: NodeJS.Timeout | null = null;

/**
 * Initialize and start WebSocket monitoring
 */
export async function POST(request: NextRequest) {
  try {
    // Get all active Bitcoin addresses
    const btcAddresses = await db.select()
      .from(cryptoWalletAddresses)
      .where(and(
        eq(cryptoWalletAddresses.cryptocurrency, 'BTC'),
        eq(cryptoWalletAddresses.isActive, true)
      ));

    if (btcAddresses.length === 0) {
      return NextResponse.json({
        error: 'No active Bitcoin addresses configured',
        code: 'NO_ADDRESSES'
      }, { status: 400 });
    }

    const addresses = btcAddresses.map(addr => addr.address);

    // Close existing connection if any
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      wsConnection.close();
    }

    // Create new WebSocket connection
    wsConnection = new WebSocket('wss://mempool.space/api/v1/ws');

    wsConnection.onopen = () => {
      console.log('✅ WebSocket connected to mempool.space');
      
      // Track all addresses
      wsConnection!.send(JSON.stringify({
        'track-addresses': addresses
      }));
      
      trackedAddresses = new Set(addresses);
      console.log(`📡 Now tracking ${addresses.length} Bitcoin addresses`);
    };

    wsConnection.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle multi-address transaction updates
        if (data['multi-address-transactions']) {
          for (const [address, txData] of Object.entries(data['multi-address-transactions'])) {
            const { mempool, confirmed } = txData as any;
            
            // Process confirmed transactions
            for (const tx of confirmed || []) {
              await processTransaction(tx, address, true);
            }
            
            // Process mempool (unconfirmed) transactions
            for (const tx of mempool || []) {
              await processTransaction(tx, address, false);
            }
          }
        }

        // Handle single address transaction updates
        if (data['address-transactions']) {
          for (const [address, txData] of Object.entries(data['address-transactions'])) {
            const { mempool, confirmed } = txData as any;
            
            for (const tx of confirmed || []) {
              await processTransaction(tx, address, true);
            }
            
            for (const tx of mempool || []) {
              await processTransaction(tx, address, false);
            }
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    wsConnection.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    wsConnection.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      // Auto-reconnect after 5 seconds
      reconnectTimer = setTimeout(() => {
        console.log('🔄 Attempting to reconnect...');
        POST(request).catch(console.error);
      }, 5000);
    };

    return NextResponse.json({
      success: true,
      message: 'WebSocket monitoring started',
      trackingAddresses: addresses,
      count: addresses.length
    });

  } catch (error) {
    console.error('WebSocket monitor error:', error);
    return NextResponse.json({
      error: 'Failed to start WebSocket monitoring',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get WebSocket monitoring status
 */
export async function GET(request: NextRequest) {
  const status = wsConnection?.readyState;
  const statusText = 
    status === WebSocket.CONNECTING ? 'connecting' :
    status === WebSocket.OPEN ? 'connected' :
    status === WebSocket.CLOSING ? 'closing' :
    status === WebSocket.CLOSED ? 'closed' :
    'not_initialized';

  return NextResponse.json({
    status: statusText,
    trackedAddresses: Array.from(trackedAddresses),
    count: trackedAddresses.size
  });
}

/**
 * Stop WebSocket monitoring
 */
export async function DELETE(request: NextRequest) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }

  trackedAddresses.clear();

  return NextResponse.json({
    success: true,
    message: 'WebSocket monitoring stopped'
  });
}

/**
 * Process incoming transaction and save to database
 */
async function processTransaction(tx: any, address: string, confirmed: boolean) {
  try {
    // Find matching output for this address
    const matchingOutput = tx.vout.find((output: any) => 
      output.scriptpubkey_address === address
    );

    if (!matchingOutput) {
      return; // Transaction doesn't involve this address as recipient
    }

    const amountSats = matchingOutput.value;
    const amountFloat = amountSats / 100000000;
    const now = new Date().toISOString();

    // Check if transaction already exists
    const existing = await db.select()
      .from(incomingVerifications)
      .where(and(
        eq(incomingVerifications.txid, tx.txid),
        eq(incomingVerifications.currency, 'BTC')
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      await db.update(incomingVerifications)
        .set({
          confirmed,
          confirmedAt: confirmed ? now : existing[0].confirmedAt,
          lastChecked: now,
          updatedAt: now,
          meta: JSON.stringify({ 
            ...tx, 
            trackingSource: 'websocket',
            updatedAt: now 
          })
        })
        .where(eq(incomingVerifications.id, existing[0].id));

      console.log(`✅ Updated transaction ${tx.txid.substring(0, 8)}... (${confirmed ? 'confirmed' : 'unconfirmed'})`);
    } else {
      // Create new record
      await db.insert(incomingVerifications)
        .values({
          txid: tx.txid,
          currency: 'BTC',
          matchedAddress: address,
          amountSats,
          amountFloat,
          confirmed,
          confirmedAt: confirmed ? now : null,
          credited: false,
          creditedAt: null,
          firstSeen: now,
          lastChecked: now,
          meta: JSON.stringify({ 
            ...tx, 
            trackingSource: 'websocket',
            createdAt: now 
          }),
          createdAt: now,
          updatedAt: now,
          userId: null,
          retryCount: 0,
          errorMessage: null
        });

      console.log(`🆕 New transaction detected: ${tx.txid.substring(0, 8)}... → ${address} (${amountFloat} BTC)`);
    }
  } catch (error) {
    console.error('Error processing transaction:', error);
  }
}