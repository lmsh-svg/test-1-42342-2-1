import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, users } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

const VALID_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single record fetch
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json(
          { error: 'Valid ID is required', code: 'INVALID_ID' },
          { status: 400 }
        );
      }

      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, parseInt(id)))
        .limit(1);

      if (order.length === 0) {
        return NextResponse.json(
          { error: 'Order not found', code: 'ORDER_NOT_FOUND' },
          { status: 404 }
        );
      }

      return NextResponse.json(order[0], { status: 200 });
    }

    // List with filters and pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    let query = db.select().from(orders);

    // Apply filters
    const conditions = [];
    if (userId) {
      const userIdInt = parseInt(userId);
      if (isNaN(userIdInt)) {
        return NextResponse.json(
          { error: 'Valid userId is required', code: 'INVALID_USER_ID' },
          { status: 400 }
        );
      }
      conditions.push(eq(orders.userId, userIdInt));
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Status must be one of: ${VALID_STATUSES.join(', ')}`, code: 'INVALID_STATUS' },
          { status: 400 }
        );
      }
      conditions.push(eq(orders.status, status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply sorting, pagination
    const results = await query
      .orderBy(desc(orders.createdAt))
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
    const { userId, totalAmount, shippingAddress, notes, status } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }

    if (typeof userId !== 'number' || isNaN(userId)) {
      return NextResponse.json(
        { error: 'userId must be a valid integer', code: 'INVALID_USER_ID' },
        { status: 400 }
      );
    }

    if (totalAmount === undefined || totalAmount === null) {
      return NextResponse.json(
        { error: 'totalAmount is required', code: 'MISSING_TOTAL_AMOUNT' },
        { status: 400 }
      );
    }

    if (typeof totalAmount !== 'number' || isNaN(totalAmount) || totalAmount < 0) {
      return NextResponse.json(
        { error: 'totalAmount must be a positive number', code: 'INVALID_TOTAL_AMOUNT' },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${VALID_STATUSES.join(', ')}`, code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    // Check if user exists and has sufficient credits
    const userRecords = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRecords.length === 0) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 400 }
      );
    }

    const user = userRecords[0];
    const currentCredits = user.credits || 0;

    // Check if user has sufficient credits
    if (currentCredits < totalAmount) {
      return NextResponse.json(
        { 
          error: 'Insufficient credits', 
          code: 'INSUFFICIENT_CREDITS',
          required: totalAmount,
          available: currentCredits,
          shortfall: totalAmount - currentCredits
        },
        { status: 400 }
      );
    }

    // Prepare insert data
    const timestamp = new Date().toISOString();
    const insertData = {
      userId,
      totalAmount,
      status: status || 'pending',
      shippingAddress: shippingAddress ? shippingAddress.trim() : null,
      notes: notes ? notes.trim() : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Create order
    const newOrder = await db.insert(orders).values(insertData).returning();

    // Deduct credits from user account
    const newCredits = currentCredits - totalAmount;
    const currentTotalSpent = user.totalSpent || 0;
    const newTotalSpent = currentTotalSpent + totalAmount;

    await db.update(users)
      .set({
        credits: newCredits,
        totalSpent: newTotalSpent
      })
      .where(eq(users.id, userId));

    console.log('[ORDER DEBUG] Order created and credits deducted');
    console.log('[ORDER DEBUG] Order ID:', newOrder[0].id);
    console.log('[ORDER DEBUG] User ID:', userId);
    console.log('[ORDER DEBUG] Order total:', totalAmount);
    console.log('[ORDER DEBUG] Credits: ', currentCredits, '→', newCredits);
    console.log('[ORDER DEBUG] Total spent: ', currentTotalSpent, '→', newTotalSpent);

    return NextResponse.json({
      ...newOrder[0],
      creditsDeducted: totalAmount,
      newBalance: newCredits
    }, { status: 201 });
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const orderId = parseInt(id);

    // Check if order exists
    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (existingOrder.length === 0) {
      return NextResponse.json(
        { error: 'Order not found', code: 'ORDER_NOT_FOUND' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status, shippingAddress, notes, totalAmount } = body;

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${VALID_STATUSES.join(', ')}`, code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    // Validate totalAmount if provided
    if (totalAmount !== undefined && totalAmount !== null) {
      if (typeof totalAmount !== 'number' || isNaN(totalAmount) || totalAmount < 0) {
        return NextResponse.json(
          { error: 'totalAmount must be a positive number', code: 'INVALID_TOTAL_AMOUNT' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (status !== undefined) {
      updateData.status = status;
    }

    if (shippingAddress !== undefined) {
      updateData.shippingAddress = shippingAddress ? shippingAddress.trim() : null;
    }

    if (notes !== undefined) {
      updateData.notes = notes ? notes.trim() : null;
    }

    if (totalAmount !== undefined) {
      updateData.totalAmount = totalAmount;
    }

    const updatedOrder = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId))
      .returning();

    return NextResponse.json(updatedOrder[0], { status: 200 });
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const orderId = parseInt(id);

    // Check if order exists
    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (existingOrder.length === 0) {
      return NextResponse.json(
        { error: 'Order not found', code: 'ORDER_NOT_FOUND' },
        { status: 404 }
      );
    }

    const deletedOrder = await db
      .delete(orders)
      .where(eq(orders.id, orderId))
      .returning();

    return NextResponse.json(
      {
        message: 'Order deleted successfully',
        order: deletedOrder[0],
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