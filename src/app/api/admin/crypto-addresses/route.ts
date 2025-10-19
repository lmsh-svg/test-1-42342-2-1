import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { cryptoWalletAddresses } from '@/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const cryptocurrency = searchParams.get('cryptocurrency');
    const isActiveParam = searchParams.get('isActive');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Single record by ID
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json(
          { error: 'Valid ID is required', code: 'INVALID_ID' },
          { status: 400 }
        );
      }

      const record = await db
        .select()
        .from(cryptoWalletAddresses)
        .where(eq(cryptoWalletAddresses.id, parseInt(id)))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json(
          { error: 'Crypto wallet address not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(record[0], { status: 200 });
    }

    // List with filters and pagination
    let query = db.select().from(cryptoWalletAddresses);

    // Build where conditions
    const conditions = [];
    
    if (cryptocurrency) {
      conditions.push(eq(cryptoWalletAddresses.cryptocurrency, cryptocurrency.toLowerCase()));
    }

    if (isActiveParam !== null) {
      const isActive = isActiveParam === 'true';
      conditions.push(eq(cryptoWalletAddresses.isActive, isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Sort by cryptocurrency alphabetically, then by createdAt descending
    const results = await query
      .orderBy(asc(cryptoWalletAddresses.cryptocurrency), desc(cryptoWalletAddresses.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cryptocurrency, address, label, logoUrl, isActive } = body;

    // Validate required fields
    if (!cryptocurrency || typeof cryptocurrency !== 'string' || cryptocurrency.trim() === '') {
      return NextResponse.json(
        { error: 'Cryptocurrency is required and must be a non-empty string', code: 'INVALID_CRYPTOCURRENCY' },
        { status: 400 }
      );
    }

    if (!address || typeof address !== 'string' || address.trim() === '') {
      return NextResponse.json(
        { error: 'Address is required and must be a non-empty string', code: 'INVALID_ADDRESS' },
        { status: 400 }
      );
    }

    // Validate isActive if provided
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive must be a boolean', code: 'INVALID_IS_ACTIVE' },
        { status: 400 }
      );
    }

    // Validate logoUrl if provided
    if (logoUrl !== undefined && logoUrl !== null && logoUrl !== '') {
      if (typeof logoUrl !== 'string') {
        return NextResponse.json(
          { error: 'logoUrl must be a string', code: 'INVALID_LOGO_URL' },
          { status: 400 }
        );
      }
      // Validate URL format
      try {
        new URL(logoUrl);
      } catch {
        return NextResponse.json(
          { error: 'logoUrl must be a valid URL', code: 'INVALID_LOGO_URL_FORMAT' },
          { status: 400 }
        );
      }
    }

    // Normalize cryptocurrency to lowercase
    const normalizedCrypto = cryptocurrency.trim().toLowerCase();
    const trimmedAddress = address.trim();

    // Check if wallet address already exists for this cryptocurrency
    const existing = await db
      .select()
      .from(cryptoWalletAddresses)
      .where(eq(cryptoWalletAddresses.cryptocurrency, normalizedCrypto))
      .limit(1);

    const now = new Date().toISOString();

    if (existing.length > 0) {
      // Update existing record
      const updated = await db
        .update(cryptoWalletAddresses)
        .set({
          address: trimmedAddress,
          label: label?.trim() || existing[0].label,
          logoUrl: logoUrl !== undefined ? (logoUrl ? logoUrl.trim() : null) : existing[0].logoUrl,
          isActive: isActive !== undefined ? isActive : existing[0].isActive,
          updatedAt: now,
        })
        .where(eq(cryptoWalletAddresses.cryptocurrency, normalizedCrypto))
        .returning();

      return NextResponse.json(updated[0], { status: 200 });
    } else {
      // Create new record
      const newRecord = await db
        .insert(cryptoWalletAddresses)
        .values({
          cryptocurrency: normalizedCrypto,
          address: trimmedAddress,
          label: label?.trim() || null,
          logoUrl: logoUrl ? logoUrl.trim() : null,
          isActive: isActive !== undefined ? isActive : true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return NextResponse.json(newRecord[0], { status: 201 });
    }
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { address, label, logoUrl, isActive } = body;

    // Validate address if provided
    if (address !== undefined && (typeof address !== 'string' || address.trim() === '')) {
      return NextResponse.json(
        { error: 'Address must be a non-empty string', code: 'INVALID_ADDRESS' },
        { status: 400 }
      );
    }

    // Validate isActive if provided
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive must be a boolean', code: 'INVALID_IS_ACTIVE' },
        { status: 400 }
      );
    }

    // Validate logoUrl if provided
    if (logoUrl !== undefined && logoUrl !== null && logoUrl !== '') {
      if (typeof logoUrl !== 'string') {
        return NextResponse.json(
          { error: 'logoUrl must be a string', code: 'INVALID_LOGO_URL' },
          { status: 400 }
        );
      }
      // Validate URL format
      try {
        new URL(logoUrl);
      } catch {
        return NextResponse.json(
          { error: 'logoUrl must be a valid URL', code: 'INVALID_LOGO_URL_FORMAT' },
          { status: 400 }
        );
      }
    }

    // Check if record exists
    const existing = await db
      .select()
      .from(cryptoWalletAddresses)
      .where(eq(cryptoWalletAddresses.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Crypto wallet address not found' },
        { status: 404 }
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (address !== undefined) {
      updates.address = address.trim();
    }

    if (label !== undefined) {
      updates.label = label?.trim() || null;
    }

    if (logoUrl !== undefined) {
      updates.logoUrl = logoUrl ? logoUrl.trim() : null;
    }

    if (isActive !== undefined) {
      updates.isActive = isActive;
    }

    // Update record
    const updated = await db
      .update(cryptoWalletAddresses)
      .set(updates)
      .where(eq(cryptoWalletAddresses.id, parseInt(id)))
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

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Check if record exists
    const existing = await db
      .select()
      .from(cryptoWalletAddresses)
      .where(eq(cryptoWalletAddresses.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Crypto wallet address not found' },
        { status: 404 }
      );
    }

    // Delete record
    const deleted = await db
      .delete(cryptoWalletAddresses)
      .where(eq(cryptoWalletAddresses.id, parseInt(id)))
      .returning();

    return NextResponse.json(
      {
        message: 'Crypto wallet address deleted successfully',
        deleted: deleted[0],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}