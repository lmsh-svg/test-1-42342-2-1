import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { markups } from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single record fetch
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json(
          { error: 'Valid ID is required', code: 'INVALID_ID' },
          { status: 400 }
        );
      }

      const record = await db
        .select()
        .from(markups)
        .where(eq(markups.id, parseInt(id)))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json(
          { error: 'Record not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      return NextResponse.json(record[0], { status: 200 });
    }

    // List with pagination and filters
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const typeFilter = searchParams.get('type');
    const isActiveFilter = searchParams.get('isActive');

    let query = db.select().from(markups);

    // Apply filters
    const conditions = [];
    if (typeFilter) {
      conditions.push(eq(markups.type, typeFilter));
    }
    if (isActiveFilter !== null) {
      const isActive = isActiveFilter === 'true';
      conditions.push(eq(markups.isActive, isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Order by priority DESC, then createdAt DESC
    const results = await query
      .orderBy(desc(markups.priority), desc(markups.createdAt))
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
    const { name, type, targetId, markupType, markupValue, isActive, priority, startDate, endDate, compoundStrategy } = body;

    // Validation: name must be non-empty string
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name must be a non-empty string', code: 'INVALID_NAME' },
        { status: 400 }
      );
    }

    // Validation: type must be one of the allowed values
    if (!type || !['site_wide', 'category', 'product'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be one of: site_wide, category, product', code: 'INVALID_TYPE' },
        { status: 400 }
      );
    }

    // Validation: markupType must be one of the allowed values
    if (!markupType || !['percentage', 'fixed_amount'].includes(markupType)) {
      return NextResponse.json(
        { error: 'Markup type must be one of: percentage, fixed_amount', code: 'INVALID_MARKUP_TYPE' },
        { status: 400 }
      );
    }

    // Validation: markupValue must be provided
    if (markupValue === undefined || markupValue === null || typeof markupValue !== 'number') {
      return NextResponse.json(
        { error: 'Markup value must be a number', code: 'INVALID_MARKUP_VALUE' },
        { status: 400 }
      );
    }

    // Validation: markupValue range for percentage type
    if (markupType === 'percentage' && (markupValue < -100 || markupValue > 100)) {
      return NextResponse.json(
        { error: 'Percentage markup value must be between -100 and 100', code: 'INVALID_PERCENTAGE_RANGE' },
        { status: 400 }
      );
    }

    // Validation: targetId requirements based on type
    if ((type === 'category' || type === 'product') && (!targetId || targetId.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Target ID is required for category and product types', code: 'MISSING_TARGET_ID' },
        { status: 400 }
      );
    }

    if (type === 'site_wide' && targetId) {
      return NextResponse.json(
        { error: 'Target ID must be null for site_wide type', code: 'INVALID_TARGET_ID' },
        { status: 400 }
      );
    }

    // Validation: compoundStrategy must be valid
    if (compoundStrategy !== undefined && !['replace', 'add', 'multiply'].includes(compoundStrategy)) {
      return NextResponse.json(
        { error: 'Compound strategy must be one of: replace, add, multiply', code: 'INVALID_COMPOUND_STRATEGY' },
        { status: 400 }
      );
    }

    // Validation: date fields
    if (startDate !== undefined && startDate !== null && startDate !== '') {
      const startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        return NextResponse.json(
          { error: 'Start date must be a valid ISO date string', code: 'INVALID_START_DATE' },
          { status: 400 }
        );
      }
    }

    if (endDate !== undefined && endDate !== null && endDate !== '') {
      const endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        return NextResponse.json(
          { error: 'End date must be a valid ISO date string', code: 'INVALID_END_DATE' },
          { status: 400 }
        );
      }

      // Validate end date is after start date if both provided
      if (startDate) {
        const startDateObj = new Date(startDate);
        if (endDateObj <= startDateObj) {
          return NextResponse.json(
            { error: 'End date must be after start date', code: 'INVALID_DATE_RANGE' },
            { status: 400 }
          );
        }
      }
    }

    // Validation: Site-wide active constraint
    const isActiveValue = isActive !== undefined ? isActive : true;
    if (type === 'site_wide' && isActiveValue === true) {
      const existingActiveSiteWide = await db
        .select()
        .from(markups)
        .where(and(eq(markups.type, 'site_wide'), eq(markups.isActive, true)))
        .limit(1);

      if (existingActiveSiteWide.length > 0) {
        return NextResponse.json(
          { error: 'Only one site-wide markup can be active at a time', code: 'SITE_WIDE_ALREADY_ACTIVE' },
          { status: 400 }
        );
      }
    }

    // Prepare insert data
    const now = new Date().toISOString();
    const insertData = {
      name: name.trim(),
      type,
      targetId: type === 'site_wide' ? null : targetId?.trim(),
      markupType,
      markupValue,
      isActive: isActiveValue,
      priority: priority !== undefined ? priority : 0,
      startDate: startDate || null,
      endDate: endDate || null,
      compoundStrategy: compoundStrategy || 'replace',
      createdAt: now,
      updatedAt: now,
    };

    const newRecord = await db.insert(markups).values(insertData).returning();

    return NextResponse.json(newRecord[0], { status: 201 });
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Check if record exists
    const existing = await db
      .select()
      .from(markups)
      .where(eq(markups.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Record not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, type, targetId, markupType, markupValue, isActive, priority, startDate, endDate, compoundStrategy } = body;

    const updates: any = {};

    // Validation: name
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Name must be a non-empty string', code: 'INVALID_NAME' },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }

    // Validation: type
    if (type !== undefined) {
      if (!['site_wide', 'category', 'product'].includes(type)) {
        return NextResponse.json(
          { error: 'Type must be one of: site_wide, category, product', code: 'INVALID_TYPE' },
          { status: 400 }
        );
      }
      updates.type = type;
    }

    // Validation: markupType
    if (markupType !== undefined) {
      if (!['percentage', 'fixed_amount'].includes(markupType)) {
        return NextResponse.json(
          { error: 'Markup type must be one of: percentage, fixed_amount', code: 'INVALID_MARKUP_TYPE' },
          { status: 400 }
        );
      }
      updates.markupType = markupType;
    }

    // Validation: markupValue
    if (markupValue !== undefined) {
      if (typeof markupValue !== 'number') {
        return NextResponse.json(
          { error: 'Markup value must be a number', code: 'INVALID_MARKUP_VALUE' },
          { status: 400 }
        );
      }

      const finalMarkupType = markupType || existing[0].markupType;
      if (finalMarkupType === 'percentage' && (markupValue < -100 || markupValue > 100)) {
        return NextResponse.json(
          { error: 'Percentage markup value must be between -100 and 100', code: 'INVALID_PERCENTAGE_RANGE' },
          { status: 400 }
        );
      }
      updates.markupValue = markupValue;
    }

    // Validation: targetId requirements
    const finalType = type || existing[0].type;
    if (targetId !== undefined) {
      if ((finalType === 'category' || finalType === 'product') && (!targetId || targetId.trim().length === 0)) {
        return NextResponse.json(
          { error: 'Target ID is required for category and product types', code: 'MISSING_TARGET_ID' },
          { status: 400 }
        );
      }

      if (finalType === 'site_wide' && targetId) {
        return NextResponse.json(
          { error: 'Target ID must be null for site_wide type', code: 'INVALID_TARGET_ID' },
          { status: 400 }
        );
      }

      updates.targetId = finalType === 'site_wide' ? null : targetId?.trim();
    }

    // Handle type change validation for targetId
    if (type !== undefined && type !== existing[0].type) {
      if ((type === 'category' || type === 'product') && !existing[0].targetId && targetId === undefined) {
        return NextResponse.json(
          { error: 'Target ID is required for category and product types', code: 'MISSING_TARGET_ID' },
          { status: 400 }
        );
      }

      if (type === 'site_wide') {
        updates.targetId = null;
      }
    }

    // Validation: compoundStrategy
    if (compoundStrategy !== undefined) {
      if (!['replace', 'add', 'multiply'].includes(compoundStrategy)) {
        return NextResponse.json(
          { error: 'Compound strategy must be one of: replace, add, multiply', code: 'INVALID_COMPOUND_STRATEGY' },
          { status: 400 }
        );
      }
      updates.compoundStrategy = compoundStrategy;
    }

    // Validation: date fields
    if (startDate !== undefined) {
      if (startDate === null || startDate === '') {
        updates.startDate = null;
      } else {
        const startDateObj = new Date(startDate);
        if (isNaN(startDateObj.getTime())) {
          return NextResponse.json(
            { error: 'Start date must be a valid ISO date string', code: 'INVALID_START_DATE' },
            { status: 400 }
          );
        }
        updates.startDate = startDate;
      }
    }

    if (endDate !== undefined) {
      if (endDate === null || endDate === '') {
        updates.endDate = null;
      } else {
        const endDateObj = new Date(endDate);
        if (isNaN(endDateObj.getTime())) {
          return NextResponse.json(
            { error: 'End date must be a valid ISO date string', code: 'INVALID_END_DATE' },
            { status: 400 }
          );
        }

        // Validate end date is after start date
        const finalStartDate = updates.startDate !== undefined ? updates.startDate : existing[0].startDate;
        if (finalStartDate) {
          const startDateObj = new Date(finalStartDate);
          if (endDateObj <= startDateObj) {
            return NextResponse.json(
              { error: 'End date must be after start date', code: 'INVALID_DATE_RANGE' },
              { status: 400 }
            );
          }
        }
        updates.endDate = endDate;
      }
    }

    // Validation: isActive
    if (isActive !== undefined) {
      updates.isActive = isActive;
    }

    const finalIsActive = isActive !== undefined ? isActive : existing[0].isActive;
    if (finalType === 'site_wide' && finalIsActive === true) {
      const existingActiveSiteWide = await db
        .select()
        .from(markups)
        .where(and(eq(markups.type, 'site_wide'), eq(markups.isActive, true)))
        .limit(1);

      if (existingActiveSiteWide.length > 0 && existingActiveSiteWide[0].id !== parseInt(id)) {
        return NextResponse.json(
          { error: 'Only one site-wide markup can be active at a time', code: 'SITE_WIDE_ALREADY_ACTIVE' },
          { status: 400 }
        );
      }
    }

    // Priority
    if (priority !== undefined) {
      updates.priority = priority;
    }

    // Always update updatedAt
    updates.updatedAt = new Date().toISOString();

    const updated = await db
      .update(markups)
      .set(updates)
      .where(eq(markups.id, parseInt(id)))
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Check if record exists
    const existing = await db
      .select()
      .from(markups)
      .where(eq(markups.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Record not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const deleted = await db
      .delete(markups)
      .where(eq(markups.id, parseInt(id)))
      .returning();

    return NextResponse.json(
      {
        message: 'Record deleted successfully',
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