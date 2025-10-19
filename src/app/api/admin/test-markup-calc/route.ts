import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { markups, markupTiers } from '@/db/schema';
import { eq, and, lte, or, isNull, gte } from 'drizzle-orm';

interface MarkupWithTiers {
  markup: typeof markups.$inferSelect;
  tiers: (typeof markupTiers.$inferSelect)[];
}

interface MarkupCalculation {
  markupId: number;
  name: string;
  type: string;
  markupType: string;
  appliedValue: number;
  tierUsed: {
    minQuantity: number;
    maxQuantity: number | null;
    markupValue: number;
  } | null;
  compoundStrategy: string;
  priceBeforeThisMarkup: number;
  priceAfterThisMarkup: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const productIdParam = searchParams.get('productId');
    const categoryName = searchParams.get('categoryName');
    const basePriceParam = searchParams.get('basePrice');
    const quantityParam = searchParams.get('quantity') || '1';

    // Validate required parameters
    if (!productIdParam) {
      return NextResponse.json({ 
        error: "productId is required",
        code: "MISSING_PRODUCT_ID" 
      }, { status: 400 });
    }

    if (!categoryName) {
      return NextResponse.json({ 
        error: "categoryName is required",
        code: "MISSING_CATEGORY_NAME" 
      }, { status: 400 });
    }

    if (!basePriceParam) {
      return NextResponse.json({ 
        error: "basePrice is required",
        code: "MISSING_BASE_PRICE" 
      }, { status: 400 });
    }

    // Parse and validate numeric parameters
    const productId = parseInt(productIdParam);
    const basePrice = parseFloat(basePriceParam);
    const quantity = parseInt(quantityParam);

    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json({ 
        error: "Valid productId is required",
        code: "INVALID_PRODUCT_ID" 
      }, { status: 400 });
    }

    if (isNaN(basePrice) || basePrice <= 0) {
      return NextResponse.json({ 
        error: "Valid basePrice is required",
        code: "INVALID_BASE_PRICE" 
      }, { status: 400 });
    }

    if (isNaN(quantity) || quantity <= 0) {
      return NextResponse.json({ 
        error: "Valid quantity is required",
        code: "INVALID_QUANTITY" 
      }, { status: 400 });
    }

    const currentDate = new Date().toISOString();

    // Fetch active markups with time-based filtering
    const activeMarkups = await db.select()
      .from(markups)
      .where(
        and(
          eq(markups.isActive, true),
          or(
            isNull(markups.startDate),
            lte(markups.startDate, currentDate)
          ),
          or(
            isNull(markups.endDate),
            gte(markups.endDate, currentDate)
          )
        )
      );

    // Filter applicable markups by type
    const applicableMarkups: MarkupWithTiers[] = [];

    for (const markup of activeMarkups) {
      let isApplicable = false;

      if (markup.type === 'site_wide') {
        isApplicable = true;
      } else if (markup.type === 'category' && markup.targetId === categoryName) {
        isApplicable = true;
      } else if (markup.type === 'product' && markup.targetId === productId.toString()) {
        isApplicable = true;
      }

      if (isApplicable) {
        // Fetch markup tiers for this markup
        const tiers = await db.select()
          .from(markupTiers)
          .where(eq(markupTiers.markupId, markup.id));

        applicableMarkups.push({
          markup,
          tiers
        });
      }
    }

    // Sort markups by priority (higher priority first)
    applicableMarkups.sort((a, b) => (b.markup.priority || 0) - (a.markup.priority || 0));

    // Apply markups with compound strategies
    let currentPrice = basePrice;
    const calculations: MarkupCalculation[] = [];

    for (const { markup, tiers } of applicableMarkups) {
      const priceBeforeThisMarkup = currentPrice;
      let appliedValue = markup.markupValue;
      let tierUsed: MarkupCalculation['tierUsed'] = null;

      // Apply tier-based markup if tiers exist
      if (tiers.length > 0) {
        // Sort tiers by minQuantity descending to find the highest applicable tier
        const sortedTiers = [...tiers].sort((a, b) => b.minQuantity - a.minQuantity);
        
        for (const tier of sortedTiers) {
          const meetsMin = quantity >= tier.minQuantity;
          const meetsMax = tier.maxQuantity === null || quantity <= tier.maxQuantity;
          
          if (meetsMin && meetsMax) {
            appliedValue = tier.markupValue;
            tierUsed = {
              minQuantity: tier.minQuantity,
              maxQuantity: tier.maxQuantity,
              markupValue: tier.markupValue
            };
            break;
          }
        }
      }

      // Calculate markup based on type
      let markupAmount = 0;
      if (markup.markupType === 'percentage') {
        markupAmount = (currentPrice * appliedValue) / 100;
      } else if (markup.markupType === 'fixed') {
        markupAmount = appliedValue;
      }

      // Apply compound strategy
      if (markup.compoundStrategy === 'replace') {
        // Replace previous markups - reset to base price
        currentPrice = basePrice + markupAmount;
      } else if (markup.compoundStrategy === 'add') {
        // Add to current price (compound)
        currentPrice = currentPrice + markupAmount;
      } else if (markup.compoundStrategy === 'multiply') {
        // Multiply current price
        currentPrice = currentPrice * (1 + (markup.markupType === 'percentage' ? appliedValue / 100 : appliedValue));
      }

      calculations.push({
        markupId: markup.id,
        name: markup.name,
        type: markup.type,
        markupType: markup.markupType,
        appliedValue,
        tierUsed,
        compoundStrategy: markup.compoundStrategy,
        priceBeforeThisMarkup,
        priceAfterThisMarkup: currentPrice
      });
    }

    const totalMarkup = currentPrice - basePrice;
    const markupPercentage = (totalMarkup / basePrice) * 100;

    return NextResponse.json({
      input: {
        productId,
        categoryName,
        basePrice,
        quantity
      },
      result: {
        basePrice,
        finalPrice: Math.round(currentPrice * 100) / 100,
        totalMarkup: Math.round(totalMarkup * 100) / 100,
        markupPercentage: Math.round(markupPercentage * 100) / 100
      },
      markupsApplied: calculations,
      summary: {
        totalMarkupsFound: applicableMarkups.length,
        markupsApplied: calculations.length,
        compoundingUsed: calculations.some(c => c.compoundStrategy !== 'replace')
      }
    }, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}