import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { deposits, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

interface MempoolTransaction {
  txid: string;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_time?: number;
  };
  vout: Array<{
    value: number;
    scriptpubkey_address: string;
  }>;
}

interface MempoolBlock {
  id: string;
  timestamp: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { depositId, transactionId } = body;

    console.log('[DEPOSIT DEBUG] Starting verification - depositId:', depositId, 'transactionId:', transactionId);

    // Validation: depositId
    if (!depositId || typeof depositId !== 'number' || depositId <= 0 || !Number.isInteger(depositId)) {
      return NextResponse.json({ 
        error: 'Valid depositId is required (positive integer)',
        code: 'INVALID_DEPOSIT_ID' 
      }, { status: 400 });
    }

    // Validation: transactionId
    if (!transactionId || typeof transactionId !== 'string' || transactionId.trim() === '') {
      return NextResponse.json({ 
        error: 'transactionId is required and must be a non-empty string',
        code: 'INVALID_TRANSACTION_ID' 
      }, { status: 400 });
    }

    const txid = transactionId.trim();

    // Validate Bitcoin transaction ID format
    const txidRegex = /^[a-fA-F0-9]{64}$/;
    if (!txidRegex.test(txid)) {
      return NextResponse.json({ 
        error: 'Invalid transaction ID format. Must be 64 hexadecimal characters (0-9, a-f)',
        code: 'INVALID_TXID_FORMAT' 
      }, { status: 400 });
    }

    const normalizedTxid = txid.toLowerCase();

    // CRITICAL: Check if this transaction ID has already been used by any completed deposit
    console.log('[DEPOSIT DEBUG] Checking for existing completed deposits with txid:', normalizedTxid);
    const existingCompletedDeposits = await db.select()
      .from(deposits)
      .where(
        and(
          eq(deposits.transactionId, normalizedTxid),
          eq(deposits.status, 'completed')
        )
      )
      .limit(1);

    if (existingCompletedDeposits.length > 0) {
      const existingDeposit = existingCompletedDeposits[0];
      console.log('[DEPOSIT DEBUG] ❌ Transaction ID already used! Existing deposit:', existingDeposit.id);
      return NextResponse.json({ 
        success: false,
        error: 'This transaction ID has already been verified and credited. Each transaction can only be used once.',
        code: 'TRANSACTION_ALREADY_USED',
        existingDepositId: existingDeposit.id,
        existingDepositDate: existingDeposit.createdAt
      }, { status: 400 });
    }

    console.log('[DEPOSIT DEBUG] ✅ Transaction ID is unique, proceeding with verification');

    // Fetch deposit from database
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
    console.log('[DEPOSIT DEBUG] Found deposit:', deposit);

    // Verify deposit is in 'pending' status
    if (deposit.status !== 'pending') {
      return NextResponse.json({ 
        error: `Cannot verify deposit with status '${deposit.status}'. Only pending deposits can be verified.`,
        code: 'INVALID_DEPOSIT_STATUS' 
      }, { status: 400 });
    }

    // Fetch transaction data from mempool.space API
    let txData: MempoolTransaction;
    try {
      const txResponse = await fetch(`https://mempool.space/api/tx/${normalizedTxid}`);
      
      if (!txResponse.ok) {
        if (txResponse.status === 404) {
          await db.update(deposits)
            .set({
              transactionId: normalizedTxid,
              verificationError: 'Transaction not found on blockchain',
              updatedAt: new Date().toISOString()
            })
            .where(eq(deposits.id, depositId));

          return NextResponse.json({ 
            success: false,
            confirmations: 0,
            amount: 0,
            error: 'Transaction not found on blockchain',
            code: 'TRANSACTION_NOT_FOUND' 
          }, { status: 400 });
        }
        throw new Error(`Mempool API error: ${txResponse.status}`);
      }

      txData = await txResponse.json();
      console.log('[DEPOSIT DEBUG] Transaction data:', txData);
    } catch (error) {
      console.error('[DEPOSIT DEBUG] Mempool API fetch error:', error);
      
      await db.update(deposits)
        .set({
          transactionId: normalizedTxid,
          verificationError: 'Failed to fetch transaction from blockchain',
          updatedAt: new Date().toISOString()
        })
        .where(eq(deposits.id, depositId));

      return NextResponse.json({ 
        success: false,
        confirmations: 0,
        amount: 0,
        error: 'Failed to fetch transaction from blockchain',
        code: 'BLOCKCHAIN_FETCH_ERROR' 
      }, { status: 500 });
    }

