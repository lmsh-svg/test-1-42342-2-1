import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trackingInfo, orders } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const orderId = searchParams.get('orderId');

    // Single record by ID
    if (id) {
      if (isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const record = await db.select()
        .from(trackingInfo)
        .where(eq(trackingInfo.id, parseInt(id)))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json({ 
          error: 'Tracking info not found',
          code: "NOT_FOUND" 
        }, { status: 404 });
      }

      return NextResponse.json(record[0]);
    }

    // List with pagination and filtering
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = db.select().from(trackingInfo);

    // Filter by orderId
    if (orderId) {
      if (isNaN(parseInt(orderId))) {
        return NextResponse.json({ 
          error: "Valid order ID is required",
          code: "INVALID_ORDER_ID" 
        }, { status: 400 });
      }
      query = query.where(eq(trackingInfo.orderId, parseInt(orderId)));
    }

    const results = await query
      .orderBy(desc(trackingInfo.createdAt))
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
    const { orderId, trackingNumber, carrier, status, estimatedDelivery, notes } = body;

    // Validate required field
    if (!orderId) {
      return NextResponse.json({ 
        error: "Order ID is required",
        code: "MISSING_ORDER_ID" 
      }, { status: 400 });
    }

    // Validate orderId is a valid integer
    if (isNaN(parseInt(orderId))) {
      return NextResponse.json({ 
        error: "Valid order ID is required",
        code: "INVALID_ORDER_ID" 
      }, { status: 400 });
    }

    // Check if order exists
    const orderExists = await db.select()
      .from(orders)
      .where(eq(orders.id, parseInt(orderId)))
      .limit(1);

    if (orderExists.length === 0) {
      return NextResponse.json({ 
        error: "Order not found",
        code: "ORDER_NOT_FOUND" 
      }, { status: 404 });
    }

    // Check if tracking info already exists for this order (orderId is unique)
    const existingTracking = await db.select()
      .from(trackingInfo)
      .where(eq(trackingInfo.orderId, parseInt(orderId)))
      .limit(1);

    if (existingTracking.length > 0) {
      return NextResponse.json({ 
        error: "Tracking info already exists for this order",
        code: "DUPLICATE_ORDER_ID" 
      }, { status: 409 });
    }

    // Prepare insert data
    const insertData = {
      orderId: parseInt(orderId),
      trackingNumber: trackingNumber?.trim() || null,
      carrier: carrier?.trim() || null,
      status: status?.trim() || null,
      estimatedDelivery: estimatedDelivery?.trim() || null,
      notes: notes?.trim() || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newRecord = await db.insert(trackingInfo)
      .values(insertData)
      .returning();

    return NextResponse.json(newRecord[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if record exists
    const existing = await db.select()
      .from(trackingInfo)
      .where(eq(trackingInfo.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Tracking info not found',
        code: "NOT_FOUND" 
      }, { status: 404 });
    }

    const body = await request.json();
    const { trackingNumber, carrier, status, estimatedDelivery, notes } = body;

    // Prepare update data (only updatable fields)
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (trackingNumber !== undefined) {
      updateData.trackingNumber = trackingNumber?.trim() || null;
    }
    if (carrier !== undefined) {
      updateData.carrier = carrier?.trim() || null;
    }
    if (status !== undefined) {
      updateData.status = status?.trim() || null;
    }
    if (estimatedDelivery !== undefined) {
      updateData.estimatedDelivery = estimatedDelivery?.trim() || null;
    }
    if (notes !== undefined) {
      updateData.notes = notes?.trim() || null;
    }

    const updated = await db.update(trackingInfo)
      .set(updateData)
      .where(eq(trackingInfo.id, parseInt(id)))
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if record exists
    const existing = await db.select()
      .from(trackingInfo)
      .where(eq(trackingInfo.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Tracking info not found',
        code: "NOT_FOUND" 
      }, { status: 404 });
    }

    const deleted = await db.delete(trackingInfo)
      .where(eq(trackingInfo.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Tracking info deleted successfully',
      deleted: deleted[0]
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}