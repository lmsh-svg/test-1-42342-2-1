import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, like, or, desc } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // Single user by ID
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const user = await db.select({
        id: users.id,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        hasLocalAccess: users.hasLocalAccess,
        createdAt: users.createdAt,
      })
        .from(users)
        .where(eq(users.id, parseInt(id)))
        .limit(1);

      if (user.length === 0) {
        return NextResponse.json({ 
          error: 'User not found',
          code: "USER_NOT_FOUND" 
        }, { status: 404 });
      }

      return NextResponse.json(user[0], { status: 200 });
    }

    // List with pagination and search
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');

    let query = db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
      hasLocalAccess: users.hasLocalAccess,
      createdAt: users.createdAt,
    }).from(users);

    if (search) {
      const searchTerm = `%${search}%`;
      query = query.where(like(users.username, searchTerm));
    }

    const results = await query
      .orderBy(desc(users.createdAt))
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
    const { username, passwordHash, role, isActive } = body;

    // Validate required fields
    if (!username) {
      return NextResponse.json({ 
        error: "Username is required",
        code: "MISSING_USERNAME" 
      }, { status: 400 });
    }

    if (!passwordHash) {
      return NextResponse.json({ 
        error: "Password hash is required",
        code: "MISSING_PASSWORD_HASH" 
      }, { status: 400 });
    }

    // Sanitize inputs
    const sanitizedUsername = username.trim().toLowerCase();

    // Validate username format (alphanumeric, underscore, hyphen)
    const usernameRegex = /^[a-z0-9_-]{3,20}$/;
    if (!usernameRegex.test(sanitizedUsername)) {
      return NextResponse.json({ 
        error: "Username must be 3-20 characters and contain only letters, numbers, underscore, or hyphen",
        code: "INVALID_USERNAME_FORMAT" 
      }, { status: 400 });
    }

    // Validate role if provided
    const validRoles = ['admin', 'customer'];
    const userRole = role || 'customer';
    if (!validRoles.includes(userRole)) {
      return NextResponse.json({ 
        error: "Role must be either 'admin' or 'customer'",
        code: "INVALID_ROLE" 
      }, { status: 400 });
    }

    // Check for username uniqueness
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.username, sanitizedUsername))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json({ 
        error: "Username already exists",
        code: "USERNAME_ALREADY_EXISTS" 
      }, { status: 409 });
    }

    // Hash the password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(passwordHash, 10);

    // Create new user
    const newUser = await db.insert(users)
      .values({
        username: sanitizedUsername,
        passwordHash: hashedPassword,
        role: userRole,
        isActive: isActive !== undefined ? isActive : true,
        createdAt: new Date().toISOString(),
      })
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return NextResponse.json(newUser[0], { status: 201 });
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
    const { username, role, isActive } = body;

    // Check if user exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.id, parseInt(id)))
      .limit(1);

    if (existingUser.length === 0) {
      return NextResponse.json({ 
        error: 'User not found',
        code: "USER_NOT_FOUND" 
      }, { status: 404 });
    }

    // Prepare update object
    const updates: any = {};

    if (username !== undefined) {
      const sanitizedUsername = username.trim().toLowerCase();
      
      // Validate username format
      const usernameRegex = /^[a-z0-9_-]{3,20}$/;
      if (!usernameRegex.test(sanitizedUsername)) {
        return NextResponse.json({ 
          error: "Username must be 3-20 characters and contain only letters, numbers, underscore, or hyphen",
          code: "INVALID_USERNAME_FORMAT" 
        }, { status: 400 });
      }

      // Check username uniqueness if changed
      if (sanitizedUsername !== existingUser[0].username) {
        const usernameExists = await db.select()
          .from(users)
          .where(eq(users.username, sanitizedUsername))
          .limit(1);

        if (usernameExists.length > 0) {
          return NextResponse.json({ 
            error: "Username already exists",
            code: "USERNAME_ALREADY_EXISTS" 
          }, { status: 409 });
        }
      }

      updates.username = sanitizedUsername;
    }

    if (role !== undefined) {
      const validRoles = ['admin', 'customer'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ 
          error: "Role must be either 'admin' or 'customer'",
          code: "INVALID_ROLE" 
        }, { status: 400 });
      }
      updates.role = role;
    }

    if (isActive !== undefined) {
      updates.isActive = isActive;
    }

    // If no fields to update
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ 
        error: "No valid fields to update",
        code: "NO_UPDATE_FIELDS" 
      }, { status: 400 });
    }

    // Update user
    const updatedUser = await db.update(users)
      .set(updates)
      .where(eq(users.id, parseInt(id)))
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    if (updatedUser.length === 0) {
      return NextResponse.json({ 
        error: 'User not found',
        code: "USER_NOT_FOUND" 
      }, { status: 404 });
    }

    return NextResponse.json(updatedUser[0], { status: 200 });
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

    // Check if user exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.id, parseInt(id)))
      .limit(1);

    if (existingUser.length === 0) {
      return NextResponse.json({ 
        error: 'User not found',
        code: "USER_NOT_FOUND" 
      }, { status: 404 });
    }

    // Soft delete: set isActive to false
    const softDeleted = await db.update(users)
      .set({ isActive: false })
      .where(eq(users.id, parseInt(id)))
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    if (softDeleted.length === 0) {
      return NextResponse.json({ 
        error: 'User not found',
        code: "USER_NOT_FOUND" 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'User deactivated successfully',
      user: softDeleted[0]
    }, { status: 200 });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}