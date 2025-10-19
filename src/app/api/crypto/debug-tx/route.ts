import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to show full transaction details
 * This helps identify why a transaction might not be matching your addresses
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txid } = body;

    if (!txid) {
      return NextResponse.json({
        error: 'Transaction ID (txid) is required'
      }, { status: 400 });
    }

    // Validate Bitcoin TXID format
    const txidRegex = /^[a-fA-F0-9]{64}$/;
    if (!txidRegex.test(txid)) {
      return NextResponse.json({
        error: 'Invalid Bitcoin transaction ID format. Must be 64 hexadecimal characters'
      }, { status: 400 });
    }

    // Fetch transaction from mempool.space
    const response = await fetch(`https://mempool.space/api/tx/${txid}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({
          error: 'Transaction not found on the Bitcoin blockchain',
          txid,
          note: 'This transaction does not exist or has not been broadcast yet'
        }, { status: 404 });
      }
      
      return NextResponse.json({
        error: `Blockchain API error: ${response.status} ${response.statusText}`
      }, { status: response.status });
    }

    const txData = await response.json();

    // Extract all output addresses and amounts
    const outputs = txData.vout.map((output: any) => ({
      address: output.scriptpubkey_address || 'N/A',
      amountBTC: output.value / 100000000,
      amountSats: output.value,
      scriptType: output.scriptpubkey_type
    }));

    // Calculate confirmations
    let confirmations = 0;
    if (txData.status.confirmed && txData.status.block_height) {
      try {
        const heightResponse = await fetch('https://mempool.space/api/blocks/tip/height');
        if (heightResponse.ok) {
          const currentHeight = await heightResponse.json();
          confirmations = currentHeight - txData.status.block_height + 1;
        }
      } catch (error) {
        console.error('Error fetching block height:', error);
      }
    }

    return NextResponse.json({
      success: true,
      txid: txData.txid,
      status: {
        confirmed: txData.status.confirmed,
        confirmations,
        blockHeight: txData.status.block_height,
        blockHash: txData.status.block_hash,
        blockTime: txData.status.block_time
      },
      outputs,
      totalOutputs: outputs.length,
      fee: txData.fee / 100000000,
      size: txData.size,
      weight: txData.weight,
      note: 'Check if any of the output addresses match your configured wallet addresses'
    }, { status: 200 });

  } catch (error) {
    console.error('Debug TX error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}