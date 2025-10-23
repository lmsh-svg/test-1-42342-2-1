import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products, productImages, bulkPricingRules, productVariants, apiConfigurations } from '@/db/schema';
import { eq } from 'drizzle-orm';

// CRITICAL: Process in smaller batches to avoid timeouts
const BATCH_SIZE = 50; // Process 50 products at a time

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiConfigId, products: requestProducts, batchIndex = 0 } = body;

    let validatedApiConfigId: number | null = null;

    if (apiConfigId) {
      if (typeof apiConfigId !== 'number' || apiConfigId <= 0) {
        return NextResponse.json({ 
          error: "Invalid apiConfigId format",
          code: "INVALID_API_CONFIG_ID" 
        }, { status: 400 });
      }

      const configExists = await db.select()
        .from(apiConfigurations)
        .where(eq(apiConfigurations.id, apiConfigId))
        .limit(1);

      if (configExists.length === 0) {
        return NextResponse.json({ 
          error: "API configuration not found",
          code: "API_CONFIG_NOT_FOUND" 
        }, { status: 404 });
      }

      validatedApiConfigId = apiConfigId;
    }

    if (!requestProducts || !Array.isArray(requestProducts) || requestProducts.length === 0) {
      return NextResponse.json({ 
        error: "Products array is required and must not be empty",
        code: "INVALID_PRODUCTS_ARRAY" 
      }, { status: 400 });
    }

    // Calculate batch
    const startIndex = batchIndex * BATCH_SIZE;
    const endIndex = Math.min(startIndex + BATCH_SIZE, requestProducts.length);
    const batch = requestProducts.slice(startIndex, endIndex);
    const hasMore = endIndex < requestProducts.length;

    let productsCreated = 0;
    let productsUpdated = 0;
    let tiersCreated = 0;
    let imagesCreated = 0;
    let variantsCreated = 0;

    // Process batch
    for (const product of batch) {
      const sourceId = product.sourceId || product.id || product.name;
      
      if (!sourceId) {
        console.warn('Product missing sourceId and name, skipping:', product);
        continue;
      }

      const existingProduct = await db.select()
        .from(products)
        .where(eq(products.sourceId, sourceId.toString()))
        .limit(1);

      let productId: number;

      if (existingProduct.length === 0) {
        const newProductData = {
          name: product.name || 'Unnamed Product',
          description: product.description || null,
          price: product.price || 0,
          imageUrl: product.imageUrl || product.image || null,
          category: product.category || null,
          mainCategory: product.mainCategory || product.category || 'Uncategorized',
          subCategory: product.subCategory || null,
          brand: product.brand || null,
          volume: product.volume || null,
          stockQuantity: product.stockQuantity || 100,
          isAvailable: true,
          sourceType: validatedApiConfigId ? 'api' : 'manual',
          sourceId: sourceId.toString(),
          apiConfigId: validatedApiConfigId,
          isLocalOnly: false,
          createdAt: new Date().toISOString()
        };

        const [insertedProduct] = await db.insert(products)
          .values(newProductData)
          .returning();

        productId = insertedProduct.id;
        productsCreated++;
      } else {
        productId = existingProduct[0].id;

        const updateData = {
          name: product.name || existingProduct[0].name,
          description: product.description || existingProduct[0].description,
          price: product.price !== undefined ? product.price : existingProduct[0].price,
          imageUrl: product.imageUrl || product.image || existingProduct[0].imageUrl,
          category: product.category || existingProduct[0].category,
          mainCategory: product.mainCategory || product.category || existingProduct[0].mainCategory,
          subCategory: product.subCategory || existingProduct[0].subCategory,
          brand: product.brand || existingProduct[0].brand,
          volume: product.volume || existingProduct[0].volume,
          stockQuantity: product.stockQuantity !== undefined ? product.stockQuantity : (existingProduct[0].stockQuantity || 100),
          isAvailable: true
        };

        await db.update(products)
          .set(updateData)
          .where(eq(products.id, productId));

        await db.delete(productImages)
          .where(eq(productImages.productId, productId));

        await db.delete(bulkPricingRules)
          .where(eq(bulkPricingRules.productId, productId));

        await db.delete(productVariants)
          .where(eq(productVariants.productId, productId));

        productsUpdated++;
      }

      // Insert product images
      if (product.images && Array.isArray(product.images) && product.images.length > 0) {
        for (let i = 0; i < product.images.length; i++) {
          const imageUrl = product.images[i];
          if (imageUrl && typeof imageUrl === 'string') {
            await db.insert(productImages).values({
              productId: productId,
              imageUrl: imageUrl,
              isPrimary: i === 0 && !product.imageUrl && !product.image,
              displayOrder: i,
              createdAt: new Date().toISOString()
            });
            imagesCreated++;
          }
        }
      }

      // Insert product variants
      if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
        for (const variant of product.variants) {
          if (variant.variantName) {
            const [insertedVariant] = await db.insert(productVariants).values({
              productId: productId,
              variantName: variant.variantName,
              variantType: variant.variantType || 'option',
              stockQuantity: variant.stockQuantity || 0,
              priceModifier: variant.priceModifier || 0,
              isAvailable: variant.isAvailable !== false,
              sourceId: variant.sourceId || null,
              createdAt: new Date().toISOString()
            }).returning();
            variantsCreated++;

            if (variant.tiers && Array.isArray(variant.tiers) && variant.tiers.length > 0) {
              for (const tier of variant.tiers) {
                if (tier.minQuantity !== undefined && tier.price !== undefined) {
                  await db.insert(bulkPricingRules).values({
                    productId: productId,
                    variantId: insertedVariant.id,
                    minQuantity: tier.minQuantity,
                    discountType: 'fixed_price',
                    discountValue: 0,
                    finalPrice: tier.price,
                    createdAt: new Date().toISOString()
                  });
                  tiersCreated++;
                }
              }
            }
          }
        }
      } else {
        if (product.pricingTiers && Array.isArray(product.pricingTiers) && product.pricingTiers.length > 0) {
          for (const tier of product.pricingTiers) {
            if (tier.minQuantity !== undefined && tier.price !== undefined) {
              await db.insert(bulkPricingRules).values({
                productId: productId,
                variantId: null,
                minQuantity: tier.minQuantity,
                discountType: 'fixed_price',
                discountValue: 0,
                finalPrice: tier.price,
                createdAt: new Date().toISOString()
              });
              tiersCreated++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      productsCreated,
      productsUpdated,
      tiersCreated,
      imagesCreated,
      variantsCreated,
      hasMore,
      nextBatchIndex: hasMore ? batchIndex + 1 : null,
      progress: {
        processed: endIndex,
        total: requestProducts.length,
        percentage: Math.round((endIndex / requestProducts.length) * 100)
      },
      message: `Batch ${batchIndex + 1}: Processed ${batch.length} products (${productsCreated} created, ${productsUpdated} updated)`
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/admin/api-configs/sync-from-json error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}