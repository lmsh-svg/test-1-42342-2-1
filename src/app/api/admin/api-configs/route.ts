import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiConfigurations, apiLogs, products, productVariants, productImages, bulkPricingRules, orderItems, productReviews, reviewImages } from '@/db/schema';
import { eq, desc, and, or, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // Single record by ID
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json(
          { error: 'Valid ID is required', code: 'INVALID_ID' },
          { status: 400 }
        );
      }

      const config = await db
        .select()
        .from(apiConfigurations)
        .where(eq(apiConfigurations.id, parseInt(id)))
        .limit(1);

      if (config.length === 0) {
        return NextResponse.json(
          { error: 'Configuration not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      return NextResponse.json(config[0], { status: 200 });
    }

    // List with pagination and filtering
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');
    const isActiveParam = searchParams.get('isActive');

    let query = db.select().from(apiConfigurations);

    // Build filter conditions
    const conditions = [];

    if (type) {
      if (type !== 'json' && type !== 'html') {
        return NextResponse.json(
          { error: 'Type must be "json" or "html"', code: 'INVALID_TYPE' },
          { status: 400 }
        );
      }
      conditions.push(eq(apiConfigurations.type, type));
    }

    if (isActiveParam !== null) {
      const isActive = isActiveParam === 'true';
      conditions.push(eq(apiConfigurations.isActive, isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(apiConfigurations.createdAt))
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
    const { name, type, sourceType, sourceUrl, sourceContent, syncIntervalMinutes, lastSyncedAt, isActive, isTestMode, autoSyncEnabled, loadImages, enableDuplicateMerging, categoryMappingRules } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string', code: 'MISSING_NAME' },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { error: 'Type is required', code: 'MISSING_TYPE' },
        { status: 400 }
      );
    }

    if (type !== 'json' && type !== 'html') {
      return NextResponse.json(
        { error: 'Type must be "json" or "html"', code: 'INVALID_TYPE' },
        { status: 400 }
      );
    }

    if (!sourceType) {
      return NextResponse.json(
        { error: 'Source type is required', code: 'MISSING_SOURCE_TYPE' },
        { status: 400 }
      );
    }

    if (sourceType !== 'url' && sourceType !== 'file') {
      return NextResponse.json(
        { error: 'Source type must be "url" or "file"', code: 'INVALID_SOURCE_TYPE' },
        { status: 400 }
      );
    }

    // Validate source-specific requirements
    if (sourceType === 'url') {
      if (!sourceUrl || typeof sourceUrl !== 'string' || sourceUrl.trim() === '') {
        return NextResponse.json(
          { error: 'Source URL is required when source type is "url"', code: 'MISSING_SOURCE_URL' },
          { status: 400 }
        );
      }
    }

    if (sourceType === 'file') {
      if (!sourceContent || typeof sourceContent !== 'string' || sourceContent.trim() === '') {
        return NextResponse.json(
          { error: 'Source content is required when source type is "file"', code: 'MISSING_SOURCE_CONTENT' },
          { status: 400 }
        );
      }
    }

    // Validate syncIntervalMinutes if provided
    if (syncIntervalMinutes !== undefined && syncIntervalMinutes !== null) {
      const interval = parseInt(syncIntervalMinutes);
      if (isNaN(interval) || interval < 1) {
        return NextResponse.json(
          { error: 'Sync interval must be a positive integer >= 1', code: 'INVALID_SYNC_INTERVAL' },
          { status: 400 }
        );
      }
    }

    // Validate categoryMappingRules if provided (must be valid JSON string or null)
    if (categoryMappingRules !== undefined && categoryMappingRules !== null) {
      if (typeof categoryMappingRules !== 'string') {
        return NextResponse.json(
          { error: 'Category mapping rules must be a JSON string', code: 'INVALID_CATEGORY_MAPPING_RULES' },
          { status: 400 }
        );
      }
      // Validate it's valid JSON
      try {
        JSON.parse(categoryMappingRules);
      } catch {
        return NextResponse.json(
          { error: 'Category mapping rules must be valid JSON', code: 'INVALID_JSON_FORMAT' },
          { status: 400 }
        );
      }
    }

    // Prepare insert data
    const insertData: any = {
      name: name.trim(),
      type,
      sourceType,
      sourceUrl: sourceType === 'url' ? sourceUrl.trim() : null,
      sourceContent: sourceType === 'file' ? sourceContent : null,
      isActive: isActive !== undefined ? Boolean(isActive) : false,
      isTestMode: isTestMode !== undefined ? Boolean(isTestMode) : true,
      autoSyncEnabled: autoSyncEnabled !== undefined ? Boolean(autoSyncEnabled) : false,
      syncIntervalMinutes: syncIntervalMinutes !== undefined && syncIntervalMinutes !== null ? parseInt(syncIntervalMinutes) : null,
      lastSyncedAt: lastSyncedAt || null,
      loadImages: loadImages !== undefined ? Boolean(loadImages) : true,
      enableDuplicateMerging: enableDuplicateMerging !== undefined ? Boolean(enableDuplicateMerging) : true,
      categoryMappingRules: categoryMappingRules || null,
      createdAt: new Date().toISOString(),
    };

    const newConfig = await db
      .insert(apiConfigurations)
      .values(insertData)
      .returning();

    return NextResponse.json(newConfig[0], { status: 201 });
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
    const existing = await db
      .select()
      .from(apiConfigurations)
      .where(eq(apiConfigurations.id, parseInt(id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Configuration not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, type, sourceType, sourceUrl, sourceContent, isActive, isTestMode, autoSyncEnabled, syncIntervalMinutes, lastSyncedAt, loadImages, enableDuplicateMerging, categoryMappingRules } = body;

    const updates: any = {};

    // Validate and prepare updates
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json(
          { error: 'Name must be a non-empty string', code: 'INVALID_NAME' },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }

    if (type !== undefined) {
      if (type !== 'json' && type !== 'html') {
        return NextResponse.json(
          { error: 'Type must be "json" or "html"', code: 'INVALID_TYPE' },
          { status: 400 }
        );
      }
      updates.type = type;
    }

    if (sourceType !== undefined) {
      if (sourceType !== 'url' && sourceType !== 'file') {
        return NextResponse.json(
          { error: 'Source type must be "url" or "file"', code: 'INVALID_SOURCE_TYPE' },
          { status: 400 }
        );
      }
      updates.sourceType = sourceType;
    }

    if (sourceUrl !== undefined) {
      updates.sourceUrl = sourceUrl ? sourceUrl.trim() : null;
    }

    if (sourceContent !== undefined) {
      updates.sourceContent = sourceContent || null;
    }

    if (isActive !== undefined) {
      updates.isActive = Boolean(isActive);
    }

    if (isTestMode !== undefined) {
      updates.isTestMode = Boolean(isTestMode);
    }

    if (autoSyncEnabled !== undefined) {
      updates.autoSyncEnabled = Boolean(autoSyncEnabled);
    }

    if (syncIntervalMinutes !== undefined) {
      if (syncIntervalMinutes !== null) {
        const interval = parseInt(syncIntervalMinutes);
        if (isNaN(interval) || interval < 1) {
          return NextResponse.json(
            { error: 'Sync interval must be a positive integer >= 1', code: 'INVALID_SYNC_INTERVAL' },
            { status: 400 }
          );
        }
        updates.syncIntervalMinutes = interval;
      } else {
        updates.syncIntervalMinutes = null;
      }
    }

    if (lastSyncedAt !== undefined) {
      updates.lastSyncedAt = lastSyncedAt || null;
    }

    if (loadImages !== undefined) {
      updates.loadImages = Boolean(loadImages);
    }

    if (enableDuplicateMerging !== undefined) {
      updates.enableDuplicateMerging = Boolean(enableDuplicateMerging);
    }

    if (categoryMappingRules !== undefined) {
      if (categoryMappingRules === null) {
        updates.categoryMappingRules = null;
      } else {
        if (typeof categoryMappingRules !== 'string') {
          return NextResponse.json(
            { error: 'Category mapping rules must be a JSON string', code: 'INVALID_CATEGORY_MAPPING_RULES' },
            { status: 400 }
          );
        }
        // Validate it's valid JSON
        try {
          JSON.parse(categoryMappingRules);
        } catch {
          return NextResponse.json(
            { error: 'Category mapping rules must be valid JSON', code: 'INVALID_JSON_FORMAT' },
            { status: 400 }
          );
        }
        updates.categoryMappingRules = categoryMappingRules;
      }
    }

    // Validate sourceType-specific requirements if sourceType is being updated
    const finalSourceType = updates.sourceType || existing[0].sourceType;
    if (finalSourceType === 'url') {
      const finalSourceUrl = updates.sourceUrl !== undefined ? updates.sourceUrl : existing[0].sourceUrl;
      if (!finalSourceUrl || finalSourceUrl.trim() === '') {
        return NextResponse.json(
          { error: 'Source URL is required when source type is "url"', code: 'MISSING_SOURCE_URL' },
          { status: 400 }
        );
      }
    }

    if (finalSourceType === 'file') {
      const finalSourceContent = updates.sourceContent !== undefined ? updates.sourceContent : existing[0].sourceContent;
      if (!finalSourceContent || finalSourceContent.trim() === '') {
        return NextResponse.json(
          { error: 'Source content is required when source type is "file"', code: 'MISSING_SOURCE_CONTENT' },
          { status: 400 }
        );
      }
    }

    const updated = await db
      .update(apiConfigurations)
      .set(updates)
      .where(eq(apiConfigurations.id, parseInt(id)))
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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');

    if (!configId) {
      return NextResponse.json({ error: 'Configuration ID required' }, { status: 400 });
    }

    const id = parseInt(configId);

    // Get all products associated with this config
    const productsList = await db.select().from(products).where(eq(products.apiConfigId, id));
    const productIds = productsList.map(p => p.id);

    if (productIds.length > 0) {
      // Delete in correct cascade order to avoid foreign key violations
      
      // 1. Delete review images (references productReviews)
      const reviews = await db.select().from(productReviews).where(inArray(productReviews.productId, productIds));
      const reviewIds = reviews.map(r => r.id);
      
      if (reviewIds.length > 0) {
        await db.delete(reviewImages).where(inArray(reviewImages.reviewId, reviewIds));
      }
      
      // 2. Delete product reviews (references products)
      await db.delete(productReviews).where(inArray(productReviews.productId, productIds));
      
      // 3. Delete order items (references products)
      await db.delete(orderItems).where(inArray(orderItems.productId, productIds));
      
      // 4. Delete product variants (references products)
      await db.delete(productVariants).where(inArray(productVariants.productId, productIds));
      
      // 5. Delete product images (references products)
      await db.delete(productImages).where(inArray(productImages.productId, productIds));
      
      // 6. Delete bulk pricing rules (references products)
      await db.delete(bulkPricingRules).where(inArray(bulkPricingRules.productId, productIds));
      
      // 7. Delete products (references apiConfigurations)
      await db.delete(products).where(eq(products.apiConfigId, id));
    }

    // 8. Delete API logs (references apiConfigurations)
    await db.delete(apiLogs).where(eq(apiLogs.configId, id));

    // 9. Finally delete the configuration itself
    await db.delete(apiConfigurations).where(eq(apiConfigurations.id, id));

    return NextResponse.json({ message: 'Configuration deleted successfully' });
  } catch (error: any) {
    console.error('Delete configuration error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete configuration' }, { status: 500 });
  }
}