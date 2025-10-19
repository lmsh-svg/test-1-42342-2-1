import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { manualCredits, users, deposits } from '@/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';

async function getAuthenticatedAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  // In a real implementation, you would verify the JWT token here
  // For now, we'll query the user directly assuming token contains user ID
  // This is a simplified version - replace with proper JWT verification
  try {
    const userId = parseInt(token);
    if (isNaN(userId)) {
      return null;
    }

    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0 || user[0].role !== 'admin') {
      return null;
    }

    return user[0];
  } catch (error) {
    console.error('[MANUAL CREDIT ERROR] Authentication error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(request);
    
    if (!admin) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    if (admin.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Admin access required',
        code: 'FORBIDDEN' 
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    const creditType = searchParams.get('creditType');
    const verified = searchParams.get('verified');
    const limitParam = searchParams.get('limit') || '50';
    const offsetParam = searchParams.get('offset') || '0';

    // Single record by ID
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: 'Valid ID is required',
          code: 'INVALID_ID' 
        }, { status: 400 });
      }

      const record = await db.select({
        id: manualCredits.id,
        adminId: manualCredits.adminId,
        userId: manualCredits.userId,
        amount: manualCredits.amount,
        creditType: manualCredits.creditType,
        transactionId: manualCredits.transactionId,
        referenceNumber: manualCredits.referenceNumber,
        notes: manualCredits.notes,
        verified: manualCredits.verified,
        createdAt: manualCredits.createdAt,
        userName: sql<string>`${users.username}`.as('userName'),
        adminName: sql<string>`(SELECT username FROM ${users} WHERE id = ${manualCredits.adminId})`.as('adminName'),
      })
        .from(manualCredits)
        .leftJoin(users, eq(manualCredits.userId, users.id))
        .where(eq(manualCredits.id, parseInt(id)))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json({ 
          error: 'Manual credit record not found',
          code: 'NOT_FOUND' 
        }, { status: 404 });
      }

      return NextResponse.json(record[0], { status: 200 });
    }

    // List with filters
    const limit = Math.min(parseInt(limitParam), 100);
    const offset = parseInt(offsetParam);

    if (isNaN(limit) || limit < 1) {
      return NextResponse.json({ 
        error: 'Valid limit is required',
        code: 'INVALID_LIMIT' 
      }, { status: 400 });
    }

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json({ 
        error: 'Valid offset is required',
        code: 'INVALID_OFFSET' 
      }, { status: 400 });
    }

    let conditions: any[] = [];

    if (userId) {
      if (isNaN(parseInt(userId))) {
        return NextResponse.json({ 
          error: 'Valid user ID is required',
          code: 'INVALID_USER_ID' 
        }, { status: 400 });
      }
      conditions.push(eq(manualCredits.userId, parseInt(userId)));
    }

    if (creditType) {
      if (creditType !== 'crypto_transaction' && creditType !== 'local_cash') {
        return NextResponse.json({ 
          error: 'Credit type must be either crypto_transaction or local_cash',
          code: 'INVALID_CREDIT_TYPE' 
        }, { status: 400 });
      }
      conditions.push(eq(manualCredits.creditType, creditType));
    }

    if (verified !== null && verified !== undefined) {
      const verifiedBool = verified === 'true';
      if (verified !== 'true' && verified !== 'false') {
        return NextResponse.json({ 
          error: 'Verified must be true or false',
          code: 'INVALID_VERIFIED' 
        }, { status: 400 });
      }
      conditions.push(eq(manualCredits.verified, verifiedBool));
    }

    let query = db.select({
      id: manualCredits.id,
      adminId: manualCredits.adminId,
      userId: manualCredits.userId,
      amount: manualCredits.amount,
      creditType: manualCredits.creditType,
      transactionId: manualCredits.transactionId,
      referenceNumber: manualCredits.referenceNumber,
      notes: manualCredits.notes,
      verified: manualCredits.verified,
      createdAt: manualCredits.createdAt,
      userName: sql<string>`${users.username}`.as('userName'),
      adminName: sql<string>`(SELECT username FROM ${users} WHERE id = ${manualCredits.adminId})`.as('adminName'),
    })
      .from(manualCredits)
      .leftJoin(users, eq(manualCredits.userId, users.id))
      .orderBy(desc(manualCredits.createdAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.limit(limit).offset(offset);

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('[MANUAL CREDIT ERROR] GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error,
      code: 'INTERNAL_ERROR' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(request);
    
    if (!admin) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      }, { status: 401 });
    }

    if (admin.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Admin access required',
        code: 'FORBIDDEN' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { userId, amount, creditType, notes, transactionId, referenceNumber } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json({ 
        error: 'User ID is required',
        code: 'MISSING_USER_ID' 
      }, { status: 400 });
    }

    if (!amount) {
      return NextResponse.json({ 
        error: 'Amount is required',
        code: 'MISSING_AMOUNT' 
      }, { status: 400 });
    }

    if (!creditType) {
      return NextResponse.json({ 
        error: 'Credit type is required',
        code: 'MISSING_CREDIT_TYPE' 
      }, { status: 400 });
    }

    if (!notes) {
      return NextResponse.json({ 
        error: 'Notes are required',
        code: 'MISSING_NOTES' 
      }, { status: 400 });
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ 
        error: 'Amount must be a positive number greater than 0',
        code: 'INVALID_AMOUNT' 
      }, { status: 400 });
    }

    // Validate credit type
    if (creditType !== 'crypto_transaction' && creditType !== 'local_cash') {
      return NextResponse.json({ 
        error: 'Credit type must be either crypto_transaction or local_cash',
        code: 'INVALID_CREDIT_TYPE' 
      }, { status: 400 });
    }

    // Validate user exists
    const userRecord = await db.select()
      .from(users)
      .where(eq(users.id, parseInt(userId)))
      .limit(1);

    if (userRecord.length === 0) {
      return NextResponse.json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND' 
      }, { status: 400 });
    }

    let verified = false;
    let finalTransactionId = null;
    let finalReferenceNumber = null;

    // Crypto transaction validation
    if (creditType === 'crypto_transaction') {
      if (!transactionId) {
        return NextResponse.json({ 
          error: 'Transaction ID is required for crypto transactions',
          code: 'MISSING_TRANSACTION_ID' 
        }, { status: 400 });
      }

      // Validate transaction ID format (64 hex characters)
      const hexRegex = /^[a-fA-F0-9]{64}$/;
      if (!hexRegex.test(transactionId)) {
        return NextResponse.json({ 
          error: 'Transaction ID must be 64 hexadecimal characters',
          code: 'INVALID_TRANSACTION_ID_FORMAT' 
        }, { status: 400 });
      }

      // Check uniqueness in manualCredits table
      const existingManualCredit = await db.select()
        .from(manualCredits)
        .where(eq(manualCredits.transactionId, transactionId))
        .limit(1);

      if (existingManualCredit.length > 0) {
        return NextResponse.json({ 
          error: 'Transaction ID has already been used',
          code: 'TRANSACTION_ID_ALREADY_USED' 
        }, { status: 400 });
      }

      // Check if used in deposits table
      const existingDeposit = await db.select()
        .from(deposits)
        .where(eq(deposits.transactionId, transactionId))
        .limit(1);

      if (existingDeposit.length > 0) {
        return NextResponse.json({ 
          error: 'Transaction ID has already been used in deposits',
          code: 'TRANSACTION_ID_ALREADY_USED_IN_DEPOSITS' 
        }, { status: 400 });
      }

      verified = false;
      finalTransactionId = transactionId;
    }

    // Local cash validation
    if (creditType === 'local_cash') {
      if (!referenceNumber) {
        return NextResponse.json({ 
          error: 'Reference number is required for local cash transactions',
          code: 'MISSING_REFERENCE_NUMBER' 
        }, { status: 400 });
      }

      if (typeof referenceNumber !== 'string' || referenceNumber.trim().length === 0) {
        return NextResponse.json({ 
          error: 'Reference number must be a non-empty string',
          code: 'INVALID_REFERENCE_NUMBER' 
        }, { status: 400 });
      }

      // Check uniqueness in manualCredits table
      const existingManualCredit = await db.select()
        .from(manualCredits)
        .where(eq(manualCredits.referenceNumber, referenceNumber))
        .limit(1);

      if (existingManualCredit.length > 0) {
        return NextResponse.json({ 
          error: 'Reference number has already been used',
          code: 'REFERENCE_NUMBER_ALREADY_USED' 
        }, { status: 400 });
      }

      verified = true;
      finalReferenceNumber = referenceNumber;
    }

    // Credit user account
    const currentUser = userRecord[0];
    const currentCredits = currentUser.credits || 0;
    const newCredits = currentCredits + numAmount;

    await db.update(users)
      .set({ credits: newCredits })
      .where(eq(users.id, parseInt(userId)));

    console.log('[MANUAL CREDIT] User ID:', userId, 'Amount:', numAmount, 'Type:', creditType, 'Admin ID:', admin.id, 'New Balance:', newCredits);

    // Create manual credit record
    const newManualCredit = await db.insert(manualCredits)
      .values({
        adminId: admin.id,
        userId: parseInt(userId),
        amount: numAmount,
        creditType,
        transactionId: finalTransactionId,
        referenceNumber: finalReferenceNumber,
        notes: notes.trim(),
        verified,
        createdAt: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json(newManualCredit[0], { status: 201 });

  } catch (error) {
    console.error('[MANUAL CREDIT ERROR] POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error,
      code: 'INTERNAL_ERROR' 
    }, { status: 500 });
  }
}