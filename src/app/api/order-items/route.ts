import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orderItems } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const orderId = searchParams.get('orderId');
    const productId = searchParams.get('productId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Single record by ID
    if (id) {
      if (isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const record = await db.select()
        .from(orderItems)
        .where(eq(orderItems.id, parseInt(id)))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json({ 
          error: 'Order item not found',
          code: "NOT_FOUND" 
        }, { status: 404 });
      }

      return NextResponse.json(record[0]);
    }

    // List with filters
    let query = db.select().from(orderItems);

    const conditions = [];

    if (orderId) {
      if (isNaN(parseInt(orderId))) {
        return NextResponse.json({ 
          error: "Valid order ID is required",
          code: "INVALID_ORDER_ID" 
        }, { status: 400 });
      }
      conditions.push(eq(orderItems.orderId, parseInt(orderId)));
    }

    if (productId) {
      if (isNaN(parseInt(productId))) {
        return NextResponse.json({ 
          error: "Valid product ID is required",
          code: "INVALID_PRODUCT_ID" 
        }, { status: 400 });
      }
      conditions.push(eq(orderItems.productId, parseInt(productId)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(orderItems.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, productId, quantity, priceAtPurchase } = body;

    // Validate required fields
    if (!orderId) {
      return NextResponse.json({ 
        error: "Order ID is required",
        code: "MISSING_ORDER_ID" 
      }, { status: 400 });
    }

    if (!productId) {
      return NextResponse.json({ 
        error: "Product ID is required",
        code: "MISSING_PRODUCT_ID" 
      }, { status: 400 });
    }

    if (!quantity) {
      return NextResponse.json({ 
        error: "Quantity is required",
        code: "MISSING_QUANTITY" 
      }, { status: 400 });
    }

    if (priceAtPurchase === undefined || priceAtPurchase === null) {
      return NextResponse.json({ 
        error: "Price at purchase is required",
        code: "MISSING_PRICE" 
      }, { status: 400 });
    }

    // Validate orderId is valid integer
    if (isNaN(parseInt(orderId))) {
      return NextResponse.json({ 
        error: "Order ID must be a valid integer",
        code: "INVALID_ORDER_ID" 
      }, { status: 400 });
    }

    // Validate productId is valid integer
    if (isNaN(parseInt(productId))) {
      return NextResponse.json({ 
        error: "Product ID must be a valid integer",
        code: "INVALID_PRODUCT_ID" 
      }, { status: 400 });
    }

    // Validate quantity is positive integer (>= 1)
    if (isNaN(parseInt(quantity)) || parseInt(quantity) < 1) {
      return NextResponse.json({ 
        error: "Quantity must be a positive integer (>= 1)",
        code: "INVALID_QUANTITY" 
      }, { status: 400 });
    }

    // Validate priceAtPurchase is positive number
    if (isNaN(parseFloat(priceAtPurchase)) || parseFloat(priceAtPurchase) < 0) {
      return NextResponse.json({ 
        error: "Price at purchase must be a positive number",
        code: "INVALID_PRICE" 
      }, { status: 400 });
    }

    const newOrderItem = await db.insert(orderItems)
      .values({
        orderId: parseInt(orderId),
        productId: parseInt(productId),
        quantity: parseInt(quantity),
        priceAtPurchase: parseFloat(priceAtPurchase),
        createdAt: new Date().toISOString()
      })
      .returning();

    return NextResponse.json(newOrderItem[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if record exists
    const existing = await db.select()
      .from(orderItems)
      .where(eq(orderItems.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Order item not found',
        code: "NOT_FOUND" 
      }, { status: 404 });
    }

    const body = await request.json();
    const { quantity, priceAtPurchase } = body;

    const updates: any = {};

    // Validate and update quantity if provided
    if (quantity !== undefined) {
      if (isNaN(parseInt(quantity)) || parseInt(quantity) < 1) {
        return NextResponse.json({ 
          error: "Quantity must be a positive integer (>= 1)",
          code: "INVALID_QUANTITY" 
        }, { status: 400 });
      }
      updates.quantity = parseInt(quantity);
    }

    // Validate and update priceAtPurchase if provided
    if (priceAtPurchase !== undefined) {
      if (isNaN(parseFloat(priceAtPurchase)) || parseFloat(priceAtPurchase) < 0) {
        return NextResponse.json({ 
          error: "Price at purchase must be a positive number",
          code: "INVALID_PRICE" 
        }, { status: 400 });
      }
      updates.priceAtPurchase = parseFloat(priceAtPurchase);
    }

    // If no valid updates provided
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ 
        error: "No valid fields to update",
        code: "NO_UPDATES" 
      }, { status: 400 });
    }

    const updated = await db.update(orderItems)
      .set(updates)
      .where(eq(orderItems.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if record exists
    const existing = await db.select()
      .from(orderItems)
      .where(eq(orderItems.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Order item not found',
        code: "NOT_FOUND" 
      }, { status: 404 });
    }

    const deleted = await db.delete(orderItems)
      .where(eq(orderItems.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Order item deleted successfully',
      deletedItem: deleted[0]
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}