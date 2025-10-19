import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { supportTickets } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

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

      const ticket = await db.select()
        .from(supportTickets)
        .where(eq(supportTickets.id, parseInt(id)))
        .limit(1);

      if (ticket.length === 0) {
        return NextResponse.json({ 
          error: 'Support ticket not found',
          code: 'TICKET_NOT_FOUND' 
        }, { status: 404 });
      }

      return NextResponse.json(ticket[0], { status: 200 });
    }

    // List with filters and pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    let query = db.select().from(supportTickets);

    // Build where conditions
    const conditions = [];

    if (userId) {
      if (isNaN(parseInt(userId))) {
        return NextResponse.json({ 
          error: "Valid userId is required",
          code: "INVALID_USER_ID" 
        }, { status: 400 });
      }
      conditions.push(eq(supportTickets.userId, parseInt(userId)));
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ 
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
          code: "INVALID_STATUS" 
        }, { status: 400 });
      }
      conditions.push(eq(supportTickets.status, status));
    }

    if (priority) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return NextResponse.json({ 
          error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
          code: "INVALID_PRIORITY" 
        }, { status: 400 });
      }
      conditions.push(eq(supportTickets.priority, priority));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Sort by createdAt descending (most recent first) and apply pagination
    const results = await query
      .orderBy(desc(supportTickets.createdAt))
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
    const { userId, subject, orderId, status, priority } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json({ 
        error: "userId is required",
        code: "MISSING_USER_ID" 
      }, { status: 400 });
    }

    if (isNaN(parseInt(userId))) {
      return NextResponse.json({ 
        error: "Valid userId is required",
        code: "INVALID_USER_ID" 
      }, { status: 400 });
    }

    if (!subject || typeof subject !== 'string' || subject.trim() === '') {
      return NextResponse.json({ 
        error: "subject is required and must be a non-empty string",
        code: "MISSING_SUBJECT" 
      }, { status: 400 });
    }

    // Validate optional fields
    if (orderId !== undefined && orderId !== null) {
      if (isNaN(parseInt(orderId))) {
        return NextResponse.json({ 
          error: "Valid orderId is required if provided",
          code: "INVALID_ORDER_ID" 
        }, { status: 400 });
      }
    }

    const ticketStatus = status || 'open';
    if (!VALID_STATUSES.includes(ticketStatus)) {
      return NextResponse.json({ 
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        code: "INVALID_STATUS" 
      }, { status: 400 });
    }

    const ticketPriority = priority || 'medium';
    if (!VALID_PRIORITIES.includes(ticketPriority)) {
      return NextResponse.json({ 
        error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
        code: "INVALID_PRIORITY" 
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    const insertData: any = {
      userId: parseInt(userId),
      subject: subject.trim(),
      status: ticketStatus,
      priority: ticketPriority,
      createdAt: now,
      updatedAt: now,
    };

    if (orderId !== undefined && orderId !== null) {
      insertData.orderId = parseInt(orderId);
    }

    const newTicket = await db.insert(supportTickets)
      .values(insertData)
      .returning();

    return NextResponse.json(newTicket[0], { status: 201 });

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

    const body = await request.json();
    const { subject, status, priority, orderId } = body;

    // Check if ticket exists
    const existingTicket = await db.select()
      .from(supportTickets)
      .where(eq(supportTickets.id, parseInt(id)))
      .limit(1);

    if (existingTicket.length === 0) {
      return NextResponse.json({ 
        error: 'Support ticket not found',
        code: 'TICKET_NOT_FOUND' 
      }, { status: 404 });
    }

    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    // Validate and add fields to update
    if (subject !== undefined) {
      if (typeof subject !== 'string' || subject.trim() === '') {
        return NextResponse.json({ 
          error: "subject must be a non-empty string",
          code: "INVALID_SUBJECT" 
        }, { status: 400 });
      }
      updates.subject = subject.trim();
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ 
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
          code: "INVALID_STATUS" 
        }, { status: 400 });
      }
      updates.status = status;
    }

    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return NextResponse.json({ 
          error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
          code: "INVALID_PRIORITY" 
        }, { status: 400 });
      }
      updates.priority = priority;
    }

    if (orderId !== undefined) {
      if (orderId === null) {
        updates.orderId = null;
      } else if (isNaN(parseInt(orderId))) {
        return NextResponse.json({ 
          error: "Valid orderId is required if provided",
          code: "INVALID_ORDER_ID" 
        }, { status: 400 });
      } else {
        updates.orderId = parseInt(orderId);
      }
    }

    const updated = await db.update(supportTickets)
      .set(updates)
      .where(eq(supportTickets.id, parseInt(id)))
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

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if ticket exists
    const existingTicket = await db.select()
      .from(supportTickets)
      .where(eq(supportTickets.id, parseInt(id)))
      .limit(1);

    if (existingTicket.length === 0) {
      return NextResponse.json({ 
        error: 'Support ticket not found',
        code: 'TICKET_NOT_FOUND' 
      }, { status: 404 });
    }

    const deleted = await db.delete(supportTickets)
      .where(eq(supportTickets.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Support ticket deleted successfully',
      ticket: deleted[0]
    }, { status: 200 });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}