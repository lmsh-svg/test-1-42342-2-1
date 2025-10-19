import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { markups } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');
    const categoryName = url.searchParams.get('categoryName');
    const basePrice = url.searchParams.get('basePrice');

    // Validate required parameters
    if (!productId) {
      return NextResponse.json({ 
        error: "productId parameter is required",
        code: "MISSING_PRODUCT_ID" 
      }, { status: 400 });
    }

    if (!categoryName || categoryName.trim() === '') {
      return NextResponse.json({ 
        error: "categoryName parameter is required",
        code: "MISSING_CATEGORY_NAME",
        received: categoryName
      }, { status: 400 });
    }

    if (!basePrice) {
      return NextResponse.json({ 
        error: "basePrice parameter is required",
        code: "MISSING_BASE_PRICE" 
      }, { status: 400 });
    }

    // Validate productId is a valid integer
    const parsedProductId = parseInt(productId);
    if (isNaN(parsedProductId)) {
      return NextResponse.json({ 
        error: "productId must be a valid integer",
        code: "INVALID_PRODUCT_ID" 
      }, { status: 400 });
    }

    // Validate basePrice is a valid positive number
    const parsedBasePrice = parseFloat(basePrice);
    if (isNaN(parsedBasePrice) || parsedBasePrice < 0) {
      return NextResponse.json({ 
        error: "basePrice must be a valid positive number",
        code: "INVALID_BASE_PRICE" 
      }, { status: 400 });
    }

    // Validate categoryName is non-empty string
    const trimmedCategoryName = categoryName.trim();
    if (trimmedCategoryName.length === 0) {
      return NextResponse.json({ 
        error: "categoryName must be a non-empty string",
        code: "INVALID_CATEGORY_NAME" 
      }, { status: 400 });
    }

    // Fetch all active markups
    const allMarkups = await db.select()
      .from(markups)
      .where(eq(markups.isActive, true));

    // Filter markups that apply to this product
    const applicableMarkups = allMarkups.filter(markup => {
      if (markup.type === 'site_wide') {
        return true;
      }
      
      if (markup.type === 'category' && markup.targetId === trimmedCategoryName) {
        return true;
      }
      
      if (markup.type === 'product' && markup.targetId === productId) {
        return true;
      }
      
      return false;
    });

    // Sort by priority DESC (higher priority first)
    const sortedMarkups = applicableMarkups.sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA;
    });

    // Apply markups in order and build breakdown
    let currentPrice = parsedBasePrice;
    const appliedMarkups = [];

    for (const markup of sortedMarkups) {
      let priceAfterMarkup = currentPrice;

      if (markup.markupType === 'percentage') {
        priceAfterMarkup = currentPrice * (1 + markup.markupValue / 100);
      } else if (markup.markupType === 'fixed_amount') {
        priceAfterMarkup = currentPrice + markup.markupValue;
      }

      // Ensure price never goes below 0
      priceAfterMarkup = Math.max(0, priceAfterMarkup);

      appliedMarkups.push({
        id: markup.id,
        name: markup.name,
        type: markup.type,
        markupType: markup.markupType,
        markupValue: markup.markupValue,
        priority: markup.priority ?? 0,
        priceAfterMarkup: Math.round(priceAfterMarkup * 100) / 100
      });

      currentPrice = priceAfterMarkup;
    }

    const finalPrice = Math.max(0, currentPrice);

    return NextResponse.json({
      basePrice: Math.round(parsedBasePrice * 100) / 100,
      finalPrice: Math.round(finalPrice * 100) / 100,
      appliedMarkups
    }, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}