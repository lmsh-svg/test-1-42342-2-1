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

    const user = await db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
      hasLocalAccess: users.hasLocalAccess,
      storeName: users.storeName,
      storeLogo: users.storeLogo,
      storeMarkup: users.storeMarkup,
      totalSpent: users.totalSpent,
      cashbackBalance: users.cashbackBalance,
      subUsersEnabled: users.subUsersEnabled,
      credits: users.credits,
      createdAt: users.createdAt,
    })
      .from(users)
      .where(eq(users.id, parseInt(userId)))
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

    return NextResponse.json(user[0], { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + error
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { storeName, storeLogo, storeMarkup, subUsersEnabled } = body;

    // Validate storeMarkup if provided
    if (storeMarkup !== undefined) {
      const markupValue = parseFloat(storeMarkup);
      if (isNaN(markupValue) || markupValue < 0 || markupValue > 100) {
        return NextResponse.json(
          { 
            error: 'Store markup must be a number between 0 and 100',
            code: 'INVALID_STORE_MARKUP'
          },
          { status: 400 }
        );
      }
    }

    // Validate storeLogo if provided
    if (storeLogo !== undefined && storeLogo !== null && storeLogo !== '') {
      try {
        new URL(storeLogo);
      } catch {
        return NextResponse.json(
          { 
            error: 'Store logo must be a valid URL',
            code: 'INVALID_STORE_LOGO_URL'
          },
          { status: 400 }
        );
      }
    }

    // Check if user exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.id, parseInt(userId)))
      .limit(1);

    if (existingUser.length === 0) {
      return NextResponse.json(
        { 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, any> = {};
    
    if (storeName !== undefined) {
      updates.storeName = storeName === '' ? null : storeName;
    }
    
    if (storeLogo !== undefined) {
      updates.storeLogo = storeLogo === '' ? null : storeLogo;
    }
    
    if (storeMarkup !== undefined) {
      updates.storeMarkup = parseFloat(storeMarkup);
    }
    
    if (subUsersEnabled !== undefined) {
      updates.subUsersEnabled = Boolean(subUsersEnabled);
    }

    // Update user profile
    const updatedUser = await db.update(users)
      .set(updates)
      .where(eq(users.id, parseInt(userId)))
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        hasLocalAccess: users.hasLocalAccess,
        storeName: users.storeName,
        storeLogo: users.storeLogo,
        storeMarkup: users.storeMarkup,
        totalSpent: users.totalSpent,
        cashbackBalance: users.cashbackBalance,
        subUsersEnabled: users.subUsersEnabled,
        createdAt: users.createdAt,
      });

    if (updatedUser.length === 0) {
      return NextResponse.json(
        { 
          error: 'Failed to update user',
          code: 'UPDATE_FAILED'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedUser[0], { status: 200 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + error
      },
      { status: 500 }
    );
  }
}