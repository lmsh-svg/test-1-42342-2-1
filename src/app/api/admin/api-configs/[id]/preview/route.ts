import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiConfigurations, apiLogs, products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseJSONProducts, parseHTMLProducts, normalizeProducts } from '@/lib/api-parsers';

interface PreviewProduct {
  action: 'create' | 'update';
  name: string;
  price: number;
  description?: string;
  mainCategory: string;
  brand?: string;
  imageUrl?: string;
  images?: string[];
  stockQuantity: number;
  sourceId: string;
  existingId?: number;
  tags?: Record<string, string>;
  variants?: any[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const configId = params.id;

    // Validate configuration ID
    if (!configId || isNaN(parseInt(configId))) {
      return NextResponse.json(
        { 
          error: 'Valid configuration ID is required',
          code: 'INVALID_CONFIG_ID' 
        },
        { status: 400 }
      );
    }

    const parsedConfigId = parseInt(configId);

    // Fetch the configuration
    const config = await db
      .select()
      .from(apiConfigurations)
      .where(eq(apiConfigurations.id, parsedConfigId))
      .limit(1);

    if (config.length === 0) {
      return NextResponse.json(
        { 
          error: 'API configuration not found',
          code: 'CONFIG_NOT_FOUND' 
        },
        { status: 404 }
      );
    }

    const configuration = config[0];
    let rawData: string;

    // Fetch data based on source type
    try {
      if (configuration.sourceType === 'url') {
        if (!configuration.sourceUrl) {
          await db.insert(apiLogs).values({
            configId: parsedConfigId,
            action: 'preview',
            status: 'error',
            message: 'Source URL is not configured',
            createdAt: new Date().toISOString(),
          });

          return NextResponse.json(
            { 
              error: 'Source URL is not configured',
              code: 'MISSING_SOURCE_URL' 
            },
            { status: 400 }
          );
        }

        const response = await fetch(configuration.sourceUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch from URL: ${response.statusText}`);
        }
        rawData = await response.text();
      } else if (configuration.sourceType === 'file') {
        if (!configuration.sourceContent) {
          await db.insert(apiLogs).values({
            configId: parsedConfigId,
            action: 'preview',
            status: 'error',
            message: 'Source content is not configured',
            createdAt: new Date().toISOString(),
          });

          return NextResponse.json(
            { 
              error: 'Source content is not configured',
              code: 'MISSING_SOURCE_CONTENT' 
            },
            { status: 400 }
          );
        }
        rawData = configuration.sourceContent;
      } else {
        await db.insert(apiLogs).values({
          configId: parsedConfigId,
          action: 'preview',
          status: 'error',
          message: `Invalid source type: ${configuration.sourceType}`,
          createdAt: new Date().toISOString(),
        });

        return NextResponse.json(
          { 
            error: `Invalid source type: ${configuration.sourceType}`,
            code: 'INVALID_SOURCE_TYPE' 
          },
          { status: 400 }
        );
      }
    } catch (fetchError) {
      await db.insert(apiLogs).values({
        configId: parsedConfigId,
        action: 'preview',
        status: 'error',
        message: `Failed to fetch data: ${fetchError}`,
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json(
        { 
          error: `Failed to fetch data: ${fetchError}`,
          code: 'FETCH_ERROR' 
        },
        { status: 500 }
      );
    }

    // Parse data using appropriate parser
    let parseResult;
    try {
      if (configuration.type === 'json') {
        parseResult = parseJSONProducts(rawData);
      } else if (configuration.type === 'html') {
        parseResult = parseHTMLProducts(rawData);
      } else {
        await db.insert(apiLogs).values({
          configId: parsedConfigId,
          action: 'preview',
          status: 'error',
          message: `Unsupported configuration type: ${configuration.type}`,
          createdAt: new Date().toISOString(),
        });

        return NextResponse.json(
          { 
            error: `Unsupported configuration type: ${configuration.type}`,
            code: 'UNSUPPORTED_TYPE' 
          },
          { status: 500 }
        );
      }
    } catch (parseError) {
      await db.insert(apiLogs).values({
        configId: parsedConfigId,
        action: 'preview',
        status: 'error',
        message: `Failed to parse data: ${parseError}`,
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json(
        { 
          error: `Failed to parse data: ${parseError}`,
          code: 'PARSE_ERROR' 
        },
        { status: 500 }
      );
    }

    // Normalize products
    const normalizedProducts = normalizeProducts(parseResult.products);

    // Fetch all existing products for this API configuration
    const existingProducts = await db
      .select()
      .from(products)
      .where(eq(products.apiConfigId, parsedConfigId));

    // Create a map for quick lookup
    const existingProductsMap = new Map(
      existingProducts.map(p => [p.sourceId, p])
    );

    // Process products and determine action (create/update)
    const previewProducts: PreviewProduct[] = [];
    let toBeCreated = 0;
    let toBeUpdated = 0;

    for (const sourceProduct of normalizedProducts) {
      const existingProduct = existingProductsMap.get(sourceProduct.sourceId);

      const previewItem: PreviewProduct = {
        action: existingProduct ? 'update' : 'create',
        name: sourceProduct.name,
        price: sourceProduct.price,
        description: sourceProduct.description,
        mainCategory: sourceProduct.mainCategory,
        brand: sourceProduct.brand,
        imageUrl: sourceProduct.imageUrl,
        images: sourceProduct.images,
        stockQuantity: sourceProduct.stockQuantity,
        sourceId: sourceProduct.sourceId,
        tags: sourceProduct.tags,
        variants: sourceProduct.variants,
        existingId: existingProduct?.id
      };

      previewProducts.push(previewItem);

      if (existingProduct) {
        toBeUpdated++;
      } else {
        toBeCreated++;
      }
    }

    // Create log entry
    const logEntry = await db.insert(apiLogs).values({
      configId: parsedConfigId,
      action: 'preview',
      status: parseResult.errors.length > 0 ? 'warning' : 'success',
      message: `Preview completed: ${toBeCreated} to create, ${toBeUpdated} to update`,
      details: JSON.stringify({
        errors: parseResult.errors,
        warnings: parseResult.warnings
      }),
      productsProcessed: previewProducts.length,
      productsCreated: toBeCreated,
      productsUpdated: toBeUpdated,
      createdAt: new Date().toISOString(),
    }).returning();

    // Return preview summary with sample products
    return NextResponse.json(
      {
        summary: {
          totalProducts: previewProducts.length,
          toBeCreated,
          toBeUpdated,
        },
        sampleProducts: previewProducts.slice(0, 20),
        allProducts: previewProducts,
        errors: parseResult.errors,
        warnings: parseResult.warnings,
        logId: logEntry[0].id,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('POST preview error:', error);
    
    // Try to log the error if we have a config ID
    try {
      const configId = params.id;
      if (configId && !isNaN(parseInt(configId))) {
        await db.insert(apiLogs).values({
          configId: parseInt(configId),
          action: 'preview',
          status: 'error',
          message: `Internal error: ${error}`,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      { 
        error: 'Internal server error: ' + error,
        code: 'INTERNAL_ERROR' 
      },
      { status: 500 }
    );
  }
}