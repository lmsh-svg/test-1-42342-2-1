import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Validate ID parameter
    if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
      return NextResponse.json(
        { 
          error: 'Valid user ID is required',
          code: 'INVALID_ID'
        },
        { status: 400 }
      );
    }

    const userId = parseInt(id);

    // Check if user exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.id, userId))
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

    const currentUser = existingUser[0];

    // Toggle hasLocalAccess
    const newHasLocalAccess = !currentUser.hasLocalAccess;

    // Update user with toggled value
    const updatedUser = await db.update(users)
      .set({
        hasLocalAccess: newHasLocalAccess
      })
      .where(eq(users.id, userId))
      .returning();

    if (updatedUser.length === 0) {
      return NextResponse.json(
        { 
          error: 'Failed to update user',
          code: 'UPDATE_FAILED'
        },
        { status: 500 }
      );
    }

    // Return response without passwordHash
    const { passwordHash, ...userWithoutPassword } = updatedUser[0];

    return NextResponse.json(
      {
        message: 'Local access updated successfully',
        user: userWithoutPassword
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('PUT /api/users/toggle-local-access error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + error,
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}