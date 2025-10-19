import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { productImages, products } from '@/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const productId = searchParams.get('productId');
    const isPrimary = searchParams.get('isPrimary');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Single record by ID
    if (id) {
      if (isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const image = await db.select()
        .from(productImages)
        .where(eq(productImages.id, parseInt(id)))
        .limit(1);

      if (image.length === 0) {
        return NextResponse.json({ 
          error: 'Product image not found',
          code: 'IMAGE_NOT_FOUND' 
        }, { status: 404 });
      }

      return NextResponse.json(image[0]);
    }

    // List with filtering
    let query = db.select().from(productImages);
    const conditions = [];

    if (productId) {
      if (isNaN(parseInt(productId))) {
        return NextResponse.json({ 
          error: "Valid product ID is required",
          code: "INVALID_PRODUCT_ID" 
        }, { status: 400 });
      }
      conditions.push(eq(productImages.productId, parseInt(productId)));
    }

    if (isPrimary !== null) {
      if (isPrimary === 'true') {
        conditions.push(eq(productImages.isPrimary, true));
      } else if (isPrimary === 'false') {
        conditions.push(eq(productImages.isPrimary, false));
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(asc(productImages.productId), asc(productImages.displayOrder), asc(productImages.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results);
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
    const { productId, imageUrl, isPrimary, displayOrder } = body;

    // Validate required fields
    if (!productId) {
      return NextResponse.json({ 
        error: "Product ID is required",
        code: "MISSING_PRODUCT_ID" 
      }, { status: 400 });
    }

    if (isNaN(parseInt(productId))) {
      return NextResponse.json({ 
        error: "Valid product ID is required",
        code: "INVALID_PRODUCT_ID" 
      }, { status: 400 });
    }

    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
      return NextResponse.json({ 
        error: "Image URL is required and must be a non-empty string",
        code: "MISSING_IMAGE_URL" 
      }, { status: 400 });
    }

    // Validate productId exists
    const product = await db.select()
      .from(products)
      .where(eq(products.id, parseInt(productId)))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json({ 
        error: "Product not found",
        code: "PRODUCT_NOT_FOUND" 
      }, { status: 404 });
    }

    // Validate displayOrder if provided
    const validatedDisplayOrder = displayOrder !== undefined ? parseInt(displayOrder) : 0;
    if (isNaN(validatedDisplayOrder) || validatedDisplayOrder < 0) {
      return NextResponse.json({ 
        error: "Display order must be a non-negative integer",
        code: "INVALID_DISPLAY_ORDER" 
      }, { status: 400 });
    }

    const validatedIsPrimary = isPrimary === true;

    // If setting as primary, update all other images for this product to not be primary
    if (validatedIsPrimary) {
      await db.update(productImages)
        .set({ isPrimary: false })
        .where(eq(productImages.productId, parseInt(productId)));
    }

    // Create new product image
    const newImage = await db.insert(productImages)
      .values({
        productId: parseInt(productId),
        imageUrl: imageUrl.trim(),
        isPrimary: validatedIsPrimary,
        displayOrder: validatedDisplayOrder,
        createdAt: new Date().toISOString()
      })
      .returning();

    return NextResponse.json(newImage[0], { status: 201 });
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

    // Check if image exists
    const existingImage = await db.select()
      .from(productImages)
      .where(eq(productImages.id, parseInt(id)))
      .limit(1);

    if (existingImage.length === 0) {
      return NextResponse.json({ 
        error: 'Product image not found',
        code: 'IMAGE_NOT_FOUND' 
      }, { status: 404 });
    }

    const body = await request.json();
    const { imageUrl, isPrimary, displayOrder } = body;

    const updates: any = {};

    // Validate and update imageUrl if provided
    if (imageUrl !== undefined) {
      if (typeof imageUrl !== 'string' || imageUrl.trim() === '') {
        return NextResponse.json({ 
          error: "Image URL must be a non-empty string",
          code: "INVALID_IMAGE_URL" 
        }, { status: 400 });
      }
      updates.imageUrl = imageUrl.trim();
    }

    // Validate and update displayOrder if provided
    if (displayOrder !== undefined) {
      const validatedDisplayOrder = parseInt(displayOrder);
      if (isNaN(validatedDisplayOrder) || validatedDisplayOrder < 0) {
        return NextResponse.json({ 
          error: "Display order must be a non-negative integer",
          code: "INVALID_DISPLAY_ORDER" 
        }, { status: 400 });
      }
      updates.displayOrder = validatedDisplayOrder;
    }

    // Handle isPrimary logic
    if (isPrimary !== undefined) {
      const validatedIsPrimary = isPrimary === true;
      
      // If setting as primary, update all other images for this product to not be primary
      if (validatedIsPrimary) {
        await db.update(productImages)
          .set({ isPrimary: false })
          .where(eq(productImages.productId, existingImage[0].productId));
      }
      
      updates.isPrimary = validatedIsPrimary;
    }

    // Perform update
    const updated = await db.update(productImages)
      .set(updates)
      .where(eq(productImages.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0]);
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

    // Check if image exists
    const existingImage = await db.select()
      .from(productImages)
      .where(eq(productImages.id, parseInt(id)))
      .limit(1);

    if (existingImage.length === 0) {
      return NextResponse.json({ 
        error: 'Product image not found',
        code: 'IMAGE_NOT_FOUND' 
      }, { status: 404 });
    }

    // Delete the image
    const deleted = await db.delete(productImages)
      .where(eq(productImages.id, parseInt(id)))
      .returning();

    return NextResponse.json({ 
      message: "Product image deleted successfully",
      image: deleted[0] 
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}