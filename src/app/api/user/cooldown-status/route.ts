import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userIdParam = searchParams.get('userId');

    // Validate userId is provided
    if (!userIdParam) {
      return NextResponse.json(
        { 
          error: 'User ID is required',
          code: 'MISSING_USER_ID' 
        },
        { status: 400 }
      );
    }

    // Validate userId is a valid positive integer
    const userId = parseInt(userIdParam);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json(
        { 
          error: 'Valid positive integer User ID is required',
          code: 'INVALID_USER_ID' 
        },
        { status: 400 }
      );
    }

    // Fetch the user from the database
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Return 404 if user not found
    if (user.length === 0) {
      return NextResponse.json(
        { 
          error: 'User not found',
          code: 'USER_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    const userData = user[0];
    const lastCancelledDepositAt = userData.lastCancelledDepositAt;

    // If lastCancelledDepositAt is null, no cooldown is active
    if (!lastCancelledDepositAt) {
      return NextResponse.json({
        hasCooldown: false,
        cooldownEndsAt: null,
        remainingMinutes: null
      });
    }

    // Calculate cooldown end time (lastCancelledDepositAt + 1 hour)
    const COOLDOWN_DURATION_MS = 3600000; // 1 hour in milliseconds
    const lastCancelledDate = new Date(lastCancelledDepositAt);
    const cooldownEndsAtDate = new Date(lastCancelledDate.getTime() + COOLDOWN_DURATION_MS);
    const currentTime = new Date();

    // Check if cooldown is still active
    const hasCooldown = cooldownEndsAtDate > currentTime;

    if (hasCooldown) {
      // Calculate remaining time in minutes
      const remainingMs = cooldownEndsAtDate.getTime() - currentTime.getTime();
      const remainingMinutes = Math.ceil(remainingMs / 60000); // Convert ms to minutes and round up

      return NextResponse.json({
        hasCooldown: true,
        cooldownEndsAt: cooldownEndsAtDate.toISOString(),
        remainingMinutes: remainingMinutes
      });
    } else {
      // Cooldown has expired
      return NextResponse.json({
        hasCooldown: false,
        cooldownEndsAt: null,
        remainingMinutes: null
      });
    }

  } catch (error) {
    console.error('GET /api/user/cooldown-status error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + error,
        code: 'INTERNAL_SERVER_ERROR' 
      },
      { status: 500 }
    );
  }
}