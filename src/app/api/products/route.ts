import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products, productVariants, apiConfigurations, productReviews, reviewImages, orderItems, productImages, bulkPricingRules } from '@/db/schema';
import { eq, like, and, or, desc, sql, isNull, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // Single record fetch by ID
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const product = await db.select()
        .from(products)
        .where(eq(products.id, parseInt(id)))
        .limit(1);

      if (product.length === 0) {
        return NextResponse.json({ 
          error: 'Product not found',
          code: "PRODUCT_NOT_FOUND" 
        }, { status: 404 });
      }

      // Get variants count and total stock for this product
      const variantsData = await db
        .select({
          count: sql<number>`count(*)`,
          totalStock: sql<number>`coalesce(sum(${productVariants.stockQuantity}), 0)`,
        })
        .from(productVariants)
        .where(eq(productVariants.productId, parseInt(id)));

      const variantsCount = Number(variantsData[0]?.count || 0);
      const totalVariantsStock = Number(variantsData[0]?.totalStock || 0);

      return NextResponse.json({
        ...product[0],
        variantsCount,
        totalVariantsStock,
      }, { status: 200 });
    }

    // CRITICAL FIX: Get valid API configuration IDs to filter out orphaned products
    const validConfigs = await db.select({ id: apiConfigurations.id }).from(apiConfigurations);
    const validConfigIds = validConfigs.map(c => c.id);

    // List products with filtering, search, and pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50000);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const mainCategory = searchParams.get('mainCategory');
    const subCategory = searchParams.get('subCategory');
    const brand = searchParams.get('brand');
    const volume = searchParams.get('volume');
    const available = searchParams.get('available');
    const inStock = searchParams.get('inStock');
    const localOnly = searchParams.get('localOnly');
    const sortBy = searchParams.get('sortBy') || 'newest'; // NEW: Sorting parameter
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // NEW: Sort order

    // Build base query
    let baseQuery = db.select().from(products);
    const conditions = [];

    // CRITICAL: Only show products with valid API configs or manually created (null apiConfigId)
    if (validConfigIds.length > 0) {
      conditions.push(
        or(
          isNull(products.apiConfigId),
          inArray(products.apiConfigId, validConfigIds)
        )
      );
    } else {
      // If no valid configs, only show manually created products
      conditions.push(isNull(products.apiConfigId));
    }

    // Search filter (name, description)
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          like(products.name, searchTerm),
          like(products.description, searchTerm)
        )
      );
    }

    // Category filter (legacy - exact match)
    if (category) {
      conditions.push(eq(products.category, category));
    }

    // Main category filter - FIXED: Case-insensitive using LOWER()
    if (mainCategory) {
      conditions.push(
        sql`LOWER(${products.mainCategory}) = LOWER(${mainCategory})`
      );
    }

    // Sub category filter (exact match)
    if (subCategory) {
      conditions.push(eq(products.subCategory, subCategory));
    }

    // Brand filter (exact match)
    if (brand) {
      conditions.push(eq(products.brand, brand));
    }

    // Volume filter (exact match)
    if (volume) {
      conditions.push(eq(products.volume, volume));
    }

    // Availability filter (default to true if not specified)
    const showAvailable = available === null || available === undefined ? true : (available === 'true' || available === '1');
    if (showAvailable) {
      conditions.push(eq(products.isAvailable, true));
    }

    // Local only filter (requires authentication and hasLocalAccess)
    if (localOnly === 'true') {
      // Check for authorization header
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ 
          error: 'Authentication required to access local products',
          code: "AUTH_REQUIRED" 
        }, { status: 401 });
      }

      // In production, validate the token and check user's hasLocalAccess
      // For now, we'll assume the token is valid and check a hypothetical session
      // This is a simplified implementation - in production, use proper session management
      
      // Add filter for local only products
      conditions.push(eq(products.isLocalOnly, true));
    } else {
      // Default behavior: exclude local-only products unless explicitly requested
      conditions.push(eq(products.isLocalOnly, false));
    }

    // Apply all conditions
    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions));
    }

    // Apply sorting (newest first), pagination
    const productResults = await baseQuery
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    // For each product, get variants count and total stock
    const resultsWithVariants = await Promise.all(
      productResults.map(async (product) => {
        const variantsData = await db
          .select({
            count: sql<number>`count(*)`,
            totalStock: sql<number>`coalesce(sum(${productVariants.stockQuantity}), 0)`,
          })
          .from(productVariants)
          .where(eq(productVariants.productId, product.id));

        return {
          ...product,
          variantsCount: Number(variantsData[0]?.count || 0),
          totalVariantsStock: Number(variantsData[0]?.totalStock || 0),
        };
      })
    );

    // CRITICAL FIX: Filter by actual stock if inStock parameter is true
    let finalResults = resultsWithVariants;
    if (inStock === 'true') {
      finalResults = resultsWithVariants.filter(product => {
        const totalStock = product.stockQuantity + product.totalVariantsStock;
        return totalStock > 0;
      });
    }

    return NextResponse.json(finalResults, { status: 200 });

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
    const { name, description, price, imageUrl, category, mainCategory, subCategory, brand, volume, stockQuantity, isAvailable } = body;

    // Validate required fields
    if (!name || name.trim() === '') {
      return NextResponse.json({ 
        error: "Name is required",
        code: "MISSING_NAME" 
      }, { status: 400 });
    }

    if (price === undefined || price === null) {
      return NextResponse.json({ 
        error: "Price is required",
        code: "MISSING_PRICE" 
      }, { status: 400 });
    }

    if (!mainCategory || mainCategory.trim() === '') {
      return NextResponse.json({ 
        error: "Main category is required",
        code: "MISSING_MAIN_CATEGORY" 
      }, { status: 400 });
    }

    // Validate main category is one of the allowed values
    const VALID_MAIN_CATEGORIES = [
      'Cartridges', 'Disposables', 'Concentrates', 'Edibles', 
      'Flower', 'Pre Rolls', 'Accessories', 'Topicals', 'BYOB'
    ];

    if (!VALID_MAIN_CATEGORIES.includes(mainCategory)) {
      return NextResponse.json({ 
        error: `Main category must be one of: ${VALID_MAIN_CATEGORIES.join(', ')}`,
        code: "INVALID_MAIN_CATEGORY" 
      }, { status: 400 });
    }

    // Validate price
    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) {
      return NextResponse.json({ 
        error: "Price must be a valid number",
        code: "INVALID_PRICE_FORMAT" 
      }, { status: 400 });
    }

    if (priceNum < 0) {
      return NextResponse.json({ 
        error: "Price must be a positive number",
        code: "INVALID_PRICE_VALUE" 
      }, { status: 400 });
    }

    // Validate stockQuantity if provided
    let validatedStockQuantity = 0;
    if (stockQuantity !== undefined && stockQuantity !== null) {
      validatedStockQuantity = parseInt(stockQuantity);
      if (isNaN(validatedStockQuantity) || validatedStockQuantity < 0) {
        return NextResponse.json({ 
          error: "Stock quantity must be a non-negative integer",
          code: "INVALID_STOCK_QUANTITY" 
        }, { status: 400 });
      }
    }

    // Prepare insert data
    const insertData = {
      name: name.trim(),
      description: description ? description.trim() : null,
      price: priceNum,
      imageUrl: imageUrl ? imageUrl.trim() : null,
      category: category ? category.trim() : null,
      mainCategory: mainCategory.trim(),
      subCategory: subCategory ? subCategory.trim() : null,
      brand: brand ? brand.trim() : null,
      volume: volume ? volume.trim() : null,
      stockQuantity: validatedStockQuantity,
      isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
      createdAt: new Date().toISOString()
    };

    const newProduct = await db.insert(products)
      .values(insertData)
      .returning();

    return NextResponse.json(newProduct[0], { status: 201 });

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

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if product exists
    const existingProduct = await db.select()
      .from(products)
      .where(eq(products.id, parseInt(id)))
      .limit(1);

    if (existingProduct.length === 0) {
      return NextResponse.json({ 
        error: 'Product not found',
        code: "PRODUCT_NOT_FOUND" 
      }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, price, imageUrl, category, mainCategory, subCategory, brand, volume, stockQuantity, isAvailable } = body;

    // Prepare update data
    const updateData: any = {};

    // Validate and add name if provided
    if (name !== undefined) {
      if (name.trim() === '') {
        return NextResponse.json({ 
          error: "Name cannot be empty",
          code: "INVALID_NAME" 
        }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    // Validate and add mainCategory if provided
    if (mainCategory !== undefined) {
      const VALID_MAIN_CATEGORIES = [
        'Cartridges', 'Disposables', 'Concentrates', 'Edibles', 
        'Flower', 'Pre Rolls', 'Accessories', 'Topicals', 'BYOB'
      ];

      if (!VALID_MAIN_CATEGORIES.includes(mainCategory)) {
        return NextResponse.json({ 
          error: `Main category must be one of: ${VALID_MAIN_CATEGORIES.join(', ')}`,
          code: "INVALID_MAIN_CATEGORY" 
        }, { status: 400 });
      }
      updateData.mainCategory = mainCategory.trim();
    }

    // Validate and add price if provided
    if (price !== undefined) {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum)) {
        return NextResponse.json({ 
          error: "Price must be a valid number",
          code: "INVALID_PRICE_FORMAT" 
        }, { status: 400 });
      }
      if (priceNum < 0) {
        return NextResponse.json({ 
          error: "Price must be a positive number",
          code: "INVALID_PRICE_VALUE" 
        }, { status: 400 });
      }
      updateData.price = priceNum;
    }

    // Add optional fields if provided
    if (description !== undefined) {
      updateData.description = description ? description.trim() : null;
    }

    if (imageUrl !== undefined) {
      updateData.imageUrl = imageUrl ? imageUrl.trim() : null;
    }

    if (category !== undefined) {
      updateData.category = category ? category.trim() : null;
    }

    if (subCategory !== undefined) {
      updateData.subCategory = subCategory ? subCategory.trim() : null;
    }

    if (brand !== undefined) {
      updateData.brand = brand ? brand.trim() : null;
    }

    if (volume !== undefined) {
      updateData.volume = volume ? volume.trim() : null;
    }

    // Validate and add stockQuantity if provided
    if (stockQuantity !== undefined) {
      const stockNum = parseInt(stockQuantity);
      if (isNaN(stockNum) || stockNum < 0) {
        return NextResponse.json({ 
          error: "Stock quantity must be a non-negative integer",
          code: "INVALID_STOCK_QUANTITY" 
        }, { status: 400 });
      }
      updateData.stockQuantity = stockNum;
    }

    if (isAvailable !== undefined) {
      updateData.isAvailable = Boolean(isAvailable);
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ 
        error: "No fields to update",
        code: "NO_UPDATE_FIELDS" 
      }, { status: 400 });
    }

    // Perform update
    const updated = await db.update(products)
      .set(updateData)
      .where(eq(products.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated[0], { status: 200 });

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

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const productId = parseInt(id);

    // Check if product exists
    const existingProduct = await db.select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (existingProduct.length === 0) {
      return NextResponse.json({ 
        error: 'Product not found',
        code: "PRODUCT_NOT_FOUND" 
      }, { status: 404 });
    }

    // CASCADE DELETE: Remove all dependent records first to avoid foreign key constraints
    
    // 1. Delete review images (references productReviews which references products)
    const reviews = await db.select({ id: productReviews.id })
      .from(productReviews)
      .where(eq(productReviews.productId, productId));
    
    if (reviews.length > 0) {
      const reviewIds = reviews.map(r => r.id);
      await db.delete(reviewImages)
        .where(inArray(reviewImages.reviewId, reviewIds));
    }
    
    // 2. Delete product reviews
    await db.delete(productReviews)
      .where(eq(productReviews.productId, productId));
    
    // 3. Delete order items
    await db.delete(orderItems)
      .where(eq(orderItems.productId, productId));
    
    // 4. Delete product variants
    await db.delete(productVariants)
      .where(eq(productVariants.productId, productId));
    
    // 5. Delete product images
    await db.delete(productImages)
      .where(eq(productImages.productId, productId));
    
    // 6. Delete bulk pricing rules
    await db.delete(bulkPricingRules)
      .where(eq(bulkPricingRules.productId, productId));

    // 7. Finally, delete the product itself
    const deleted = await db.delete(products)
      .where(eq(products.id, productId))
      .returning();

    return NextResponse.json({ 
      message: 'Product and all related data deleted successfully',
      product: deleted[0]
    }, { status: 200 });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}