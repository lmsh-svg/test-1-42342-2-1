import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || isNaN(parseInt(userId))) {
      return NextResponse.json(
        { 
          error: 'Valid userId is required',
          code: 'INVALID_USER_ID'
        },
        { status: 400 }
      );
    }

    const userRecords = await db.select({
      id: users.id,
      credits: users.credits,
    })
      .from(users)
      .where(eq(users.id, parseInt(userId)))
      .limit(1);

    if (userRecords.length === 0) {
      return NextResponse.json(
        { 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      credits: userRecords[0].credits || 0 
    }, { status: 200 });
  } catch (error) {
    console.error('GET /api/user/credits error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + error
      },
      { status: 500 }
    );
  }
}