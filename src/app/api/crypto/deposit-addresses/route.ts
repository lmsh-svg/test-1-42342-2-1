import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { cryptoWalletAddresses } from '@/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const currency = searchParams.get('currency');
    const activeOnly = searchParams.get('activeOnly') !== 'false'; // Default to true

    // Build query
    let query = db.select().from(cryptoWalletAddresses);

    // Build conditions array
    const conditions = [];

    // Filter by currency (case-insensitive)
    if (currency) {
      conditions.push(
        sql`lower(${cryptoWalletAddresses.cryptocurrency}) = lower(${currency})`
      );
    }

    // Filter by active status
    if (activeOnly) {
      conditions.push(eq(cryptoWalletAddresses.isActive, true));
    }

    // Apply conditions if any exist
    if (conditions.length > 0) {
      query = query.where(
        conditions.length === 1 
          ? conditions[0] 
          : and(...conditions)
      );
    }

    // Order by cryptocurrency ascending for consistent ordering
    const results = await query.orderBy(asc(cryptoWalletAddresses.cryptocurrency));

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + error,
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}