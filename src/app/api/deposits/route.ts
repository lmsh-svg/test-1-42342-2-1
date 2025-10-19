import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { deposits, users, cryptoWalletAddresses } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Single deposit by ID
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json(
          { error: 'Valid ID is required', code: 'INVALID_ID' },
          { status: 400 }
        );
      }

      const deposit = await db
        .select()
        .from(deposits)
        .where(eq(deposits.id, parseInt(id)))
        .limit(1);

      if (deposit.length === 0) {
        return NextResponse.json(
          { error: 'Deposit not found', code: 'DEPOSIT_NOT_FOUND' },
          { status: 404 }
        );
      }

      return NextResponse.json(deposit[0], { status: 200 });
    }

    // List deposits with filtering
    let query = db.select().from(deposits);

    const conditions = [];

    if (userId) {
      if (isNaN(parseInt(userId))) {
        return NextResponse.json(
          { error: 'Valid user ID is required', code: 'INVALID_USER_ID' },
          { status: 400 }
        );
      }
      conditions.push(eq(deposits.userId, parseInt(userId)));
    }

    if (status) {
      if (!['pending', 'completed', 'cancelled'].includes(status)) {
        return NextResponse.json(
          { error: 'Status must be one of: pending, completed, cancelled', code: 'INVALID_STATUS' },
          { status: 400 }
        );
      }
      conditions.push(eq(deposits.status, status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(deposits.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, cryptocurrency, amount, agreedToTerms } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }

    if (!cryptocurrency || typeof cryptocurrency !== 'string' || cryptocurrency.trim() === '') {
      return NextResponse.json(
        { error: 'Cryptocurrency is required and must be a non-empty string', code: 'MISSING_CRYPTOCURRENCY' },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number greater than 0', code: 'INVALID_AMOUNT' },
        { status: 400 }
      );
    }

    // Validate agreedToTerms is true
    if (agreedToTerms !== true) {
      return NextResponse.json(
        { error: 'You must agree to the terms and conditions to create a deposit', code: 'TERMS_NOT_AGREED' },
        { status: 400 }
      );
    }

    // Validate userId is a valid integer
    if (isNaN(parseInt(userId.toString()))) {
      return NextResponse.json(
        { error: 'User ID must be a valid integer', code: 'INVALID_USER_ID' },
        { status: 400 }
      );
    }

    const userIdInt = parseInt(userId.toString());

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userIdInt))
      .limit(1);

    if (existingUser.length === 0) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 400 }
      );
    }

    const user = existingUser[0];

    // Check if user has active cooldown
    if (user.lastCancelledDepositAt) {
      const lastCancelledTime = new Date(user.lastCancelledDepositAt).getTime();
      const now = Date.now();
      const oneHourInMs = 60 * 60 * 1000;
      const cooldownEndsAt = lastCancelledTime + oneHourInMs;

      if (now < cooldownEndsAt) {
        const remainingMs = cooldownEndsAt - now;
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

        return NextResponse.json(
          { 
            error: 'You must wait before creating a new deposit after cancelling one', 
            code: 'COOLDOWN_ACTIVE',
            cooldownEndsAt: new Date(cooldownEndsAt).toISOString(),
            remainingMinutes
          },
          { status: 429 }
        );
      }
    }

    // Look up active wallet address for the cryptocurrency
    const walletAddress = await db
      .select()
      .from(cryptoWalletAddresses)
      .where(
        and(
          eq(cryptoWalletAddresses.cryptocurrency, cryptocurrency.trim()),
          eq(cryptoWalletAddresses.isActive, true)
        )
      )
      .limit(1);

    if (walletAddress.length === 0) {
      return NextResponse.json(
        { error: `No active wallet address found for ${cryptocurrency}`, code: 'NO_WALLET_ADDRESS' },
        { status: 400 }
      );
    }

    // Calculate credits (1 USD = 1 credit)
    const credits = amount;

    // Create deposit
    const now = new Date().toISOString();
    const newDeposit = await db
      .insert(deposits)
      .values({
        userId: userIdInt,
        amount,
        cryptocurrency: cryptocurrency.trim(),
        walletAddress: walletAddress[0].address,
        status: 'pending',
        credits,
        transactionHash: null,
        notes: null,
        agreedToTerms: true,
        agreedToTermsAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(newDeposit[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const depositId = parseInt(id);
    const body = await request.json();
    const { status, transactionHash, transactionId, notes, credits } = body;

    // Validate status if provided
    if (status && !['pending', 'completed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be one of: pending, completed, cancelled', code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    // Validate and normalize transactionId if provided
    let normalizedTxid: string | undefined = undefined;
    if (transactionId !== undefined && transactionId !== null) {
      const txid = typeof transactionId === 'string' ? transactionId.trim() : '';
      if (txid === '') {
        return NextResponse.json(
          { error: 'Transaction ID cannot be empty', code: 'EMPTY_TXID' },
          { status: 400 }
        );
      }
      // Validate Bitcoin transaction ID format (64 hexadecimal characters)
      const txidRegex = /^[a-fA-F0-9]{64}$/;
      if (!txidRegex.test(txid)) {
        return NextResponse.json(
          { error: 'Invalid transaction ID format. Must be 64 hexadecimal characters (0-9, a-f)', code: 'INVALID_TXID_FORMAT' },
          { status: 400 }
        );
      }
      // Normalize to lowercase for consistency
      normalizedTxid = txid.toLowerCase();
    }

    // Validate credits if provided
    if (credits !== undefined && (typeof credits !== 'number' || credits < 0)) {
      return NextResponse.json(
        { error: 'Credits must be a non-negative number', code: 'INVALID_CREDITS' },
        { status: 400 }
      );
    }

    // Check if deposit exists
    const existingDeposit = await db
      .select()
      .from(deposits)
      .where(eq(deposits.id, depositId))
      .limit(1);

    if (existingDeposit.length === 0) {
      return NextResponse.json(
        { error: 'Deposit not found', code: 'DEPOSIT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const deposit = existingDeposit[0];

    // If status is being changed to 'completed', update user's credits
    if (status === 'completed' && deposit.status !== 'completed') {
      const creditsToAdd = credits !== undefined ? credits : deposit.credits;
      
      // Get current user
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, deposit.userId))
        .limit(1);

      if (user.length > 0) {
        const newCredits = (user[0].credits || 0) + creditsToAdd;
        
        await db
          .update(users)
          .set({ credits: newCredits })
          .where(eq(users.id, deposit.userId));
      }
    }

    // If status is being changed to 'cancelled', update user's lastCancelledDepositAt
    if (status === 'cancelled' && deposit.status !== 'cancelled') {
      await db
        .update(users)
        .set({ lastCancelledDepositAt: new Date().toISOString() })
        .where(eq(users.id, deposit.userId));
    }

    // Build update object with only provided fields
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (status !== undefined) updateData.status = status;
    if (transactionHash !== undefined) updateData.transactionHash = transactionHash;
    if (normalizedTxid !== undefined) updateData.transactionId = normalizedTxid;
    if (notes !== undefined) updateData.notes = notes;
    if (credits !== undefined) updateData.credits = credits;

    // Update deposit
    const updated = await db
      .update(deposits)
      .set(updateData)
      .where(eq(deposits.id, depositId))
      .returning();

    return NextResponse.json(updated[0], { status: 200 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const depositId = parseInt(id);

    // Check if deposit exists
    const existingDeposit = await db
      .select()
      .from(deposits)
      .where(eq(deposits.id, depositId))
      .limit(1);

    if (existingDeposit.length === 0) {
      return NextResponse.json(
        { error: 'Deposit not found', code: 'DEPOSIT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Delete deposit
    const deleted = await db
      .delete(deposits)
      .where(eq(deposits.id, depositId))
      .returning();

    return NextResponse.json(
      {
        message: 'Deposit deleted successfully',
        deposit: deleted[0],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}