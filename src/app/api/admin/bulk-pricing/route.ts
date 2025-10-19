import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bulkPricingRules, products } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const productId = searchParams.get('productId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
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
        .from(bulkPricingRules)
        .where(eq(bulkPricingRules.id, parseInt(id)))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json(
          { error: 'Bulk pricing rule not found', code: 'RULE_NOT_FOUND' },
          { status: 404 }
        );
      }

      return NextResponse.json(record[0]);
    }

    // List with optional productId filter
    let query = db.select().from(bulkPricingRules);

    if (productId) {
      if (isNaN(parseInt(productId))) {
        return NextResponse.json(
          { error: 'Valid product ID is required', code: 'INVALID_PRODUCT_ID' },
          { status: 400 }
        );
      }
      query = query.where(eq(bulkPricingRules.productId, parseInt(productId)));
    }

    const results = await query
      .orderBy(asc(bulkPricingRules.productId), asc(bulkPricingRules.minQuantity))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results);
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
    const { productId, minQuantity, discountType, discountValue, finalPrice } = body;

    // Validate required fields
    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required', code: 'MISSING_PRODUCT_ID' },
        { status: 400 }
      );
    }

    if (!minQuantity && minQuantity !== 0) {
      return NextResponse.json(
        { error: 'Minimum quantity is required', code: 'MISSING_MIN_QUANTITY' },
        { status: 400 }
      );
    }

    if (!discountType) {
      return NextResponse.json(
        { error: 'Discount type is required', code: 'MISSING_DISCOUNT_TYPE' },
        { status: 400 }
      );
    }

    if (!discountValue && discountValue !== 0) {
      return NextResponse.json(
        { error: 'Discount value is required', code: 'MISSING_DISCOUNT_VALUE' },
        { status: 400 }
      );
    }

    // Validate productId is integer
    if (isNaN(parseInt(productId))) {
      return NextResponse.json(
        { error: 'Product ID must be a valid integer', code: 'INVALID_PRODUCT_ID' },
        { status: 400 }
      );
    }

    // Check if product exists
    const productExists = await db
      .select()
      .from(products)
      .where(eq(products.id, parseInt(productId)))
      .limit(1);

    if (productExists.length === 0) {
      return NextResponse.json(
        { error: 'Product not found', code: 'PRODUCT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Validate minQuantity
    const minQty = parseInt(minQuantity);
    if (isNaN(minQty) || minQty < 1) {
      return NextResponse.json(
        { error: 'Minimum quantity must be a positive integer >= 1', code: 'INVALID_MIN_QUANTITY' },
        { status: 400 }
      );
    }

    // Validate discountType
    if (discountType !== 'percentage' && discountType !== 'fixed_amount') {
      return NextResponse.json(
        { error: 'Discount type must be "percentage" or "fixed_amount"', code: 'INVALID_DISCOUNT_TYPE' },
        { status: 400 }
      );
    }

    // Validate discountValue
    const discVal = parseFloat(discountValue);
    if (isNaN(discVal) || discVal <= 0) {
      return NextResponse.json(
        { error: 'Discount value must be a positive number > 0', code: 'INVALID_DISCOUNT_VALUE' },
        { status: 400 }
      );
    }

    // Additional validation for percentage
    if (discountType === 'percentage' && discVal > 100) {
      return NextResponse.json(
        { error: 'Discount value for percentage type must be <= 100', code: 'INVALID_PERCENTAGE_VALUE' },
        { status: 400 }
      );
    }

    // Validate finalPrice if provided
    if (finalPrice !== undefined && finalPrice !== null) {
      const finalPriceVal = parseFloat(finalPrice);
      if (isNaN(finalPriceVal) || finalPriceVal < 0) {
        return NextResponse.json(
          { error: 'Final price must be a positive number >= 0', code: 'INVALID_FINAL_PRICE' },
          { status: 400 }
        );
      }
    }

    // Create new bulk pricing rule
    const newRule = await db
      .insert(bulkPricingRules)
      .values({
        productId: parseInt(productId),
        minQuantity: minQty,
        discountType,
        discountValue: discVal,
        finalPrice: finalPrice !== undefined && finalPrice !== null ? parseFloat(finalPrice) : null,
        createdAt: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json(newRule[0], { status: 201 });
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

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Check if record exists
    const existingRule = await db
      .select()
      .from(bulkPricingRules)
      .where(eq(bulkPricingRules.id, parseInt(id)))
      .limit(1);

    if (existingRule.length === 0) {
      return NextResponse.json(
        { error: 'Bulk pricing rule not found', code: 'RULE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { minQuantity, discountType, discountValue, finalPrice } = body;

    // Prevent productId updates
    if ('productId' in body) {
      return NextResponse.json(
        { error: 'Product ID cannot be updated. Delete and recreate the rule instead.', code: 'PRODUCT_ID_NOT_UPDATABLE' },
        { status: 400 }
      );
    }

    const updates: any = {};

    // Validate and update minQuantity
    if (minQuantity !== undefined) {
      const minQty = parseInt(minQuantity);
      if (isNaN(minQty) || minQty < 1) {
        return NextResponse.json(
          { error: 'Minimum quantity must be a positive integer >= 1', code: 'INVALID_MIN_QUANTITY' },
          { status: 400 }
        );
      }
      updates.minQuantity = minQty;
    }

    // Validate and update discountType
    if (discountType !== undefined) {
      if (discountType !== 'percentage' && discountType !== 'fixed_amount') {
        return NextResponse.json(
          { error: 'Discount type must be "percentage" or "fixed_amount"', code: 'INVALID_DISCOUNT_TYPE' },
          { status: 400 }
        );
      }
      updates.discountType = discountType;
    }

    // Validate and update discountValue
    if (discountValue !== undefined) {
      const discVal = parseFloat(discountValue);
      if (isNaN(discVal) || discVal <= 0) {
        return NextResponse.json(
          { error: 'Discount value must be a positive number > 0', code: 'INVALID_DISCOUNT_VALUE' },
          { status: 400 }
        );
      }

      // Check percentage constraint
      const currentDiscountType = updates.discountType || existingRule[0].discountType;
      if (currentDiscountType === 'percentage' && discVal > 100) {
        return NextResponse.json(
          { error: 'Discount value for percentage type must be <= 100', code: 'INVALID_PERCENTAGE_VALUE' },
          { status: 400 }
        );
      }

      updates.discountValue = discVal;
    }

    // Validate and update finalPrice
    if (finalPrice !== undefined) {
      if (finalPrice === null) {
        updates.finalPrice = null;
      } else {
        const finalPriceVal = parseFloat(finalPrice);
        if (isNaN(finalPriceVal) || finalPriceVal < 0) {
          return NextResponse.json(
            { error: 'Final price must be a positive number >= 0', code: 'INVALID_FINAL_PRICE' },
            { status: 400 }
          );
        }
        updates.finalPrice = finalPriceVal;
      }
    }

    // Additional cross-field validation if both discountType and discountValue are being updated
    if (updates.discountType === 'percentage' && updates.discountValue !== undefined) {
      if (updates.discountValue > 100) {
        return NextResponse.json(
          { error: 'Discount value for percentage type must be <= 100', code: 'INVALID_PERCENTAGE_VALUE' },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update', code: 'NO_UPDATES' },
        { status: 400 }
      );
    }

    const updated = await db
      .update(bulkPricingRules)
      .set(updates)
      .where(eq(bulkPricingRules.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0]);
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

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Check if record exists
    const existingRule = await db
      .select()
      .from(bulkPricingRules)
      .where(eq(bulkPricingRules.id, parseInt(id)))
      .limit(1);

    if (existingRule.length === 0) {
      return NextResponse.json(
        { error: 'Bulk pricing rule not found', code: 'RULE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const deleted = await db
      .delete(bulkPricingRules)
      .where(eq(bulkPricingRules.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Bulk pricing rule deleted successfully',
      rule: deleted[0],
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}