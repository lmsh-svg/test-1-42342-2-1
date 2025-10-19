import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { generateSessionToken } from '@/lib/auth';

// In-memory session store (in production, use Redis or database)
const sessions = new Map<string, {
  userId: number;
  username: string;
  role: string;
  expiresAt: number;
}>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required', code: 'MISSING_CREDENTIALS' },
        { status: 400 }
      );
    }

    // Find user by username
    const user = await db.select()
      .from(users)
      .where(eq(users.username, username.toLowerCase().trim()))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const foundUser = user[0];

    // Check if user is active
    if (!foundUser.isActive) {
      return NextResponse.json(
        { error: 'Account is disabled', code: 'ACCOUNT_DISABLED' },
        { status: 403 }
      );
    }

    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, foundUser.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    // Generate session token
    const sessionToken = generateSessionToken();
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

    // Store session
    sessions.set(sessionToken, {
      userId: foundUser.id,
      username: foundUser.username,
      role: foundUser.role,
      expiresAt,
    });

    // Return session data
    return NextResponse.json({
      token: sessionToken,
      user: {
        id: foundUser.id,
        username: foundUser.username,
        role: foundUser.role,
      },
      expiresAt,
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// Validate session endpoint
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No token provided', code: 'NO_TOKEN' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const session = sessions.get(token);

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    if (Date.now() > session.expiresAt) {
      sessions.delete(token);
      return NextResponse.json(
        { error: 'Token expired', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: session.userId,
        username: session.username,
        role: session.role,
      },
    });

  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}