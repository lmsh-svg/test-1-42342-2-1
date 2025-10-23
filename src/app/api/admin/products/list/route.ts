import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products, productCorrections } from '@/db/schema';
import { eq, like, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'MISSING_AUTH_TOKEN' 
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    if (!token || token.trim().length === 0) {
      return NextResponse.json({ 
        error: 'Invalid authentication token',
        code: 'INVALID_AUTH_TOKEN' 
      }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const searchQuery = searchParams.get('search');
    const categoryFilter = searchParams.get('category');

    // Validate and set pagination parameters
    let limit = 10;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return NextResponse.json({ 
          error: 'Invalid limit parameter. Must be a positive integer.',
          code: 'INVALID_LIMIT' 
        }, { status: 400 });
      }
      limit = Math.min(parsedLimit, 100);
    }

    let offset = 0;
    if (offsetParam) {
      const parsedOffset = parseInt(offsetParam);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return NextResponse.json({ 
          error: 'Invalid offset parameter. Must be a non-negative integer.',
          code: 'INVALID_OFFSET' 
        }, { status: 400 });
      }
      offset = parsedOffset;
    }

    // Build the query with LEFT JOIN
    let query = db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        price: products.price,
        imageUrl: products.imageUrl,
        category: products.category,
        mainCategory: products.mainCategory,
        subCategory: products.subCategory,
        brand: products.brand,
        volume: products.volume,
        stockQuantity: products.stockQuantity,
        isAvailable: products.isAvailable,
        sourceType: products.sourceType,
        sourceId: products.sourceId,
        apiConfigId: products.apiConfigId,
        isLocalOnly: products.isLocalOnly,
        createdAt: products.createdAt,
        correctedCategory: productCorrections.correctedCategory,
        correctedName: productCorrections.correctedName,
        correctionId: productCorrections.id,
      })
      .from(products)
      .leftJoin(
        productCorrections,
        eq(products.sourceId, productCorrections.sourceProductId)
      );

    // Apply search filter (case-insensitive)
    if (searchQuery && searchQuery.trim().length > 0) {
      const searchTerm = searchQuery.trim();
      query = query.where(
        sql`LOWER(${products.name}) LIKE LOWER(${`%${searchTerm}%`})`
      );
    }

    // Apply category filter
    if (categoryFilter && categoryFilter.trim().length > 0) {
      const existingCondition = searchQuery 
        ? sql`LOWER(${products.name}) LIKE LOWER(${`%${searchQuery.trim()}%`}) AND ${products.mainCategory} = ${categoryFilter.trim()}`
        : eq(products.mainCategory, categoryFilter.trim());
      
      query = db
        .select({
          id: products.id,
          name: products.name,
          description: products.description,
          price: products.price,
          imageUrl: products.imageUrl,
          category: products.category,
          mainCategory: products.mainCategory,
          subCategory: products.subCategory,
          brand: products.brand,
          volume: products.volume,
          stockQuantity: products.stockQuantity,
          isAvailable: products.isAvailable,
          sourceType: products.sourceType,
          sourceId: products.sourceId,
          apiConfigId: products.apiConfigId,
          isLocalOnly: products.isLocalOnly,
          createdAt: products.createdAt,
          correctedCategory: productCorrections.correctedCategory,
          correctedName: productCorrections.correctedName,
          correctionId: productCorrections.id,
        })
        .from(products)
        .leftJoin(
          productCorrections,
          eq(products.sourceId, productCorrections.sourceProductId)
        )
        .where(existingCondition);
    }

    // Apply ordering and pagination
    const results = await query
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    // Transform results to match response format
    const transformedProducts = results.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.mainCategory,
      mainCategory: row.mainCategory,
      subCategory: row.subCategory,
      price: row.price,
      stockQuantity: row.stockQuantity ?? 0,
      inStock: (row.stockQuantity ?? 0) > 0,
      isAvailable: row.isAvailable ?? false,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      apiConfigId: row.apiConfigId,
      brand: row.brand,
      volume: row.volume,
      imageUrl: row.imageUrl,
      hasCorrection: row.correctionId !== null,
      correctedCategory: row.correctedCategory,
      correctedName: row.correctedName,
    }));

    return NextResponse.json(transformedProducts, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}