import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { productVariants, products } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  try {
    const productId = params.id;
    const variantId = params.variantId;

    // Validate product ID
    if (!productId || isNaN(parseInt(productId))) {
      return NextResponse.json(
        { 
          error: 'Valid product ID is required',
          code: 'INVALID_PRODUCT_ID'
        },
        { status: 400 }
      );
    }

    // Validate variant ID
    if (!variantId || isNaN(parseInt(variantId))) {
      return NextResponse.json(
        { 
          error: 'Valid variant ID is required',
          code: 'INVALID_VARIANT_ID'
        },
        { status: 400 }
      );
    }

    const productIdInt = parseInt(productId);
    const variantIdInt = parseInt(variantId);

    // Check if product exists
    const product = await db.select()
      .from(products)
      .where(eq(products.id, productIdInt))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json(
        { 
          error: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Check if variant exists and belongs to the product
    const variant = await db.select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.id, variantIdInt),
          eq(productVariants.productId, productIdInt)
        )
      )
      .limit(1);

    if (variant.length === 0) {
      return NextResponse.json(
        { 
          error: 'Variant not found or does not belong to this product',
          code: 'VARIANT_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { variantName, variantType, stockQuantity, priceModifier, isAvailable } = body;

    // Build update object with only provided fields
    const updates: any = {};

    // Validate and add variantName if provided
    if (variantName !== undefined) {
      const trimmedName = String(variantName).trim();
      if (!trimmedName) {
        return NextResponse.json(
          { 
            error: 'Variant name cannot be empty',
            code: 'INVALID_VARIANT_NAME'
          },
          { status: 400 }
        );
      }
      updates.variantName = trimmedName;
    }

    // Validate and add variantType if provided
    if (variantType !== undefined) {
      const trimmedType = String(variantType).trim();
      if (!trimmedType) {
        return NextResponse.json(
          { 
            error: 'Variant type cannot be empty',
            code: 'INVALID_VARIANT_TYPE'
          },
          { status: 400 }
        );
      }
      updates.variantType = trimmedType;
    }

    // Validate and add stockQuantity if provided
    if (stockQuantity !== undefined) {
      const qty = parseInt(stockQuantity);
      if (isNaN(qty) || qty < 0) {
        return NextResponse.json(
          { 
            error: 'Stock quantity must be a non-negative integer',
            code: 'INVALID_STOCK_QUANTITY'
          },
          { status: 400 }
        );
      }
      updates.stockQuantity = qty;
    }

    // Validate and add priceModifier if provided
    if (priceModifier !== undefined) {
      const modifier = parseFloat(priceModifier);
      if (isNaN(modifier)) {
        return NextResponse.json(
          { 
            error: 'Price modifier must be a valid number',
            code: 'INVALID_PRICE_MODIFIER'
          },
          { status: 400 }
        );
      }
      updates.priceModifier = modifier;
    }

    // Validate and add isAvailable if provided
    if (isAvailable !== undefined) {
      if (typeof isAvailable !== 'boolean') {
        return NextResponse.json(
          { 
            error: 'isAvailable must be a boolean',
            code: 'INVALID_IS_AVAILABLE'
          },
          { status: 400 }
        );
      }
      updates.isAvailable = isAvailable;
    }

    // Check if any valid fields provided
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { 
          error: 'No valid fields provided to update',
          code: 'NO_FIELDS_TO_UPDATE'
        },
        { status: 400 }
      );
    }

    // Update the variant
    const updated = await db.update(productVariants)
      .set(updates)
      .where(
        and(
          eq(productVariants.id, variantIdInt),
          eq(productVariants.productId, productIdInt)
        )
      )
      .returning();

    return NextResponse.json(updated[0], { status: 200 });

  } catch (error) {
    console.error('PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  try {
    const productId = params.id;
    const variantId = params.variantId;

    // Validate product ID
    if (!productId || isNaN(parseInt(productId))) {
      return NextResponse.json(
        { 
          error: 'Valid product ID is required',
          code: 'INVALID_PRODUCT_ID'
        },
        { status: 400 }
      );
    }

    // Validate variant ID
    if (!variantId || isNaN(parseInt(variantId))) {
      return NextResponse.json(
        { 
          error: 'Valid variant ID is required',
          code: 'INVALID_VARIANT_ID'
        },
        { status: 400 }
      );
    }

    const productIdInt = parseInt(productId);
    const variantIdInt = parseInt(variantId);

    // Check if product exists
    const product = await db.select()
      .from(products)
      .where(eq(products.id, productIdInt))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json(
        { 
          error: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Check if variant exists and belongs to the product
    const variant = await db.select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.id, variantIdInt),
          eq(productVariants.productId, productIdInt)
        )
      )
      .limit(1);

    if (variant.length === 0) {
      return NextResponse.json(
        { 
          error: 'Variant not found or does not belong to this product',
          code: 'VARIANT_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Delete the variant
    const deleted = await db.delete(productVariants)
      .where(
        and(
          eq(productVariants.id, variantIdInt),
          eq(productVariants.productId, productIdInt)
        )
      )
      .returning();

    return NextResponse.json(
      { 
        message: 'Variant deleted successfully',
        variant: deleted[0]
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