    // Find matching output for wallet address
    const matchingOutput = txData.vout.find(
      output => output.scriptpubkey_address === deposit.walletAddress
    );

    if (!matchingOutput) {
      await db.update(deposits)
        .set({
          transactionId: normalizedTxid,
          verificationError: `No output found for wallet address ${deposit.walletAddress}`,
          updatedAt: new Date().toISOString()
        })
        .where(eq(deposits.id, depositId));

      return NextResponse.json({ 
        success: false,
        confirmations: 0,
        amount: 0,
        error: `No output found for wallet address ${deposit.walletAddress}`,
        code: 'NO_MATCHING_OUTPUT' 
      }, { status: 400 });
    }

    // Convert satoshis to BTC
    const sentAmountBTC = matchingOutput.value / 100000000;
    console.log('[DEPOSIT DEBUG] Sent amount:', sentAmountBTC, 'BTC');

    // Calculate confirmations
    let confirmations = 0;
    
    if (txData.status.confirmed && txData.status.block_height) {
      try {
        const tipResponse = await fetch('https://mempool.space/api/blocks/tip/height');
        if (tipResponse.ok) {
          const currentHeight = await tipResponse.json();
          confirmations = currentHeight - txData.status.block_height + 1;
          console.log('[DEPOSIT DEBUG] Confirmations:', confirmations);
        }
      } catch (error) {
        console.error('[DEPOSIT DEBUG] Failed to fetch current block height:', error);
        confirmations = 1;
      }
    }

    // Get historical BTC price at transaction time
    let btcPriceUSD = 0;
    let transactionTimestamp = 0;
    
