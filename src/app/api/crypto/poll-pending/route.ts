import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { incomingVerifications, cryptoWalletAddresses, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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

interface EtherscanResponse {
  status: string;
  message: string;
  result: {
    blockNumber: string;
    confirmations: string;
    to: string;
    value: string;
    gasUsed: string;
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

const MAX_RETRIES = 10;
const BTC_REQUIRED_CONFIRMATIONS = 2;

export async function POST(request: NextRequest) {
  try {
    // Fetch all pending or unconfirmed verifications
    const pendingVerifications = await db
      .select()
      .from(incomingVerifications)
      .where(
        and(
          eq(incomingVerifications.confirmed, false),
          eq(incomingVerifications.credited, false)
        )
      )
      .limit(50);

    if (pendingVerifications.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending verifications to process',
        processed: 0
      });
    }

    const results = {
      total: pendingVerifications.length,
      confirmed: 0,
      credited: 0,
      stillPending: 0,
      failed: 0,
      skipped: 0
    };

    for (const verification of pendingVerifications) {
      // Skip if max retries reached
      if (verification.retryCount >= MAX_RETRIES) {
        results.skipped++;
        continue;
      }

      const { id, txid, currency, matchedAddress } = verification;

      try {
        // Get wallet address for this currency
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
          await db
            .update(incomingVerifications)
            .set({
              retryCount: verification.retryCount + 1,
              errorMessage: `No active wallet address found for ${currency}`,
              lastChecked: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
            .where(eq(incomingVerifications.id, id));
          results.failed++;
          continue;
        }

        const ourAddress = walletAddresses[0].address;
        let txData: any = null;
        let confirmations = 0;
        let amountFloat = 0;
        let amountSats = 0;

        // Verify based on currency
        if (currency === 'BTC') {
          // Bitcoin verification via mempool.space
          const response = await fetch(`https://mempool.space/api/tx/${txid}`);
          
          if (!response.ok) {
            if (response.status === 404) {
              await db
                .update(incomingVerifications)
                .set({
                  retryCount: verification.retryCount + 1,
                  errorMessage: 'Transaction not found on blockchain',
                  lastChecked: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                })
                .where(eq(incomingVerifications.id, id));
              results.failed++;
              continue;
            }
            throw new Error(`Mempool API error: ${response.status}`);
          }

          txData = await response.json() as MempoolTransaction;

          // Find matching output
          const matchingOutput = txData.vout.find(
            output => output.scriptpubkey_address === ourAddress
          );

          if (!matchingOutput) {
            await db
              .update(incomingVerifications)
              .set({
                retryCount: verification.retryCount + 1,
                errorMessage: `No output found for address ${ourAddress}`,
                lastChecked: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              })
              .where(eq(incomingVerifications.id, id));
            results.failed++;
            continue;
          }

          amountSats = matchingOutput.value;
          amountFloat = amountSats / 100000000;

          // Calculate confirmations
          if (txData.status.confirmed && txData.status.block_height) {
            try {
              const tipResponse = await fetch('https://mempool.space/api/blocks/tip/height');
              if (tipResponse.ok) {
                const currentHeight = await tipResponse.json();
                confirmations = currentHeight - txData.status.block_height + 1;
              }
            } catch (error) {
              console.error('Error fetching tip height:', error);
              confirmations = 1;
            }
          }

        } else if (currency === 'ETH') {
          // Ethereum verification via Etherscan (requires API key for production)
          // For now, return not supported
          await db
            .update(incomingVerifications)
            .set({
              retryCount: verification.retryCount + 1,
              errorMessage: 'Ethereum verification not yet implemented',
              lastChecked: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
            .where(eq(incomingVerifications.id, id));
          results.failed++;
          continue;

        } else if (currency === 'DOGE') {
          // Dogecoin verification via SoChain
          try {
            const response = await fetch(`https://sochain.com/api/v2/tx/DOGE/${txid}`);
            
            if (!response.ok) {
              throw new Error(`SoChain API error: ${response.status}`);
            }

            const soChainData = await response.json() as SoChainResponse;
            
            if (soChainData.status !== 'success') {
              throw new Error('SoChain returned non-success status');
            }

            txData = soChainData.data;
            confirmations = txData.confirmations;

            // Find matching output
            const matchingOutput = txData.outputs.find(
              (output: any) => output.address === ourAddress
            );

            if (!matchingOutput) {
              await db
                .update(incomingVerifications)
                .set({
                  retryCount: verification.retryCount + 1,
                  errorMessage: `No output found for address ${ourAddress}`,
                  lastChecked: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                })
                .where(eq(incomingVerifications.id, id));
              results.failed++;
              continue;
            }

            amountFloat = parseFloat(matchingOutput.value);
            amountSats = Math.floor(amountFloat * 100000000);

          } catch (error: any) {
            await db
              .update(incomingVerifications)
              .set({
                retryCount: verification.retryCount + 1,
                errorMessage: `Dogecoin verification error: ${error.message}`,
                lastChecked: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              })
              .where(eq(incomingVerifications.id, id));
            results.failed++;
            continue;
          }

        } else {
          results.skipped++;
          continue;
        }

        // Determine if confirmed based on required confirmations
        const requiredConfirmations = currency === 'BTC' ? BTC_REQUIRED_CONFIRMATIONS : 2;
        const isConfirmed = confirmations >= requiredConfirmations;
        const now = new Date().toISOString();

        if (isConfirmed) {
          // Transaction is confirmed - update record and credit user if applicable
          const updateData: any = {
            confirmed: true,
            confirmedAt: now,
            amountSats,
            amountFloat,
            lastChecked: now,
            updatedAt: now,
            retryCount: verification.retryCount + 1,
            errorMessage: null,
            meta: JSON.stringify({ ...txData, confirmations, verifiedAt: now })
          };

          // Credit user if userId is set and not already credited
          if (verification.userId && !verification.credited) {
            try {
              // Fetch user
              const userRecords = await db
                .select()
                .from(users)
                .where(eq(users.id, verification.userId))
                .limit(1);

              if (userRecords.length > 0) {
                const currentCredits = userRecords[0].credits || 0;
                
                // Credit user account (idempotent - only if not already credited)
                await db
                  .update(users)
                  .set({
                    credits: currentCredits + amountFloat
                  })
                  .where(eq(users.id, verification.userId));

                updateData.credited = true;
                updateData.creditedAt = now;
                results.credited++;
              }
            } catch (creditError) {
              console.error('Error crediting user:', creditError);
              // Continue with confirmation but don't mark as credited
            }
          }

          await db
            .update(incomingVerifications)
            .set(updateData)
            .where(eq(incomingVerifications.id, id));

          results.confirmed++;

        } else {
          // Still pending - update check time and retry count
          await db
            .update(incomingVerifications)
            .set({
              amountSats,
              amountFloat,
              lastChecked: now,
              updatedAt: now,
              retryCount: verification.retryCount + 1,
              meta: JSON.stringify({ ...txData, confirmations, checkedAt: now })
            })
            .where(eq(incomingVerifications.id, id));

          results.stillPending++;
        }

      } catch (error: any) {
        console.error(`Error processing verification ${id}:`, error);
        
        // Update with error
        await db
          .update(incomingVerifications)
          .set({
            retryCount: verification.retryCount + 1,
            errorMessage: error.message || 'Unknown error during verification',
            lastChecked: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .where(eq(incomingVerifications.id, id));

        results.failed++;
      }

      // Add small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return NextResponse.json({
      success: true,
      message: 'Polling completed',
      results
    });

  } catch (error: any) {
    console.error('POST /api/crypto/poll-pending error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error: ' + error.message
      },
      { status: 500 }
    );
  }
}