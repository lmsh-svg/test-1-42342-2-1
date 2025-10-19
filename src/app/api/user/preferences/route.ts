import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userPreferences, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
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

    const userIdInt = parseInt(userId);

    // Verify user exists
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userIdInt))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Try to get existing preferences
    let preferences = await db.select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userIdInt))
      .limit(1);

    // Auto-create if doesn't exist
    if (preferences.length === 0) {
      const now = new Date().toISOString();
      const newPreferences = await db.insert(userPreferences)
        .values({
          userId: userIdInt,
          theme: 'light',
          createdAt: now,
          updatedAt: now
        })
        .returning();

      return NextResponse.json(newPreferences[0], { status: 200 });
    }

    return NextResponse.json(preferences[0], { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
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

    const userIdInt = parseInt(userId);

    // Verify user exists
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userIdInt))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { theme } = body;

    // Validate theme if provided
    if (theme !== undefined && theme !== 'light' && theme !== 'dark') {
      return NextResponse.json(
        { 
          error: 'Theme must be either "light" or "dark"',
          code: 'INVALID_THEME'
        },
        { status: 400 }
      );
    }

    // Check if preferences exist
    const existingPreferences = await db.select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userIdInt))
      .limit(1);

    const now = new Date().toISOString();

    // Auto-create if doesn't exist
    if (existingPreferences.length === 0) {
      const newPreferences = await db.insert(userPreferences)
        .values({
          userId: userIdInt,
          theme: theme || 'light',
          createdAt: now,
          updatedAt: now
        })
        .returning();

      return NextResponse.json(newPreferences[0], { status: 200 });
    }

    // Update existing preferences
    const updateData: { theme?: string; updatedAt: string } = {
      updatedAt: now
    };

    if (theme !== undefined) {
      updateData.theme = theme;
    }

    const updated = await db.update(userPreferences)
      .set(updateData)
      .where(eq(userPreferences.userId, userIdInt))
      .returning();

    return NextResponse.json(updated[0], { status: 200 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}