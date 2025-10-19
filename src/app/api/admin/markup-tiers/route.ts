import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { markupTiers, markups } from '@/db/schema';
import { eq, and, or, asc, lte, gte, lt, gt, ne } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const markupId = searchParams.get('markupId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Single record by ID
    if (id) {
      const parsedId = parseInt(id);
      if (isNaN(parsedId)) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const tier = await db.select()
        .from(markupTiers)
        .where(eq(markupTiers.id, parsedId))
        .limit(1);

      if (tier.length === 0) {
        return NextResponse.json({ 
          error: 'Markup tier not found',
          code: "TIER_NOT_FOUND" 
        }, { status: 404 });
      }

      return NextResponse.json(tier[0]);
    }

    // List with markupId filter
    if (markupId) {
      const parsedMarkupId = parseInt(markupId);
      if (isNaN(parsedMarkupId)) {
        return NextResponse.json({ 
          error: "Valid markup ID is required",
          code: "INVALID_MARKUP_ID" 
        }, { status: 400 });
      }

      const tiers = await db.select()
        .from(markupTiers)
        .where(eq(markupTiers.markupId, parsedMarkupId))
        .orderBy(asc(markupTiers.minQuantity));

      return NextResponse.json(tiers);
    }

    // List all with pagination
    const tiers = await db.select()
      .from(markupTiers)
      .orderBy(asc(markupTiers.minQuantity))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(tiers);
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
    const { markupId, minQuantity, maxQuantity, markupValue } = body;

    // Validate required fields
    if (!markupId) {
      return NextResponse.json({ 
        error: "Markup ID is required",
        code: "MISSING_MARKUP_ID" 
      }, { status: 400 });
    }

    if (minQuantity === undefined || minQuantity === null) {
      return NextResponse.json({ 
        error: "Minimum quantity is required",
        code: "MISSING_MIN_QUANTITY" 
      }, { status: 400 });
    }

    if (markupValue === undefined || markupValue === null) {
      return NextResponse.json({ 
        error: "Markup value is required",
        code: "MISSING_MARKUP_VALUE" 
      }, { status: 400 });
    }

    // Validate markupId is valid integer
    const parsedMarkupId = parseInt(markupId);
    if (isNaN(parsedMarkupId)) {
      return NextResponse.json({ 
        error: "Markup ID must be a valid integer",
        code: "INVALID_MARKUP_ID" 
      }, { status: 400 });
    }

    // Validate minQuantity is positive integer >= 1
    const parsedMinQuantity = parseInt(minQuantity);
    if (isNaN(parsedMinQuantity) || parsedMinQuantity < 1) {
      return NextResponse.json({ 
        error: "Minimum quantity must be a positive integer >= 1",
        code: "INVALID_MIN_QUANTITY" 
      }, { status: 400 });
    }

    // Validate maxQuantity if provided
    let parsedMaxQuantity = null;
    if (maxQuantity !== undefined && maxQuantity !== null) {
      parsedMaxQuantity = parseInt(maxQuantity);
      if (isNaN(parsedMaxQuantity)) {
        return NextResponse.json({ 
          error: "Maximum quantity must be a valid integer",
          code: "INVALID_MAX_QUANTITY" 
        }, { status: 400 });
      }

      if (parsedMaxQuantity <= parsedMinQuantity) {
        return NextResponse.json({ 
          error: "Maximum quantity must be greater than minimum quantity",
          code: "INVALID_QUANTITY_RANGE" 
        }, { status: 400 });
      }
    }

    // Validate markupValue is valid number
    const parsedMarkupValue = parseFloat(markupValue);
    if (isNaN(parsedMarkupValue)) {
      return NextResponse.json({ 
        error: "Markup value must be a valid number",
        code: "INVALID_MARKUP_VALUE" 
      }, { status: 400 });
    }

    // Check if markupId exists in markups table
    const markupExists = await db.select()
      .from(markups)
      .where(eq(markups.id, parsedMarkupId))
      .limit(1);

    if (markupExists.length === 0) {
      return NextResponse.json({ 
        error: "Markup not found",
        code: "MARKUP_NOT_FOUND" 
      }, { status: 404 });
    }

    // Check for overlapping quantity ranges for the same markupId
    const existingTiers = await db.select()
      .from(markupTiers)
      .where(eq(markupTiers.markupId, parsedMarkupId));

    for (const tier of existingTiers) {
      const tierMin = tier.minQuantity;
      const tierMax = tier.maxQuantity;

      // Check if ranges overlap
      const newMin = parsedMinQuantity;
      const newMax = parsedMaxQuantity;

      // If new tier has no max (infinite), check if it overlaps with any tier
      if (newMax === null) {
        // New tier starts within an existing tier's range
        if (tierMax === null && tierMin <= newMin) {
          return NextResponse.json({ 
            error: "Quantity range overlaps with existing tier",
            code: "OVERLAPPING_RANGE" 
          }, { status: 400 });
        }
        if (tierMax !== null && tierMin <= newMin && newMin <= tierMax) {
          return NextResponse.json({ 
            error: "Quantity range overlaps with existing tier",
            code: "OVERLAPPING_RANGE" 
          }, { status: 400 });
        }
      } else {
        // New tier has a max value
        if (tierMax === null) {
          // Existing tier has no max, check if new tier overlaps
          if (tierMin <= newMax) {
            return NextResponse.json({ 
              error: "Quantity range overlaps with existing tier",
              code: "OVERLAPPING_RANGE" 
            }, { status: 400 });
          }
        } else {
          // Both have max values, check for overlap
          if (!(newMax < tierMin || newMin > tierMax)) {
            return NextResponse.json({ 
              error: "Quantity range overlaps with existing tier",
              code: "OVERLAPPING_RANGE" 
            }, { status: 400 });
          }
        }
      }
    }

    // Create new tier
    const newTier = await db.insert(markupTiers)
      .values({
        markupId: parsedMarkupId,
        minQuantity: parsedMinQuantity,
        maxQuantity: parsedMaxQuantity,
        markupValue: parsedMarkupValue,
        createdAt: new Date().toISOString()
      })
      .returning();

    return NextResponse.json(newTier[0], { status: 201 });
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

    if (!id) {
      return NextResponse.json({ 
        error: "ID parameter is required",
        code: "MISSING_ID" 
      }, { status: 400 });
    }

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if tier exists
    const existingTier = await db.select()
      .from(markupTiers)
      .where(eq(markupTiers.id, parsedId))
      .limit(1);

    if (existingTier.length === 0) {
      return NextResponse.json({ 
        error: 'Markup tier not found',
        code: "TIER_NOT_FOUND" 
      }, { status: 404 });
    }

    const body = await request.json();
    const { minQuantity, maxQuantity, markupValue, markupId } = body;

    // Prevent updating markupId
    if (markupId !== undefined) {
      return NextResponse.json({ 
        error: "Markup ID cannot be updated",
        code: "MARKUP_ID_IMMUTABLE" 
      }, { status: 400 });
    }

    const updates: any = {};

    // Validate and add minQuantity if provided
    if (minQuantity !== undefined) {
      const parsedMinQuantity = parseInt(minQuantity);
      if (isNaN(parsedMinQuantity) || parsedMinQuantity < 1) {
        return NextResponse.json({ 
          error: "Minimum quantity must be a positive integer >= 1",
          code: "INVALID_MIN_QUANTITY" 
        }, { status: 400 });
      }
      updates.minQuantity = parsedMinQuantity;
    }

    // Validate and add maxQuantity if provided
    if (maxQuantity !== undefined) {
      if (maxQuantity === null) {
        updates.maxQuantity = null;
      } else {
        const parsedMaxQuantity = parseInt(maxQuantity);
        if (isNaN(parsedMaxQuantity)) {
          return NextResponse.json({ 
            error: "Maximum quantity must be a valid integer",
            code: "INVALID_MAX_QUANTITY" 
          }, { status: 400 });
        }

        const finalMinQuantity = updates.minQuantity !== undefined ? updates.minQuantity : existingTier[0].minQuantity;
        if (parsedMaxQuantity <= finalMinQuantity) {
          return NextResponse.json({ 
            error: "Maximum quantity must be greater than minimum quantity",
            code: "INVALID_QUANTITY_RANGE" 
          }, { status: 400 });
        }
        updates.maxQuantity = parsedMaxQuantity;
      }
    }

    // Validate and add markupValue if provided
    if (markupValue !== undefined) {
      const parsedMarkupValue = parseFloat(markupValue);
      if (isNaN(parsedMarkupValue)) {
        return NextResponse.json({ 
          error: "Markup value must be a valid number",
          code: "INVALID_MARKUP_VALUE" 
        }, { status: 400 });
      }
      updates.markupValue = parsedMarkupValue;
    }

    // Check for overlapping ranges if quantity fields are being updated
    if (updates.minQuantity !== undefined || updates.maxQuantity !== undefined) {
      const finalMinQuantity = updates.minQuantity !== undefined ? updates.minQuantity : existingTier[0].minQuantity;
      const finalMaxQuantity = updates.maxQuantity !== undefined ? updates.maxQuantity : existingTier[0].maxQuantity;

      const otherTiers = await db.select()
        .from(markupTiers)
        .where(
          and(
            eq(markupTiers.markupId, existingTier[0].markupId),
            ne(markupTiers.id, parsedId)
          )
        );

      for (const tier of otherTiers) {
        const tierMin = tier.minQuantity;
        const tierMax = tier.maxQuantity;
        const newMin = finalMinQuantity;
        const newMax = finalMaxQuantity;

        // Check for overlap
        if (newMax === null) {
          if (tierMax === null && tierMin <= newMin) {
            return NextResponse.json({ 
              error: "Quantity range overlaps with existing tier",
              code: "OVERLAPPING_RANGE" 
            }, { status: 400 });
          }
          if (tierMax !== null && tierMin <= newMin && newMin <= tierMax) {
            return NextResponse.json({ 
              error: "Quantity range overlaps with existing tier",
              code: "OVERLAPPING_RANGE" 
            }, { status: 400 });
          }
        } else {
          if (tierMax === null) {
            if (tierMin <= newMax) {
              return NextResponse.json({ 
                error: "Quantity range overlaps with existing tier",
                code: "OVERLAPPING_RANGE" 
              }, { status: 400 });
            }
          } else {
            if (!(newMax < tierMin || newMin > tierMax)) {
              return NextResponse.json({ 
                error: "Quantity range overlaps with existing tier",
                code: "OVERLAPPING_RANGE" 
              }, { status: 400 });
            }
          }
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(existingTier[0]);
    }

    // Update tier
    const updatedTier = await db.update(markupTiers)
      .set(updates)
      .where(eq(markupTiers.id, parsedId))
      .returning();

    return NextResponse.json(updatedTier[0]);
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

    if (!id) {
      return NextResponse.json({ 
        error: "ID parameter is required",
        code: "MISSING_ID" 
      }, { status: 400 });
    }

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if tier exists
    const existingTier = await db.select()
      .from(markupTiers)
      .where(eq(markupTiers.id, parsedId))
      .limit(1);

    if (existingTier.length === 0) {
      return NextResponse.json({ 
        error: 'Markup tier not found',
        code: "TIER_NOT_FOUND" 
      }, { status: 404 });
    }

    // Delete tier
    const deletedTier = await db.delete(markupTiers)
      .where(eq(markupTiers.id, parsedId))
      .returning();

    return NextResponse.json({
      message: 'Markup tier deleted successfully',
      tier: deletedTier[0]
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}