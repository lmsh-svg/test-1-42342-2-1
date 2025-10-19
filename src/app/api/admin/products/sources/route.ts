import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products, apiConfigurations } from '@/db/schema';
import { eq, isNull, isNotNull, sql, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const groupBy = searchParams.get('groupBy') || 'sourceType';
    const includeDetails = searchParams.get('includeDetails') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    // Validate groupBy parameter
    if (!['sourceType', 'apiConfig'].includes(groupBy)) {
      return NextResponse.json(
        { 
          error: 'Invalid groupBy parameter. Must be either "sourceType" or "apiConfig"',
          code: 'INVALID_GROUP_BY'
        },
        { status: 400 }
      );
    }

    if (groupBy === 'sourceType') {
      // Group by sourceType
      const countQuery = await db
        .select({
          sourceType: products.sourceType,
          count: sql<number>`count(*)`.as('count')
        })
        .from(products)
        .groupBy(products.sourceType);

      const groups = await Promise.all(
        countQuery.map(async (group) => {
          const groupData: any = {
            sourceType: group.sourceType,
            count: Number(group.count)
          };

          if (includeDetails) {
            const sampleProducts = await db
              .select({
                id: products.id,
                name: products.name,
                price: products.price,
                mainCategory: products.mainCategory,
                category: products.category,
                brand: products.brand,
                imageUrl: products.imageUrl
              })
              .from(products)
              .where(
                group.sourceType === null
                  ? isNull(products.sourceType)
                  : eq(products.sourceType, group.sourceType)
              )
              .limit(limit);

            groupData.products = sampleProducts;
          }

          return groupData;
        })
      );

      const totalProducts = groups.reduce((sum, group) => sum + group.count, 0);

      return NextResponse.json({
        groups: groups.sort((a, b) => b.count - a.count),
        totalProducts
      });
    }

    if (groupBy === 'apiConfig') {
      // Group API products by apiConfigId
      const apiProductCounts = await db
        .select({
          apiConfigId: products.apiConfigId,
          count: sql<number>`count(*)`.as('count')
        })
        .from(products)
        .where(
          and(
            isNotNull(products.apiConfigId),
            eq(products.sourceType, 'api')
          )
        )
        .groupBy(products.apiConfigId);

      // Get custom/local products count
      const customProductsCount = await db
        .select({
          count: sql<number>`count(*)`.as('count')
        })
        .from(products)
        .where(
          sql`${products.sourceType} = 'custom' OR ${products.sourceType} IS NULL OR ${products.isLocalOnly} = 1`
        );

      const groups: any[] = [];

      // Process API config groups
      for (const group of apiProductCounts) {
        if (group.apiConfigId === null) continue;

        const groupData: any = {
          apiConfigId: group.apiConfigId,
          count: Number(group.count)
        };

        // Get config name
        const configData = await db
          .select({
            name: apiConfigurations.name
          })
          .from(apiConfigurations)
          .where(eq(apiConfigurations.id, group.apiConfigId))
          .limit(1);

        groupData.configName = configData[0]?.name || 'Unknown Config';

        if (includeDetails) {
          const sampleProducts = await db
            .select({
              id: products.id,
              name: products.name,
              price: products.price,
              mainCategory: products.mainCategory,
              category: products.category,
              brand: products.brand,
              imageUrl: products.imageUrl
            })
            .from(products)
            .where(
              and(
                eq(products.apiConfigId, group.apiConfigId),
                eq(products.sourceType, 'api')
              )
            )
            .limit(limit);

          groupData.products = sampleProducts;
        }

        groups.push(groupData);
      }

      // Add custom products group
      const customCount = Number(customProductsCount[0]?.count || 0);
      if (customCount > 0) {
        const customGroup: any = {
          sourceType: 'custom',
          count: customCount
        };

        if (includeDetails) {
          const sampleProducts = await db
            .select({
              id: products.id,
              name: products.name,
              price: products.price,
              mainCategory: products.mainCategory,
              category: products.category,
              brand: products.brand,
              imageUrl: products.imageUrl
            })
            .from(products)
            .where(
              sql`${products.sourceType} = 'custom' OR ${products.sourceType} IS NULL OR ${products.isLocalOnly} = 1`
            )
            .limit(limit);

          customGroup.products = sampleProducts;
        }

        groups.push(customGroup);
      }

      const totalProducts = groups.reduce((sum, group) => sum + group.count, 0);

      return NextResponse.json({
        groups: groups.sort((a, b) => b.count - a.count),
        totalProducts
      });
    }

    return NextResponse.json(
      { error: 'Invalid request', code: 'INVALID_REQUEST' },
      { status: 400 }
    );
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}