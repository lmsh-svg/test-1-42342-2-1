import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function POST() {
  try {
    // Delete existing admin user if exists
    console.log('🗑️  Deleting existing admin user...');
    await db.delete(users).where(eq(users.username, 'admin'));
    
    // Create admin user with bcrypt hashed password
    console.log('🔐 Hashing password with bcrypt...');
    const passwordHash = await bcrypt.hash('admin123', SALT_ROUNDS);
    
    console.log('👤 Creating new admin user...');
    const newAdmin = await db.insert(users)
      .values({
        username: 'admin',
        passwordHash: passwordHash,
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
      })
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
      });

    return NextResponse.json({ 
      message: 'Admin user initialized successfully',
      user: newAdmin[0],
      credentials: {
        username: 'admin',
        password: 'admin123'
      }
    });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize admin user: ' + error },
      { status: 500 }
    );
  }
}