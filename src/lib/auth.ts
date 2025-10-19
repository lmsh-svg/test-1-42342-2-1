import bcrypt from 'bcrypt';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Hardcoded admin credentials - CHANGE THESE IN PRODUCTION
export const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123',
};

// Session management
export interface Session {
  userId: number;
  username: string;
  role: string;
  token: string;
  expiresAt: number;
}

// Create a session token
export function generateSessionToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Initialize admin user if doesn't exist
export async function initializeAdminUser() {
  try {
    const existingAdmin = await db.select()
      .from(users)
      .where(eq(users.username, ADMIN_CREDENTIALS.username))
      .limit(1);

    if (existingAdmin.length === 0) {
      const passwordHash = await hashPassword(ADMIN_CREDENTIALS.password);
      
      await db.insert(users).values({
        username: ADMIN_CREDENTIALS.username,
        passwordHash: passwordHash,
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
      });

      console.log('✅ Admin user initialized');
    }
  } catch (error) {
    console.error('Error initializing admin user:', error);
  }
}

// Validate session token
export function validateSession(token: string, sessions: Map<string, Session>): Session | null {
  const session = sessions.get(token);
  
  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return session;
}