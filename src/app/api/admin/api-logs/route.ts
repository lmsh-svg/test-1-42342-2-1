import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiLogs } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const configId = searchParams.get('configId');
    const action = searchParams.get('action');
    const status = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Validate action if provided
    const validActions = ['sync', 'parse', 'preview', 'test'];
    if (action && !validActions.includes(action)) {
      return NextResponse.json({
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
        code: 'INVALID_ACTION'
      }, { status: 400 });
    }

    // Validate status if provided
    const validStatuses = ['success', 'error', 'warning'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        code: 'INVALID_STATUS'
      }, { status: 400 });
    }

    // Single record by ID
    if (id) {
      const parsedId = parseInt(id);
      if (isNaN(parsedId) || parsedId <= 0) {
        return NextResponse.json({
          error: 'Invalid ID. Must be a positive integer',
          code: 'INVALID_ID'
        }, { status: 400 });
      }

      const record = await db.select()
        .from(apiLogs)
        .where(eq(apiLogs.id, parsedId))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json({
          error: 'Log record not found',
          code: 'NOT_FOUND'
        }, { status: 404 });
      }

      return NextResponse.json(record[0], { status: 200 });
    }

    // List with filtering and pagination
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam), 1), 100) : 50;
    const offset = offsetParam ? Math.max(parseInt(offsetParam), 0) : 0;

    // Validate pagination parameters
    if (limitParam && (isNaN(limit) || limit < 1 || limit > 100)) {
      return NextResponse.json({
        error: 'Invalid limit. Must be an integer between 1 and 100',
        code: 'INVALID_LIMIT'
      }, { status: 400 });
    }

    if (offsetParam && (isNaN(offset) || offset < 0)) {
      return NextResponse.json({
        error: 'Invalid offset. Must be a non-negative integer',
        code: 'INVALID_OFFSET'
      }, { status: 400 });
    }

    // Build WHERE conditions
    const conditions = [];

    if (configId) {
      const parsedConfigId = parseInt(configId);
      if (isNaN(parsedConfigId) || parsedConfigId <= 0) {
        return NextResponse.json({
          error: 'Invalid configId. Must be a positive integer',
          code: 'INVALID_CONFIG_ID'
        }, { status: 400 });
      }
      conditions.push(eq(apiLogs.configId, parsedConfigId));
    }

    if (action) {
      conditions.push(eq(apiLogs.action, action));
    }

    if (status) {
      conditions.push(eq(apiLogs.status, status));
    }

    // Execute query with filters and sorting
    let query = db.select().from(apiLogs);

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(apiLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error,
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}