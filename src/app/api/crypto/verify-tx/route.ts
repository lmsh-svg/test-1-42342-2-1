import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { incomingVerifications, cryptoWalletAddresses } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

interface MempoolTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: Array<{
    txid: string;
    vout: number;
    prevout: {
      scriptpubkey: string;
      scriptpubkey_asm: string;
      scriptpubkey_type: string;
      scriptpubkey_address: string;
      value: number;
    };
    scriptsig: string;
    scriptsig_asm: string;
    witness: string[];
    is_coinbase: boolean;
    sequence: number;
  }>;
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address: string;
    value: number;
  }>;
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

interface SoChainResponse {
  status: string;
  data: {
    txid: string;
    confirmations: number;
    outputs: Array<{
      address: string;
      value: string;
    }>;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txid, currency = 'BTC' } = body;

    // Validate txid is provided
    if (!txid) {
      return NextResponse.json({
        error: 'Transaction ID (txid) is required',
        code: 'MISSING_TXID'
      }, { status: 400 });
    }

    // Normalize currency to uppercase
    const normalizedCurrency = currency.toUpperCase().trim();

    // Validate currency is one of supported types
    const supportedCurrencies = ['BTC', 'ETH', 'DOGE'];
    if (!supportedCurrencies.includes(normalizedCurrency)) {
      return NextResponse.json({
        error: `Currency must be one of: ${supportedCurrencies.join(', ')}`,
        code: 'INVALID_CURRENCY'
      }, { status: 400 });
    }

    // Validate txid format
    if (normalizedCurrency === 'BTC' || normalizedCurrency === 'DOGE') {
      // Bitcoin and Dogecoin: 64 hex characters
      const txidRegex = /^[a-fA-F0-9]{64}$/;
      if (!txidRegex.test(txid)) {
        return NextResponse.json({
          error: 'Invalid transaction ID format. Must be 64 hexadecimal characters',
          code: 'INVALID_TXID_FORMAT'
        }, { status: 400 });
      }
    } else if (normalizedCurrency === 'ETH') {
      // Ethereum: 0x followed by 64 hex characters
      const ethTxidRegex = /^0x[a-fA-F0-9]{64}$/;
      if (!ethTxidRegex.test(txid)) {
        return NextResponse.json({
          error: 'Invalid Ethereum transaction ID format. Must start with 0x followed by 64 hex characters',
          code: 'INVALID_TXID_FORMAT'
        }, { status: 400 });
      }
    }

    // Check if this (txid, currency) already exists
    const existingVerifications = await db.select()
      .from(incomingVerifications)
      .where(and(
        eq(incomingVerifications.txid, txid),
        eq(incomingVerifications.currency, normalizedCurrency)
      ))
      .limit(1);

    const existingVerification = existingVerifications[0];

    // If exists and confirmed, return existing record
    if (existingVerification && existingVerification.confirmed) {
      return NextResponse.json({
        success: true,
        verification: {
          id: existingVerification.id,
          txid: existingVerification.txid,
          currency: existingVerification.currency,
          matchedAddress: existingVerification.matchedAddress,
          amountFloat: existingVerification.amountFloat,
          confirmed: existingVerification.confirmed,
          confirmations: 2,
          firstSeen: existingVerification.firstSeen,
          lastChecked: existingVerification.lastChecked
        },
        message: 'Transaction already verified and confirmed'
      }, { status: 200 });
    }

    // Fetch ALL active wallet addresses for this currency
    const walletAddresses = await db.select()
      .from(cryptoWalletAddresses)
      .where(and(
        eq(cryptoWalletAddresses.cryptocurrency, normalizedCurrency),
        eq(cryptoWalletAddresses.isActive, true)
      ));

    if (walletAddresses.length === 0) {
      return NextResponse.json({
        error: `No active wallet address found for ${normalizedCurrency}`,
        code: 'NO_ACTIVE_WALLET'
      }, { status: 400 });
    }

    // Create array of addresses to check
    const addressesToCheck = walletAddresses.map(w => w.address);

    // Verify transaction based on currency
    let transactionData: any;
    let confirmations = 0;
    let amountSats = 0;
    let amountFloat = 0;
    let matchedAddress: string | null = null;

    if (normalizedCurrency === 'BTC') {
      // Bitcoin verification via mempool.space
      try {
        const txResponse = await fetch(`https://mempool.space/api/tx/${txid}`);
        
        if (!txResponse.ok) {
          if (txResponse.status === 404) {
            return NextResponse.json({
              success: false,
              error: 'Transaction not found on blockchain',
              code: 'TRANSACTION_NOT_FOUND',
              testedAddresses: addressesToCheck.map(addr => `BTC: ${addr}`)
            }, { status: 404 });
          }
          throw new Error(`Mempool API error: ${txResponse.status} ${txResponse.statusText}`);
        }

        transactionData = await txResponse.json() as MempoolTransaction;
      } catch (error) {
        console.error('Mempool API error:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch transaction data from blockchain',
          code: 'BLOCKCHAIN_API_ERROR'
        }, { status: 500 });
      }

      // Find matching output from ANY of our addresses
      for (const address of addressesToCheck) {
        const matchingOutput = transactionData.vout.find(
          (output: any) => output.scriptpubkey_address === address
        );

        if (matchingOutput) {
          matchedAddress = address;
          amountSats = matchingOutput.value;
          amountFloat = amountSats / 100000000;
          break;
        }
      }

