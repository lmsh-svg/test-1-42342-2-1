import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema';
import { sql, isNotNull, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Get distinct brands
    const brandsQuery = await db
      .selectDistinct({ brand: products.brand })
      .from(products)
      .where(isNotNull(products.brand))
      .orderBy(products.brand);

    const brands = brandsQuery
      .map(row => row.brand)
      .filter((brand): brand is string => brand !== null)
      .sort();

    // Get distinct volumes
    const volumesQuery = await db
      .selectDistinct({ volume: products.volume })
      .from(products)
      .where(isNotNull(products.volume))
      .orderBy(products.volume);

    const volumes = volumesQuery
      .map(row => row.volume)
      .filter((volume): volume is string => volume !== null)
      .sort();

    // Get distinct mainCategory and subCategory pairs
    const categoryPairsQuery = await db
      .selectDistinct({ 
        mainCategory: products.mainCategory, 
        subCategory: products.subCategory 
      })
      .from(products)
      .where(isNotNull(products.subCategory))
      .orderBy(products.mainCategory, products.subCategory);

    // Group subcategories by main category
    const subCategoriesByMainCategory: Record<string, string[]> = {};
    
    for (const row of categoryPairsQuery) {
      if (row.mainCategory && row.subCategory) {
        if (!subCategoriesByMainCategory[row.mainCategory]) {
          subCategoriesByMainCategory[row.mainCategory] = [];
        }
        if (!subCategoriesByMainCategory[row.mainCategory].includes(row.subCategory)) {
          subCategoriesByMainCategory[row.mainCategory].push(row.subCategory);
        }
      }
    }

    // Sort subcategories within each main category
    for (const mainCategory in subCategoriesByMainCategory) {
      subCategoriesByMainCategory[mainCategory].sort();
    }

    return NextResponse.json({
      brands,
      volumes,
      subCategoriesByMainCategory
    }, { status: 200 });

  } catch (error) {
    console.error('GET filters error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}