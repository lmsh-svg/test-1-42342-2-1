import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiConfigurations, apiLogs, products, productImages, productVariants, bulkPricingRules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseJSONProducts, parseHTMLProducts, normalizeProducts, mergeDuplicateProducts } from '@/lib/api-parsers';
import { updateSyncProgress, clearSyncProgress } from '../sync-progress/route';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const configId = parseInt(params.id);

    // Initialize progress
    updateSyncProgress(configId, {
      stage: 'fetching',
      totalProducts: 0,
      processedProducts: 0,
      createdProducts: 0,
      updatedProducts: 0,
      errors: [],
      warnings: [],
      message: 'Fetching data from source...',
    });

    // Fetch configuration
    const config = await db.select().from(apiConfigurations).where(eq(apiConfigurations.id, configId)).limit(1);

    if (config.length === 0) {
      clearSyncProgress(configId);
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
    }

    const apiConfig = config[0];

    // Fetch source data
    let rawData: string;

    if (apiConfig.sourceType === 'url') {
      if (!apiConfig.sourceUrl) {
        clearSyncProgress(configId);
        return NextResponse.json({ error: 'Source URL is missing' }, { status: 400 });
      }

      updateSyncProgress(configId, {
        stage: 'fetching',
        totalProducts: 0,
        processedProducts: 0,
        createdProducts: 0,
        updatedProducts: 0,
        errors: [],
        warnings: [],
        message: `Fetching from ${apiConfig.sourceUrl}...`,
      });

      const response = await fetch(apiConfig.sourceUrl);
      if (!response.ok) {
        clearSyncProgress(configId);
        throw new Error(`Failed to fetch from URL: ${response.statusText}`);
      }
      rawData = await response.text();
    } else {
      if (!apiConfig.sourceContent) {
        clearSyncProgress(configId);
        return NextResponse.json({ error: 'Source content is missing' }, { status: 400 });
      }
      rawData = apiConfig.sourceContent;
    }

    let productsProcessed = 0;
    let productsCreated = 0;
    let productsUpdated = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Update progress: parsing
      updateSyncProgress(configId, {
        stage: 'parsing',
        totalProducts: 0,
        processedProducts: 0,
        createdProducts: 0,
        updatedProducts: 0,
        errors: [],
        warnings: [],
        message: 'Parsing product data...',
      });

      // Parse data using appropriate parser
      let parseResult;
      if (apiConfig.type === 'json') {
        parseResult = parseJSONProducts(rawData);
      } else if (apiConfig.type === 'html') {
        parseResult = parseHTMLProducts(rawData);
      } else {
        throw new Error(`Unsupported data type: ${apiConfig.type}`);
      }

      // Collect parsing errors and warnings
      errors.push(...parseResult.errors);
      warnings.push(...parseResult.warnings);

      if (parseResult.products.length === 0) {
        clearSyncProgress(configId);
        throw new Error('No products found in the data');
      }

      // Normalize products
      let normalizedProducts = normalizeProducts(parseResult.products);

      // Apply loadImages setting - if disabled, remove images
      if (!apiConfig.loadImages) {
        normalizedProducts = normalizedProducts.map(product => ({
          ...product,
          imageUrl: undefined,
          images: undefined,
        }));
        warnings.push('Image loading disabled for this configuration');
      }

      // Apply duplicate merging if enabled
      if (apiConfig.enableDuplicateMerging) {
        const beforeCount = normalizedProducts.length;
        normalizedProducts = mergeDuplicateProducts(normalizedProducts);
        warnings.push(`Duplicate merging: ${beforeCount} products merged into ${normalizedProducts.length} unique products`);
      }

      // Apply category mapping rules if provided
      if (apiConfig.categoryMappingRules) {
        try {
          const mappingRules = JSON.parse(apiConfig.categoryMappingRules);
          warnings.push(`Using category mapping rules: ${Object.keys(mappingRules).length} categories mapped`);
        } catch (error) {
          warnings.push('Invalid category mapping rules format - ignored');
        }
      }

      // Update progress: ready to process
      updateSyncProgress(configId, {
        stage: 'processing',
        totalProducts: normalizedProducts.length,
        processedProducts: 0,
        createdProducts: 0,
        updatedProducts: 0,
        errors: [...errors],
        warnings: [...warnings],
        message: `Found ${normalizedProducts.length} products. Starting sync...`,
      });

      // Get existing products for this config
      const existingProducts = await db
        .select()
        .from(products)
        .where(eq(products.apiConfigId, apiConfig.id));

      const existingProductsMap = new Map(
        existingProducts.map(p => [p.sourceId || '', p])
      );

      // Process each product
      for (const productData of normalizedProducts) {
        try {
          productsProcessed++;

          // Update progress with current product
          updateSyncProgress(configId, {
            stage: 'processing',
            totalProducts: normalizedProducts.length,
            processedProducts: productsProcessed,
            createdProducts: productsCreated,
            updatedProducts: productsUpdated,
            currentProduct: {
              name: productData.name,
              category: productData.mainCategory,
              action: existingProductsMap.has(productData.sourceId) ? 'update' : 'create',
            },
            errors: [...errors],
            warnings: [...warnings],
            message: `Processing product ${productsProcessed} of ${normalizedProducts.length}...`,
          });

          // Prepare product payload
          const productPayload = {
            name: productData.name,
            description: productData.description || null,
            price: productData.price,
            imageUrl: productData.imageUrl || null,
            category: productData.category || null,
            mainCategory: productData.mainCategory,
            subCategory: productData.subCategory || null,
            brand: productData.brand || null,
            volume: productData.volume || null,
            stockQuantity: productData.stockQuantity,
            isAvailable: productData.isAvailable,
            sourceType: apiConfig.isTestMode ? null : 'api',
            sourceId: productData.sourceId,
            apiConfigId: apiConfig.isTestMode ? null : apiConfig.id,
            isLocalOnly: false
          };

          const existingProduct = existingProductsMap.get(productData.sourceId);

          let productId: number;

          if (existingProduct && !apiConfig.isTestMode) {
            // Update existing product
            const updated = await db
              .update(products)
              .set(productPayload)
              .where(eq(products.id, existingProduct.id))
              .returning();
            productId = updated[0].id;
            productsUpdated++;
          } else {
            // Create new product (or test mode product)
            const created = await db.insert(products).values({
              ...productPayload,
              createdAt: new Date().toISOString()
            }).returning();
            productId = created[0].id;
            productsCreated++;
          }

          // Handle multiple images
          if (productData.images && productData.images.length > 1) {
            // Remove existing images if updating
            if (existingProduct && !apiConfig.isTestMode) {
              await db.delete(productImages)
                .where(eq(productImages.productId, productId));
            }

            // Add all images
            for (let i = 0; i < productData.images.length; i++) {
              await db.insert(productImages).values({
                productId,
                imageUrl: productData.images[i],
                isPrimary: i === 0,
                displayOrder: i,
                createdAt: new Date().toISOString()
              });
            }
          }

          // Handle variants (flavors, colors, etc.)
          if (productData.variants && productData.variants.length > 0) {
            // Remove existing variants if updating
            if (existingProduct && !apiConfig.isTestMode) {
              await db.delete(productVariants)
                .where(eq(productVariants.productId, productId));
            }

            // Add all variants
            for (const variant of productData.variants) {
              await db.insert(productVariants).values({
                productId,
                variantName: variant.variantName,
                variantType: variant.variantType,
                stockQuantity: variant.stockQuantity,
                priceModifier: variant.price - productData.price,
                isAvailable: variant.stockQuantity > 0,
                createdAt: new Date().toISOString()
              });
            }
          }

          // Handle bulk pricing tiers
          if (productData.bulkPricing && productData.bulkPricing.length > 0) {
            // Remove existing bulk pricing if updating
            if (existingProduct && !apiConfig.isTestMode) {
              await db.delete(bulkPricingRules)
                .where(eq(bulkPricingRules.productId, productId));
            }

            // Add all bulk pricing tiers
            for (const tier of productData.bulkPricing) {
              await db.insert(bulkPricingRules).values({
                productId,
                minQuantity: tier.minQuantity,
                discountType: 'fixed',
                discountValue: productData.price - tier.price,
                finalPrice: tier.price,
                createdAt: new Date().toISOString()
              });
            }
          }
          
        } catch (productError) {
          errors.push(`Error processing product ${productData.sourceId}: ${productError}`);
        }
      }

      // Update lastSyncedAt timestamp
      if (!apiConfig.isTestMode) {
        await db
          .update(apiConfigurations)
          .set({
            lastSyncedAt: new Date().toISOString()
          })
          .where(eq(apiConfigurations.id, apiConfig.id));
      }

      // Create success log entry
      const [successLog] = await db.insert(apiLogs).values({
        configId: apiConfig.id,
        action: apiConfig.isTestMode ? 'test' : 'sync',
        status: errors.length > 0 ? 'warning' : 'success',
        message: apiConfig.isTestMode 
          ? `Test mode: ${productsProcessed} products processed (not saved to live site)`
          : `Sync completed successfully`,
        details: JSON.stringify({
          sourceType: apiConfig.sourceType,
          dataType: apiConfig.type,
          productsProcessed,
          productsCreated,
          productsUpdated,
          errors,
          warnings,
          testMode: apiConfig.isTestMode,
          loadImages: apiConfig.loadImages,
          duplicateMerging: apiConfig.enableDuplicateMerging
        }),
        productsProcessed,
        productsCreated,
        productsUpdated,
        createdAt: new Date().toISOString()
      }).returning();

      // Final progress update
      updateSyncProgress(configId, {
        stage: 'complete',
        totalProducts: normalizedProducts.length,
        processedProducts: productsProcessed,
        createdProducts: productsCreated,
        updatedProducts: productsUpdated,
        errors: [...errors],
        warnings: [...warnings],
        message: apiConfig.isTestMode 
          ? 'Test completed successfully (products not saved)'
          : 'Sync completed successfully!',
      });

      return NextResponse.json({
        message: apiConfig.isTestMode 
          ? 'Test completed successfully (products not saved)'
          : 'Sync completed successfully',
        productsProcessed,
        productsCreated,
        productsUpdated,
        errors,
        warnings,
        testMode: apiConfig.isTestMode,
        logId: successLog.id
      }, { status: 200 });

    } catch (syncError) {
      console.error('Sync error:', syncError);

      // Create error log entry
      const [errorLog] = await db.insert(apiLogs).values({
        configId: apiConfig.id,
        action: apiConfig.isTestMode ? 'test' : 'sync',
        status: 'error',
        message: syncError instanceof Error ? syncError.message : 'Unknown sync error',
        details: JSON.stringify({
          error: syncError instanceof Error ? syncError.stack : String(syncError),
          sourceType: apiConfig.sourceType,
          dataType: apiConfig.type,
          productsProcessed,
          productsCreated,
          productsUpdated,
          errors,
          warnings,
          testMode: apiConfig.isTestMode
        }),
        productsProcessed,
        productsCreated,
        productsUpdated,
        createdAt: new Date().toISOString()
      }).returning();

      // Update progress with error
      updateSyncProgress(configId, {
        stage: 'error',
        totalProducts: 0,
        processedProducts: productsProcessed,
        createdProducts: productsCreated,
        updatedProducts: productsUpdated,
        errors: [...errors, syncError instanceof Error ? syncError.message : 'Unknown sync error'],
        warnings: [...warnings],
        message: 'Sync failed with errors',
      });

      return NextResponse.json(
        { 
          error: syncError instanceof Error ? syncError.message : 'Failed to sync products',
          code: 'SYNC_ERROR',
          logId: errorLog.id,
          productsProcessed,
          productsCreated,
          productsUpdated,
          errors,
          warnings
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('POST error:', error);
    clearSyncProgress(parseInt(params.id));
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + error,
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}