      if (!matchedAddress) {
        return NextResponse.json({
          success: false,
          error: 'Transaction was not sent to any of your configured wallet addresses, or the transaction could not be found on the blockchain',
          code: 'ADDRESS_MISMATCH',
          testedAddresses: addressesToCheck.map(addr => `BTC: Transaction was not sent to address ${addr}`)
        }, { status: 400 });
      }

      // Calculate confirmations
      if (transactionData.status.confirmed && transactionData.status.block_height) {
        try {
          const heightResponse = await fetch('https://mempool.space/api/blocks/tip/height');
          
          if (heightResponse.ok) {
            const currentHeight = await heightResponse.json();
            confirmations = currentHeight - transactionData.status.block_height + 1;
          }
        } catch (error) {
          console.error('Error fetching block height:', error);
          confirmations = transactionData.status.confirmed ? 1 : 0;
        }
      }

    } else if (normalizedCurrency === 'DOGE') {
      // Dogecoin verification via SoChain
      try {
        const response = await fetch(`https://sochain.com/api/v2/tx/DOGE/${txid}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            return NextResponse.json({
              success: false,
              error: 'Transaction not found on blockchain',
              code: 'TRANSACTION_NOT_FOUND',
              testedAddresses: addressesToCheck.map(addr => `DOGE: ${addr}`)
            }, { status: 404 });
          }
          throw new Error(`SoChain API error: ${response.status}`);
        }

        const soChainData = await response.json() as SoChainResponse;
        
        if (soChainData.status !== 'success') {
          throw new Error('SoChain returned non-success status');
        }

        transactionData = soChainData.data;
        confirmations = transactionData.confirmations;

        // Find matching output from ANY of our addresses
        for (const address of addressesToCheck) {
          const matchingOutput = transactionData.outputs.find(
            (output: any) => output.address === address
          );

          if (matchingOutput) {
            matchedAddress = address;
            amountFloat = parseFloat(matchingOutput.value);
            amountSats = Math.floor(amountFloat * 100000000);
            break;
          }
        }

        if (!matchedAddress) {
          return NextResponse.json({
            success: false,
            error: 'Transaction was not sent to any of your configured wallet addresses',
            code: 'ADDRESS_MISMATCH',
            testedAddresses: addressesToCheck.map(addr => `DOGE: Transaction was not sent to address ${addr}`)
          }, { status: 400 });
        }

      } catch (error: any) {
        console.error('SoChain API error:', error);
        return NextResponse.json({
          success: false,
          error: `Failed to fetch Dogecoin transaction: ${error.message}`,
          code: 'BLOCKCHAIN_API_ERROR'
        }, { status: 500 });
      }

    } else if (normalizedCurrency === 'ETH') {
      return NextResponse.json({
        success: false,
        error: 'Ethereum verification requires API key configuration. Please contact support.',
        code: 'CURRENCY_NOT_CONFIGURED'
      }, { status: 501 });
    }

    // Determine if confirmed based on required confirmations
    const requiredConfirmations = normalizedCurrency === 'BTC' ? 2 : 2;
    const isConfirmed = confirmations >= requiredConfirmations;
    const now = new Date().toISOString();
    const metaJson = JSON.stringify({ ...transactionData, confirmations, verifiedAt: now });

    // Update or insert record
    if (existingVerification) {
      const updated = await db.update(incomingVerifications)
        .set({
          amountSats,
          amountFloat,
          confirmed: isConfirmed,
          confirmedAt: isConfirmed ? now : existingVerification.confirmedAt,
          lastChecked: now,
          updatedAt: now,
          retryCount: existingVerification.retryCount + 1,
          errorMessage: null,
          meta: metaJson,
          matchedAddress: matchedAddress!
        })
        .where(eq(incomingVerifications.id, existingVerification.id))
        .returning();

      return NextResponse.json({
        success: true,
        verification: {
          id: updated[0].id,
          txid: updated[0].txid,
          currency: updated[0].currency,
          matchedAddress: updated[0].matchedAddress,
          amountFloat: updated[0].amountFloat,
          confirmed: updated[0].confirmed,
          confirmations,
          firstSeen: updated[0].firstSeen,
          lastChecked: updated[0].lastChecked
        },
        message: isConfirmed 
          ? `Transaction verified and confirmed with ${confirmations} confirmations`
          : `Transaction verified but awaiting confirmation (${confirmations}/${requiredConfirmations} confirmations)`
      }, { status: 200 });
    } else {
      const newVerification = await db.insert(incomingVerifications)
        .values({
          txid,
          currency: normalizedCurrency,
          matchedAddress: matchedAddress!,
          amountSats,
          amountFloat,
          confirmed: isConfirmed,
          confirmedAt: isConfirmed ? now : null,
          credited: false,
          creditedAt: null,
          firstSeen: now,
          lastChecked: now,
          meta: metaJson,
          createdAt: now,
          updatedAt: now,
          userId: null,
          retryCount: 0,
          errorMessage: null
        })
        .returning();

      return NextResponse.json({
        success: true,
        verification: {
          id: newVerification[0].id,
          txid: newVerification[0].txid,
          currency: newVerification[0].currency,
          matchedAddress: newVerification[0].matchedAddress,
          amountFloat: newVerification[0].amountFloat,
          confirmed: newVerification[0].confirmed,
          confirmations,
          firstSeen: newVerification[0].firstSeen,
          lastChecked: newVerification[0].lastChecked
        },
        message: isConfirmed 
          ? `Transaction verified and confirmed with ${confirmations} confirmations`
          : `Transaction verified but awaiting confirmation (${confirmations}/${requiredConfirmations} confirmations)`
      }, { status: 201 });
    }
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + error
    }, { status: 500 });
  }
}