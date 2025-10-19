import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { ticketMessages } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // Single record fetch
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const message = await db.select()
        .from(ticketMessages)
        .where(eq(ticketMessages.id, parseInt(id)))
        .limit(1);

      if (message.length === 0) {
        return NextResponse.json({ 
          error: 'Ticket message not found',
          code: 'MESSAGE_NOT_FOUND' 
        }, { status: 404 });
      }

      return NextResponse.json(message[0], { status: 200 });
    }

    // List with pagination and filters
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const ticketId = searchParams.get('ticketId');
    const userId = searchParams.get('userId');

    let query = db.select().from(ticketMessages);

    // Build filter conditions
    const conditions = [];
    
    if (ticketId) {
      if (isNaN(parseInt(ticketId))) {
        return NextResponse.json({ 
          error: "Valid ticketId is required",
          code: "INVALID_TICKET_ID" 
        }, { status: 400 });
      }
      conditions.push(eq(ticketMessages.ticketId, parseInt(ticketId)));
    }

    if (userId) {
      if (isNaN(parseInt(userId))) {
        return NextResponse.json({ 
          error: "Valid userId is required",
          code: "INVALID_USER_ID" 
        }, { status: 400 });
      }
      conditions.push(eq(ticketMessages.userId, parseInt(userId)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Sort by createdAt ascending (chronological order - oldest first)
    const results = await query
      .orderBy(asc(ticketMessages.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results, { status: 200 });
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
    const { ticketId, userId, message } = body;

    // Validate required fields
    if (!ticketId) {
      return NextResponse.json({ 
        error: "ticketId is required",
        code: "MISSING_TICKET_ID" 
      }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ 
        error: "userId is required",
        code: "MISSING_USER_ID" 
      }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ 
        error: "message is required",
        code: "MISSING_MESSAGE" 
      }, { status: 400 });
    }

    // Validate ticketId is valid integer
    if (isNaN(parseInt(ticketId))) {
      return NextResponse.json({ 
        error: "ticketId must be a valid integer",
        code: "INVALID_TICKET_ID" 
      }, { status: 400 });
    }

    // Validate userId is valid integer
    if (isNaN(parseInt(userId))) {
      return NextResponse.json({ 
        error: "userId must be a valid integer",
        code: "INVALID_USER_ID" 
      }, { status: 400 });
    }

    // Trim and validate message
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return NextResponse.json({ 
        error: "message cannot be empty",
        code: "EMPTY_MESSAGE" 
      }, { status: 400 });
    }

    // Create new ticket message
    const newMessage = await db.insert(ticketMessages)
      .values({
        ticketId: parseInt(ticketId),
        userId: parseInt(userId),
        message: trimmedMessage,
        createdAt: new Date().toISOString()
      })
      .returning();

    return NextResponse.json(newMessage[0], { status: 201 });
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

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const body = await request.json();
    const { message } = body;

    // Validate message if provided
    if (message !== undefined) {
      if (typeof message !== 'string') {
        return NextResponse.json({ 
          error: "message must be a string",
          code: "INVALID_MESSAGE_TYPE" 
        }, { status: 400 });
      }

      const trimmedMessage = message.trim();
      if (!trimmedMessage) {
        return NextResponse.json({ 
          error: "message cannot be empty",
          code: "EMPTY_MESSAGE" 
        }, { status: 400 });
      }
    }

    // Check if record exists
    const existing = await db.select()
      .from(ticketMessages)
      .where(eq(ticketMessages.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Ticket message not found',
        code: 'MESSAGE_NOT_FOUND' 
      }, { status: 404 });
    }

    // Prepare update data
    const updateData: { message?: string } = {};
    
    if (message !== undefined) {
      updateData.message = message.trim();
    }

    // Update ticket message
    const updated = await db.update(ticketMessages)
      .set(updateData)
      .where(eq(ticketMessages.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0], { status: 200 });
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

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if record exists
    const existing = await db.select()
      .from(ticketMessages)
      .where(eq(ticketMessages.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ 
        error: 'Ticket message not found',
        code: 'MESSAGE_NOT_FOUND' 
      }, { status: 404 });
    }

    // Delete ticket message
    const deleted = await db.delete(ticketMessages)
      .where(eq(ticketMessages.id, parseInt(id)))
      .returning();

    return NextResponse.json({ 
      message: 'Ticket message deleted successfully',
      deletedMessage: deleted[0]
    }, { status: 200 });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}