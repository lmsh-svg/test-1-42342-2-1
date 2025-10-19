import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { productVariants, products } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;

    // Validate product ID format
    if (!productId || isNaN(parseInt(productId))) {
      return NextResponse.json(
        { error: 'Valid product ID is required', code: 'INVALID_PRODUCT_ID' },
        { status: 400 }
      );
    }

    const parsedProductId = parseInt(productId);

    // Check if product exists
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, parsedProductId))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json(
        { error: 'Product not found', code: 'PRODUCT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query variants for the product
    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, parsedProductId))
      .orderBy(desc(productVariants.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(variants, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;

    // Validate product ID format
    if (!productId || isNaN(parseInt(productId))) {
      return NextResponse.json(
        { error: 'Valid product ID is required', code: 'INVALID_PRODUCT_ID' },
        { status: 400 }
      );
    }

    const parsedProductId = parseInt(productId);

    // Check if product exists
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, parsedProductId))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json(
        { error: 'Product not found', code: 'PRODUCT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { variantName, variantType, stockQuantity, priceModifier, isAvailable } = body;

    // Validate required fields
    if (!variantName || !variantType) {
      return NextResponse.json(
        {
          error: 'Missing required fields: variantName and variantType are required',
          code: 'MISSING_REQUIRED_FIELDS',
        },
        { status: 400 }
      );
    }

    // Validate and sanitize variantName
    const trimmedVariantName = variantName.trim();
    if (trimmedVariantName.length === 0) {
      return NextResponse.json(
        { error: 'Variant name cannot be empty', code: 'INVALID_VARIANT_NAME' },
        { status: 400 }
      );
    }

    // Validate and sanitize variantType
    const trimmedVariantType = variantType.trim();
    if (trimmedVariantType.length === 0) {
      return NextResponse.json(
        { error: 'Variant type cannot be empty', code: 'INVALID_VARIANT_TYPE' },
        { status: 400 }
      );
    }

    // Validate stockQuantity if provided
    const finalStockQuantity = stockQuantity !== undefined ? stockQuantity : 0;
    if (typeof finalStockQuantity !== 'number' || finalStockQuantity < 0 || !Number.isInteger(finalStockQuantity)) {
      return NextResponse.json(
        { error: 'Stock quantity must be a non-negative integer', code: 'INVALID_STOCK_QUANTITY' },
        { status: 400 }
      );
    }

    // Validate priceModifier if provided
    const finalPriceModifier = priceModifier !== undefined ? priceModifier : 0;
    if (typeof finalPriceModifier !== 'number' || isNaN(finalPriceModifier)) {
      return NextResponse.json(
        { error: 'Price modifier must be a valid number', code: 'INVALID_PRICE_MODIFIER' },
        { status: 400 }
      );
    }

    // Validate isAvailable if provided
    const finalIsAvailable = isAvailable !== undefined ? isAvailable : false;
    if (typeof finalIsAvailable !== 'boolean') {
      return NextResponse.json(
        { error: 'isAvailable must be a boolean', code: 'INVALID_IS_AVAILABLE' },
        { status: 400 }
      );
    }

    // Create new variant
    const newVariant = await db
      .insert(productVariants)
      .values({
        productId: parsedProductId,
        variantName: trimmedVariantName,
        variantType: trimmedVariantType,
        stockQuantity: finalStockQuantity,
        priceModifier: finalPriceModifier,
        isAvailable: finalIsAvailable,
        createdAt: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json(newVariant[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}