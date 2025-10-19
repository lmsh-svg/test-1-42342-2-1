import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { markups, markupTiers } from '@/db/schema';
import { eq, and, lte, or, isNull, gte } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Extract query parameters
    const productIdParam = searchParams.get('productId');
    const categoryName = searchParams.get('categoryName');
    const basePriceParam = searchParams.get('basePrice');
    const quantityParam = searchParams.get('quantity');

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

    // Parse and validate quantity (optional)
    let quantity = 1;
    if (quantityParam) {
      quantity = parseInt(quantityParam);
      if (isNaN(quantity) || quantity < 1) {
        return NextResponse.json(
          { error: 'quantity must be a positive integer >= 1', code: 'INVALID_QUANTITY' },
          { status: 400 }
        );
      }
    }

    // Get current date/time for time-based markup filtering
    const now = new Date().toISOString();

    // Fetch all active markups with time-based filtering
    const allActiveMarkups = await db
      .select()
      .from(markups)
      .where(
        and(
          eq(markups.isActive, true),
          // Start date check: either null or <= now
          or(
            isNull(markups.startDate),
            lte(markups.startDate, now)
          ),
          // End date check: either null or >= now
          or(
            isNull(markups.endDate),
            gte(markups.endDate, now)
          )
        )
      );

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

    // For each markup, check if it has tier-based values
    const markupsWithTiers = await Promise.all(
      applicableMarkups.map(async (markup) => {
        const tiers = await db
          .select()
          .from(markupTiers)
          .where(eq(markupTiers.markupId, markup.id))
          .orderBy(markupTiers.minQuantity);

        return { markup, tiers };
      })
    );

    // Apply markups based on compound strategy
    let currentPrice = basePrice;
    const appliedMarkups = [];

    for (const { markup, tiers } of markupsWithTiers) {
      let effectiveMarkupValue = markup.markupValue;

      // If tiers exist, find the applicable tier based on quantity
      if (tiers.length > 0) {
        const applicableTier = tiers.find(tier => {
          const meetsMin = quantity >= tier.minQuantity;
          const meetsMax = tier.maxQuantity === null || quantity <= tier.maxQuantity;
          return meetsMin && meetsMax;
        });

        if (applicableTier) {
          effectiveMarkupValue = applicableTier.markupValue;
        }
      }

      let priceAfterMarkup = currentPrice;

      // Apply markup based on compound strategy
      if (markup.compoundStrategy === 'replace') {
        // Replace strategy: apply markup to base price
        if (markup.markupType === 'percentage') {
          priceAfterMarkup = basePrice * (1 + effectiveMarkupValue / 100);
        } else if (markup.markupType === 'fixed_amount') {
          priceAfterMarkup = basePrice + effectiveMarkupValue;
        }
      } else if (markup.compoundStrategy === 'add') {
        // Add strategy: apply markup to current price (cumulative)
        if (markup.markupType === 'percentage') {
          priceAfterMarkup = currentPrice * (1 + effectiveMarkupValue / 100);
        } else if (markup.markupType === 'fixed_amount') {
          priceAfterMarkup = currentPrice + effectiveMarkupValue;
        }
      } else if (markup.compoundStrategy === 'multiply') {
        // Multiply strategy: multiply the markup effect
        if (markup.markupType === 'percentage') {
          const markupFactor = 1 + effectiveMarkupValue / 100;
          priceAfterMarkup = currentPrice * markupFactor;
        } else if (markup.markupType === 'fixed_amount') {
          priceAfterMarkup = currentPrice + effectiveMarkupValue;
        }
      }

      // Ensure price never goes below 0
      priceAfterMarkup = Math.max(0, priceAfterMarkup);

      appliedMarkups.push({
        id: markup.id,
        name: markup.name,
        type: markup.type,
        markupType: markup.markupType,
        markupValue: effectiveMarkupValue,
        originalMarkupValue: markup.markupValue,
        priority: markup.priority ?? 0,
        compoundStrategy: markup.compoundStrategy,
        usedTier: tiers.length > 0,
        priceAfterMarkup: Math.round(priceAfterMarkup * 100) / 100
      });

      currentPrice = priceAfterMarkup;
    }

    const finalPrice = Math.max(0, currentPrice);

    return NextResponse.json({
      basePrice: Math.round(basePrice * 100) / 100,
      finalPrice: Math.round(finalPrice * 100) / 100,
      quantity,
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