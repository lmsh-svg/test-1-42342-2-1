import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { markups } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Extract query parameters
    const productIdParam = searchParams.get('productId');
    const categoryName = searchParams.get('categoryName');
    const basePriceParam = searchParams.get('basePrice');

    // Validate all required parameters are present
    if (!productIdParam) {
      return NextResponse.json(
        { error: 'productId is required', code: 'MISSING_PRODUCT_ID' },
        { status: 400 }
      );
    }

    if (!categoryName) {
      return NextResponse.json(
        { error: 'categoryName is required', code: 'MISSING_CATEGORY_NAME' },
        { status: 400 }
      );
    }

    if (!basePriceParam) {
      return NextResponse.json(
        { error: 'basePrice is required', code: 'MISSING_BASE_PRICE' },
        { status: 400 }
      );
    }

    // Validate productId is a valid integer
    const productId = parseInt(productIdParam);
    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'productId must be a valid integer', code: 'INVALID_PRODUCT_ID' },
        { status: 400 }
      );
    }

    // Validate basePrice is a valid positive number
    const basePrice = parseFloat(basePriceParam);
    if (isNaN(basePrice) || basePrice < 0) {
      return NextResponse.json(
        { error: 'basePrice must be a valid positive number', code: 'INVALID_BASE_PRICE' },
        { status: 400 }
      );
    }

    // Validate categoryName is non-empty
    if (categoryName.trim().length === 0) {
      return NextResponse.json(
        { error: 'categoryName must be a non-empty string', code: 'INVALID_CATEGORY_NAME' },
        { status: 400 }
      );
    }

    // Fetch all active markups
    const allActiveMarkups = await db
      .select()
      .from(markups)
      .where(eq(markups.isActive, true));

    // Filter markups that apply to this product
    const applicableMarkups = allActiveMarkups.filter(markup => {
      if (markup.type === 'site_wide') {
        return true;
      }
      
      if (markup.type === 'category' && markup.targetId === categoryName) {
        return true;
      }
      
      if (markup.type === 'product' && markup.targetId === productId.toString()) {
        return true;
      }
      
      return false;
    });

    // Sort by priority DESC (higher priority first)
    applicableMarkups.sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA;
    });

    // Apply markups sequentially and track the breakdown
    let currentPrice = basePrice;
    const appliedMarkups = [];

    for (const markup of applicableMarkups) {
      if (markup.markupType === 'percentage') {
        currentPrice = currentPrice * (1 + markup.markupValue / 100);
      } else if (markup.markupType === 'fixed_amount') {
        currentPrice = currentPrice + markup.markupValue;
      }

      // Ensure price never goes below 0
      currentPrice = Math.max(0, currentPrice);

      appliedMarkups.push({
        id: markup.id,
        name: markup.name,
        type: markup.type,
        markupType: markup.markupType,
        markupValue: markup.markupValue,
        priority: markup.priority ?? 0,
        priceAfterMarkup: Math.round(currentPrice * 100) / 100
      });
    }

    // Return the result with breakdown
    return NextResponse.json({
      basePrice: Math.round(basePrice * 100) / 100,
      finalPrice: Math.round(currentPrice * 100) / 100,
      appliedMarkups
    }, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}