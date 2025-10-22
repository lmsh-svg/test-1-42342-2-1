import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products, productImages, bulkPricingRules, productVariants, apiConfigurations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiConfigId, products: requestProducts } = body;

    if (!apiConfigId || typeof apiConfigId !== 'number' || apiConfigId <= 0) {
      return NextResponse.json({ 
        error: "Valid apiConfigId is required",
        code: "INVALID_API_CONFIG_ID" 
      }, { status: 400 });
    }

    if (!requestProducts || !Array.isArray(requestProducts) || requestProducts.length === 0) {
      return NextResponse.json({ 
        error: "Products array is required and must not be empty",
        code: "INVALID_PRODUCTS_ARRAY" 
      }, { status: 400 });
    }

    // Validate apiConfigId exists
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

    let productsCreated = 0;
    let productsUpdated = 0;
    let tiersCreated = 0;
    let imagesCreated = 0;
    let variantsCreated = 0;

    // Process each product
    for (const product of requestProducts) {
      const sourceId = product.sourceId || product.id || product.name;
      
      if (!sourceId) {
        console.warn('Product missing sourceId and name, skipping:', product);
        continue;
      }

      // Check if product exists
      const existingProduct = await db.select()
        .from(products)
        .where(eq(products.sourceId, sourceId.toString()))
        .limit(1);

      let productId: number;

      if (existingProduct.length === 0) {
        // NEW PRODUCT - Insert
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
          stockQuantity: product.stockQuantity || 0,
          isAvailable: true,
          sourceType: 'api',
          sourceId: sourceId.toString(),
          apiConfigId: apiConfigId,
          isLocalOnly: false,
          createdAt: new Date().toISOString()
        };

        const [insertedProduct] = await db.insert(products)
          .values(newProductData)
          .returning();

        productId = insertedProduct.id;
        productsCreated++;
      } else {
        // EXISTING PRODUCT - Update
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
          stockQuantity: product.stockQuantity || existingProduct[0].stockQuantity,
          isAvailable: true
        };

        await db.update(products)
          .set(updateData)
          .where(eq(products.id, productId));

        // Delete existing related records for clean update
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

      // Insert product variants (NEW!)
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
              createdAt: new Date().toISOString()
            }).returning();
            variantsCreated++;

            // Insert variant-specific tiers
            if (variant.tiers && Array.isArray(variant.tiers) && variant.tiers.length > 0) {
              for (const tier of variant.tiers) {
                if (tier.minQuantity !== undefined && tier.price !== undefined) {
                  await db.insert(bulkPricingRules).values({
                    productId: productId,
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
        // No variants - insert base product tiers
        if (product.pricingTiers && Array.isArray(product.pricingTiers) && product.pricingTiers.length > 0) {
          for (const tier of product.pricingTiers) {
            if (tier.minQuantity !== undefined && tier.price !== undefined) {
              await db.insert(bulkPricingRules).values({
                productId: productId,
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
      message: `Successfully synced ${productsCreated + productsUpdated} products (${productsCreated} created, ${productsUpdated} updated) with ${variantsCreated} variants, ${tiersCreated} pricing tiers, and ${imagesCreated} images`
    }, { status: 201 });

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}