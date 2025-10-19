import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { incomingVerifications } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse and validate pagination parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    if (isNaN(limit) || limit < 1) {
      return NextResponse.json({ 
        error: 'Invalid limit parameter. Must be a positive integer.',
        code: 'INVALID_LIMIT' 
      }, { status: 400 });
    }

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json({ 
        error: 'Invalid offset parameter. Must be a non-negative integer.',
        code: 'INVALID_OFFSET' 
      }, { status: 400 });
    }

    // Parse filter parameters
    const currency = searchParams.get('currency');
    const confirmedParam = searchParams.get('confirmed');
    const creditedParam = searchParams.get('credited');
    const userIdParam = searchParams.get('userId');
    const status = searchParams.get('status');

    // Validate currency if provided
    if (currency && !['BTC', 'ETH', 'DOGE'].includes(currency.toUpperCase())) {
      return NextResponse.json({ 
        error: 'Invalid currency. Must be one of: BTC, ETH, DOGE',
        code: 'INVALID_CURRENCY' 
      }, { status: 400 });
    }

    // Validate confirmed parameter if provided
    if (confirmedParam && !['true', 'false'].includes(confirmedParam.toLowerCase())) {
      return NextResponse.json({ 
        error: 'Invalid confirmed parameter. Must be "true" or "false"',
        code: 'INVALID_CONFIRMED' 
      }, { status: 400 });
    }

    // Validate credited parameter if provided
    if (creditedParam && !['true', 'false'].includes(creditedParam.toLowerCase())) {
      return NextResponse.json({ 
        error: 'Invalid credited parameter. Must be "true" or "false"',
        code: 'INVALID_CREDITED' 
      }, { status: 400 });
    }

    // Validate status parameter if provided
    if (status && !['pending', 'confirmed', 'credited'].includes(status.toLowerCase())) {
      return NextResponse.json({ 
        error: 'Invalid status parameter. Must be one of: pending, confirmed, credited',
        code: 'INVALID_STATUS' 
      }, { status: 400 });
    }

    // Validate userId parameter if provided
    if (userIdParam && (isNaN(parseInt(userIdParam)) || parseInt(userIdParam) < 1)) {
      return NextResponse.json({ 
        error: 'Invalid userId parameter. Must be a positive integer.',
        code: 'INVALID_USER_ID' 
      }, { status: 400 });
    }

    // Build filter conditions
    const conditions = [];

    // Currency filter
    if (currency) {
      conditions.push(eq(incomingVerifications.currency, currency.toUpperCase()));
    }

    // Status filter (takes precedence over individual confirmed/credited filters)
    if (status) {
      const statusLower = status.toLowerCase();
      if (statusLower === 'pending') {
        conditions.push(eq(incomingVerifications.confirmed, false));
      } else if (statusLower === 'confirmed') {
        conditions.push(eq(incomingVerifications.confirmed, true));
        conditions.push(eq(incomingVerifications.credited, false));
      } else if (statusLower === 'credited') {
        conditions.push(eq(incomingVerifications.credited, true));
      }
    } else {
      // Individual confirmed filter (only if status not provided)
      if (confirmedParam !== null) {
        const confirmedBool = confirmedParam.toLowerCase() === 'true';
        conditions.push(eq(incomingVerifications.confirmed, confirmedBool));
      }

      // Individual credited filter (only if status not provided)
      if (creditedParam !== null) {
        const creditedBool = creditedParam.toLowerCase() === 'true';
        conditions.push(eq(incomingVerifications.credited, creditedBool));
      }
    }

    // User ID filter
    if (userIdParam) {
      conditions.push(eq(incomingVerifications.userId, parseInt(userIdParam)));
    }

    // Build and execute query
    let query = db.select().from(incomingVerifications);

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(incomingVerifications.createdAt))
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