    if (txData.status.confirmed && txData.status.block_height) {
      try {
        // Get block data to retrieve timestamp
        const blockResponse = await fetch(`https://mempool.space/api/block-height/${txData.status.block_height}`);
        if (blockResponse.ok) {
          const blockHash = await blockResponse.text();
          
          // Get block details with timestamp
          const blockDetailsResponse = await fetch(`https://mempool.space/api/block/${blockHash}`);
          if (blockDetailsResponse.ok) {
            const blockData: MempoolBlock = await blockDetailsResponse.json();
            transactionTimestamp = blockData.timestamp;
            console.log('[DEPOSIT DEBUG] Transaction timestamp:', transactionTimestamp, new Date(transactionTimestamp * 1000).toISOString());
            
            // Fetch historical price from CoinGecko (free API, no key required)
            // Convert timestamp to date format DD-MM-YYYY
            const txDate = new Date(transactionTimestamp * 1000);
            const day = String(txDate.getUTCDate()).padStart(2, '0');
            const month = String(txDate.getUTCMonth() + 1).padStart(2, '0');
            const year = txDate.getUTCFullYear();
            const dateStr = `${day}-${month}-${year}`;
            
            console.log('[DEPOSIT DEBUG] Fetching historical price for date:', dateStr);
            
            const priceResponse = await fetch(
              `https://api.coingecko.com/api/v3/coins/bitcoin/history?date=${dateStr}&localization=false`
            );
            
            if (priceResponse.ok) {
              const priceData = await priceResponse.json();
              btcPriceUSD = priceData?.market_data?.current_price?.usd || 0;
              console.log('[DEPOSIT DEBUG] Historical BTC price on', dateStr, ':', btcPriceUSD, 'USD');
            } else {
              console.error('[DEPOSIT DEBUG] Failed to fetch historical price, falling back to current price');
              // Fallback to current price if historical price unavailable
              const currentPriceResponse = await fetch('https://mempool.space/api/v1/prices');
              if (currentPriceResponse.ok) {
                const currentPriceData = await currentPriceResponse.json();
                btcPriceUSD = currentPriceData.USD || 0;
                console.log('[DEPOSIT DEBUG] Using current BTC price as fallback:', btcPriceUSD, 'USD');
              }
            }
          }
        }
      } catch (error) {
        console.error('[DEPOSIT DEBUG] Failed to fetch historical price:', error);
        // Fallback to current price
        try {
          const priceResponse = await fetch('https://mempool.space/api/v1/prices');
          if (priceResponse.ok) {
            const priceData = await priceResponse.json();
            btcPriceUSD = priceData.USD || 0;
            console.log('[DEPOSIT DEBUG] Using current BTC price as fallback:', btcPriceUSD, 'USD');
          }
        } catch (fallbackError) {
          console.error('[DEPOSIT DEBUG] Failed to fetch current price as fallback:', fallbackError);
        }
      }
    } else {
      // Transaction not confirmed yet, use current price
      try {
        const priceResponse = await fetch('https://mempool.space/api/v1/prices');
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          btcPriceUSD = priceData.USD || 0;
          console.log('[DEPOSIT DEBUG] Using current BTC price (unconfirmed tx):', btcPriceUSD, 'USD');
        }
      } catch (error) {
        console.error('[DEPOSIT DEBUG] Failed to fetch current BTC price:', error);
      }
    }
    
    // Convert sent BTC to USD value at transaction time
    const sentAmountUSD = btcPriceUSD > 0 ? sentAmountBTC * btcPriceUSD : 0;
    console.log('[DEPOSIT DEBUG] Sent amount in USD (at transaction time):', sentAmountUSD);
    
    // Credits to add (USD value of BTC sent at transaction time)
    const creditsToAdd = sentAmountUSD > 0 ? sentAmountUSD : sentAmountBTC;
    console.log('[DEPOSIT DEBUG] Credits to add:', creditsToAdd);

    // Process based on confirmations
    if (confirmations >= 2) {
      console.log('[DEPOSIT DEBUG] ✅ Transaction verified! Updating deposit and crediting user...');
      
      // Update deposit status to 'completed'
      await db.update(deposits)
        .set({
          status: 'completed',
          transactionId: normalizedTxid,
          confirmations,
          verifiedAt: new Date().toISOString(),
          verificationError: null,
          credits: creditsToAdd,
          notes: transactionTimestamp > 0 
            ? `Sent ${sentAmountBTC.toFixed(8)} BTC ($${sentAmountUSD.toFixed(2)} USD at $${btcPriceUSD.toFixed(2)}/BTC on ${new Date(transactionTimestamp * 1000).toLocaleString()})`
            : `Sent ${sentAmountBTC.toFixed(8)} BTC ($${sentAmountUSD.toFixed(2)} USD at $${btcPriceUSD.toFixed(2)}/BTC)`,
          updatedAt: new Date().toISOString()
        })
        .where(eq(deposits.id, depositId));

      console.log('[DEPOSIT DEBUG] Deposit updated to completed');

      // Credit user account with the USD value of BTC sent
      console.log('[DEPOSIT DEBUG] Fetching user with ID:', deposit.userId);
      
      const userRecords = await db.select()
        .from(users)
        .where(eq(users.id, deposit.userId))
        .limit(1);

      console.log('[DEPOSIT DEBUG] User query result:', userRecords);

      if (userRecords.length === 0) {
        console.error('[DEPOSIT DEBUG] ❌ USER NOT FOUND! deposit.userId:', deposit.userId);
        return NextResponse.json({ 
          success: false,
          error: 'User not found. Cannot credit account.',
          code: 'USER_NOT_FOUND' 
        }, { status: 500 });
      }

      const user = userRecords[0];
      const currentCredits = user.credits || 0;
      const newCredits = currentCredits + creditsToAdd;
      
      console.log('[DEPOSIT DEBUG] =====================================');
      console.log('[DEPOSIT DEBUG] CREDITING USER ACCOUNT');
      console.log('[DEPOSIT DEBUG] User ID:', deposit.userId);
      console.log('[DEPOSIT DEBUG] Current credits:', currentCredits);
      console.log('[DEPOSIT DEBUG] Adding credits:', creditsToAdd);
      console.log('[DEPOSIT DEBUG] New credits:', newCredits);
      console.log('[DEPOSIT DEBUG] =====================================');
      
      // Update user credits
      const updateResult = await db.update(users)
        .set({
          credits: newCredits
        })
        .where(eq(users.id, deposit.userId))
        .returning();

      console.log('[DEPOSIT DEBUG] User update result:', updateResult);

      if (updateResult.length === 0) {
        console.error('[DEPOSIT DEBUG] ❌ FAILED TO UPDATE USER CREDITS!');
        return NextResponse.json({ 
          success: false,
          error: 'Failed to update user credits',
          code: 'CREDIT_UPDATE_FAILED' 
        }, { status: 500 });
      }

      console.log('[DEPOSIT DEBUG] ✅ SUCCESS! User credits updated from', currentCredits, 'to', newCredits);

      return NextResponse.json({ 
        success: true,
        confirmations,
        amount: sentAmountBTC,
        amountUSD: sentAmountUSD,
        btcPrice: btcPriceUSD,
        creditsAdded: creditsToAdd,
        previousCredits: currentCredits,
        newCredits: newCredits,
        status: 'completed',
        transactionDate: transactionTimestamp > 0 ? new Date(transactionTimestamp * 1000).toISOString() : null,
        message: `Credited $${creditsToAdd.toFixed(2)} USD (${sentAmountBTC.toFixed(8)} BTC at $${btcPriceUSD.toFixed(2)}/BTC${transactionTimestamp > 0 ? ' on ' + new Date(transactionTimestamp * 1000).toLocaleDateString() : ''})`
      }, { status: 200 });

    } else {
      // 0-1 confirmations: update but keep pending
      console.log('[DEPOSIT DEBUG] ⏳ Waiting for confirmations:', confirmations, '/ 2');
      
      await db.update(deposits)
        .set({
          transactionId: normalizedTxid,
          confirmations,
          verificationError: 'Waiting for confirmations',
          notes: btcPriceUSD > 0 
            ? `Detected ${sentAmountBTC.toFixed(8)} BTC ($${sentAmountUSD.toFixed(2)} USD at $${btcPriceUSD.toFixed(2)}/BTC) - waiting for confirmations`
            : `Detected ${sentAmountBTC.toFixed(8)} BTC - waiting for confirmations`,
          updatedAt: new Date().toISOString()
        })
        .where(eq(deposits.id, depositId));

      return NextResponse.json({ 
        success: false,
        confirmations,
        amount: sentAmountBTC,
        amountUSD: sentAmountUSD,
        btcPrice: btcPriceUSD,
        status: 'pending',
        error: 'Waiting for confirmations',
        message: `Detected ${sentAmountBTC.toFixed(8)} BTC ($${sentAmountUSD.toFixed(2)} USD) - ${confirmations}/2 confirmations`
      }, { status: 200 });
    }

  } catch (error) {
    console.error('[DEPOSIT DEBUG] ❌ POST /api/deposits/verify error:', error);
    console.error('[DEPOSIT DEBUG] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({ 
      error: 'Internal server error: ' + error,
      code: 'INTERNAL_ERROR' 
    }, { status: 500 });
  }
}