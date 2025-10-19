import { NextRequest, NextResponse } from 'next/server';

interface MempoolTransaction {
  txid: string;
  status: {
    confirmed: boolean;
    block_height?: number;
  };
  vout: Array<{
    value: number;
    scriptpubkey_address: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, expectedAddress } = body;

    if (!transactionId || typeof transactionId !== 'string') {
      return NextResponse.json({ 
        error: 'transactionId is required',
        code: 'INVALID_TRANSACTION_ID' 
      }, { status: 400 });
    }

    if (!expectedAddress || typeof expectedAddress !== 'string') {
      return NextResponse.json({ 
        error: 'expectedAddress is required',
        code: 'INVALID_ADDRESS' 
      }, { status: 400 });
    }

    const txid = transactionId.trim();
    const normalizedExpectedAddress = expectedAddress.trim();

    console.log('====== TRANSACTION VERIFICATION DEBUG ======');
    console.log('[TEST-TX] Testing transaction:', txid);
    console.log('[TEST-TX] Against expected address:', normalizedExpectedAddress);
    console.log('[TEST-TX] Expected address length:', normalizedExpectedAddress.length);

    // Validate transaction ID format (64 hex characters for Bitcoin)
    if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
      console.log('[TEST-TX] ❌ Invalid transaction ID format');
      return NextResponse.json({ 
        error: 'Transaction ID must be a 64-character hexadecimal string',
        code: 'INVALID_TXID_FORMAT',
        hint: 'Bitcoin transaction IDs are exactly 64 characters long and contain only 0-9 and a-f'
      }, { status: 400 });
    }

    console.log('[TEST-TX] ✓ Transaction ID format is valid');
    console.log('[TEST-TX] Fetching from mempool.space...');

    // Fetch transaction data from mempool.space API
    let txData: MempoolTransaction;
    try {
      const txResponse = await fetch(`https://mempool.space/api/tx/${txid}`, {
        headers: {
          'User-Agent': 'CryptoMarketplace/1.0',
          'Accept': 'application/json'
        }
      });
      
      console.log('[TEST-TX] Mempool API response status:', txResponse.status);
      
      if (!txResponse.ok) {
        if (txResponse.status === 404) {
          console.log('[TEST-TX] ❌ Transaction not found on blockchain');
          return NextResponse.json({ 
            error: 'Transaction not found on the blockchain. Please verify:\n1. The transaction ID is correct\n2. The transaction has been broadcast\n3. Try checking on mempool.space directly',
            code: 'TRANSACTION_NOT_FOUND',
            mempoolUrl: `https://mempool.space/tx/${txid}`
          }, { status: 404 });
        }
        const errorText = await txResponse.text();
        console.log('[TEST-TX] ❌ Mempool API error:', errorText);
        throw new Error(`Mempool API error: ${txResponse.status}`);
      }

      txData = await txResponse.json();
      console.log('[TEST-TX] ✓ Transaction found successfully!');
      console.log('[TEST-TX] Transaction ID:', txData.txid);
      console.log('[TEST-TX] Confirmed:', txData.status.confirmed);
      console.log('[TEST-TX] Number of outputs:', txData.vout.length);
      
      // Log all output addresses for debugging
      console.log('[TEST-TX] All output addresses in this transaction:');
      txData.vout.forEach((output, index) => {
        console.log(`  Output ${index}: ${output.scriptpubkey_address} (${output.value} satoshis = ${(output.value / 100000000).toFixed(8)} BTC)`);
      });
      
    } catch (error) {
      console.error('[TEST-TX] ❌ Fetch error:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch transaction from blockchain. The mempool.space API might be temporarily unavailable.',
        code: 'BLOCKCHAIN_FETCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

    // Normalize and compare addresses
    console.log('[TEST-TX] Starting address matching...');
    console.log('[TEST-TX] Looking for address:', normalizedExpectedAddress);
    
    const matchingOutput = txData.vout.find((output, index) => {
      const outputAddress = output.scriptpubkey_address?.trim();
      if (!outputAddress) {
        console.log(`[TEST-TX] Output ${index}: No address (likely OP_RETURN or other script)`);
        return false;
      }

      // Try multiple comparison methods
      const exactMatch = outputAddress === normalizedExpectedAddress;
      const caseInsensitiveMatch = outputAddress.toLowerCase() === normalizedExpectedAddress.toLowerCase();
      
      console.log(`[TEST-TX] Output ${index} comparison:`);
      console.log(`  Output address:   "${outputAddress}"`);
      console.log(`  Expected address: "${normalizedExpectedAddress}"`);
      console.log(`  Exact match:      ${exactMatch}`);
      console.log(`  Case-insensitive: ${caseInsensitiveMatch}`);
      console.log(`  Value:            ${output.value} satoshis (${(output.value / 100000000).toFixed(8)} BTC)`);
      
      return caseInsensitiveMatch;
    });

    if (!matchingOutput) {
      console.log('[TEST-TX] ❌ NO MATCHING OUTPUT FOUND');
      console.log('[TEST-TX] Expected address:', normalizedExpectedAddress);
      console.log('[TEST-TX] All addresses in transaction:');
      txData.vout.forEach((v, i) => {
        console.log(`  ${i}: ${v.scriptpubkey_address || '(no address)'}`);
      });
      
      return NextResponse.json({ 
        error: `Transaction was not sent to address ${normalizedExpectedAddress}`,
        code: 'NO_MATCHING_OUTPUT',
        expectedAddress: normalizedExpectedAddress,
        actualAddresses: txData.vout.map(v => v.scriptpubkey_address).filter(Boolean),
        hint: 'Please verify:\n1. You copied the correct Bitcoin address from your crypto addresses page\n2. The transaction was actually sent to this specific address\n3. Check the transaction on mempool.space to see where the funds were sent',
        mempoolUrl: `https://mempool.space/tx/${txid}`
      }, { status: 400 });
    }

    console.log('[TEST-TX] ✅ MATCH FOUND!');
    console.log('[TEST-TX] Matched address:', matchingOutput.scriptpubkey_address);
    console.log('[TEST-TX] Amount (satoshis):', matchingOutput.value);

    // Convert satoshis to BTC
    const sentAmountBTC = matchingOutput.value / 100000000;
    console.log('[TEST-TX] Amount (BTC):', sentAmountBTC);

    // Calculate confirmations
    let confirmations = 0;
    
    if (txData.status.confirmed && txData.status.block_height) {
      try {
        const tipResponse = await fetch('https://mempool.space/api/blocks/tip/height');
        if (tipResponse.ok) {
          const currentHeight = await tipResponse.json();
          confirmations = currentHeight - txData.status.block_height + 1;
          console.log('[TEST-TX] Current block height:', currentHeight);
          console.log('[TEST-TX] Transaction block height:', txData.status.block_height);
          console.log('[TEST-TX] Confirmations:', confirmations);
        }
      } catch (error) {
        console.error('[TEST-TX] Failed to fetch current block height:', error);
        confirmations = txData.status.confirmed ? 1 : 0;
      }
    } else {
      console.log('[TEST-TX] Transaction not yet confirmed (0 confirmations)');
    }

    console.log('[TEST-TX] ✅ VERIFICATION SUCCESSFUL');
    console.log('[TEST-TX] Summary:');
    console.log(`  - Transaction ID: ${txData.txid}`);
    console.log(`  - Matched Address: ${matchingOutput.scriptpubkey_address}`);
    console.log(`  - Amount: ${sentAmountBTC} BTC`);
    console.log(`  - Confirmations: ${confirmations}`);
    console.log(`  - Confirmed: ${txData.status.confirmed}`);
    console.log('==========================================');

    return NextResponse.json({ 
      success: true,
      amount: sentAmountBTC,
      confirmations,
      address: normalizedExpectedAddress,
      matchedAddress: matchingOutput.scriptpubkey_address,
      txid: txData.txid,
      isConfirmed: txData.status.confirmed,
      mempoolUrl: `https://mempool.space/tx/${txid}`
    }, { status: 200 });

  } catch (error) {
    console.error('[TEST-TX] ❌ INTERNAL ERROR:', error);
    console.log('==========================================');
    return NextResponse.json({ 
      error: 'Internal server error while verifying transaction',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}