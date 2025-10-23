import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { productCorrections } from '@/db/schema';
import { eq, or, like, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (id) {
      if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const correction = await db.select()
        .from(productCorrections)
        .where(eq(productCorrections.id, parseInt(id)))
        .limit(1);

      if (correction.length === 0) {
        return NextResponse.json({ 
          error: 'Product correction not found',
          code: "NOT_FOUND" 
        }, { status: 404 });
      }

      return NextResponse.json(correction[0], { status: 200 });
    }

    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0');
    const search = searchParams.get('search');

    let query = db.select().from(productCorrections);

    if (search) {
      const searchTerm = `%${search}%`;
      query = query.where(
        or(
          like(productCorrections.sourceProductId, searchTerm),
          sql`${productCorrections.correctedCategory} LIKE ${searchTerm}`,
          sql`${productCorrections.correctedName} LIKE ${searchTerm}`
        )
      );
    }

    const results = await query
      .orderBy(desc(productCorrections.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error as Error).message 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceProductId, correctedCategory, correctedName, notes } = body;

    if (!sourceProductId || typeof sourceProductId !== 'string') {
      return NextResponse.json({ 
        error: "sourceProductId is required and must be a string",
        code: "MISSING_SOURCE_PRODUCT_ID" 
      }, { status: 400 });
    }

    const trimmedSourceProductId = sourceProductId.trim();
    if (trimmedSourceProductId === '') {
      return NextResponse.json({ 
        error: "sourceProductId cannot be empty",
        code: "EMPTY_SOURCE_PRODUCT_ID" 
      }, { status: 400 });
    }

    const trimmedCorrectedCategory = correctedCategory ? correctedCategory.trim() : null;
    const trimmedCorrectedName = correctedName ? correctedName.trim() : null;
    const trimmedNotes = notes ? notes.trim() : null;

    if (!trimmedCorrectedCategory && !trimmedCorrectedName) {
      return NextResponse.json({ 
        error: "At least one of correctedCategory or correctedName must be provided",
        code: "MISSING_CORRECTION_FIELDS" 
      }, { status: 400 });
    }

    const existingCorrection = await db.select()
      .from(productCorrections)
      .where(eq(productCorrections.sourceProductId, trimmedSourceProductId))
      .limit(1);

    if (existingCorrection.length > 0) {
      return NextResponse.json({ 
        error: "A correction for this sourceProductId already exists",
        code: "DUPLICATE_SOURCE_PRODUCT_ID" 
      }, { status: 409 });
    }

    const now = new Date().toISOString();
    const newCorrection = await db.insert(productCorrections)
      .values({
        sourceProductId: trimmedSourceProductId,
        correctedCategory: trimmedCorrectedCategory,
        correctedName: trimmedCorrectedName,
        notes: trimmedNotes,
        createdAt: now,
        updatedAt: now
      })
      .returning();

    return NextResponse.json(newCorrection[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error as Error).message 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const body = await request.json();

    if ('sourceProductId' in body) {
      return NextResponse.json({ 
        error: "sourceProductId cannot be updated after creation",
        code: "IMMUTABLE_FIELD" 
      }, { status: 400 });
    }

    const existingCorrection = await db.select()
      .from(productCorrections)
      .where(eq(productCorrections.id, parseInt(id)))
      .limit(1);

    if (existingCorrection.length === 0) {
      return NextResponse.json({ 
        error: 'Product correction not found',
        code: "NOT_FOUND" 
      }, { status: 404 });
    }

    const updates: {
      correctedCategory?: string | null;
      correctedName?: string | null;
      notes?: string | null;
      updatedAt: string;
    } = {
      updatedAt: new Date().toISOString()
    };

    if ('correctedCategory' in body) {
      updates.correctedCategory = body.correctedCategory ? body.correctedCategory.trim() : null;
    }

    if ('correctedName' in body) {
      updates.correctedName = body.correctedName ? body.correctedName.trim() : null;
    }

    if ('notes' in body) {
      updates.notes = body.notes ? body.notes.trim() : null;
    }

    const updated = await db.update(productCorrections)
      .set(updates)
      .where(eq(productCorrections.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0], { status: 200 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error as Error).message 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const existingCorrection = await db.select()
      .from(productCorrections)
      .where(eq(productCorrections.id, parseInt(id)))
      .limit(1);

    if (existingCorrection.length === 0) {
      return NextResponse.json({ 
        error: 'Product correction not found',
        code: "NOT_FOUND" 
      }, { status: 404 });
    }

    const deleted = await db.delete(productCorrections)
      .where(eq(productCorrections.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Product correction deleted successfully',
      correction: deleted[0]
    }, { status: 200 });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error as Error).message 
    }, { status: 500 });
  }
}