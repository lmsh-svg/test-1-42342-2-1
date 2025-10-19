import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Tier thresholds and cashback rates
const TIER_THRESHOLDS = {
  bronze: { min: 0, max: 999, cashbackRate: 0 },
  silver: { min: 1000, max: 4999, cashbackRate: 2 },
  gold: { min: 5000, max: 9999, cashbackRate: 5 },
  platinum: { min: 10000, max: Infinity, cashbackRate: 10 }
};

const TIER_DESCRIPTIONS = {
  bronze: "Start earning rewards! Spend $1,000 to unlock 2% cashback.",
  silver: "2% cashback on all purchases. Spend $5,000 to unlock 5% cashback.",
  gold: "5% cashback on all purchases. Spend $10,000 to unlock 10% cashback.",
  platinum: "Maximum 10% cashback on all purchases! Elite status achieved."
};

type TierName = 'bronze' | 'silver' | 'gold' | 'platinum';

function calculateTier(totalSpent: number): TierName {
  if (totalSpent >= TIER_THRESHOLDS.platinum.min) return 'platinum';
  if (totalSpent >= TIER_THRESHOLDS.gold.min) return 'gold';
  if (totalSpent >= TIER_THRESHOLDS.silver.min) return 'silver';
  return 'bronze';
}

function getNextTier(currentTier: TierName): TierName | null {
  const tierOrder: TierName[] = ['bronze', 'silver', 'gold', 'platinum'];
  const currentIndex = tierOrder.indexOf(currentTier);
  
  if (currentIndex === tierOrder.length - 1) {
    return null; // Already at highest tier
  }
  
  return tierOrder[currentIndex + 1];
}

function calculateAmountUntilNextTier(totalSpent: number, currentTier: TierName): number {
  const nextTier = getNextTier(currentTier);
  
  if (!nextTier) {
    return 0; // Already at Platinum
  }
  
  const nextTierThreshold = TIER_THRESHOLDS[nextTier].min;
  return Math.max(0, nextTierThreshold - totalSpent);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');

    // Validate userId parameter
    if (!userIdParam) {
      return NextResponse.json(
        { 
          error: 'User ID is required',
          code: 'MISSING_USER_ID'
        },
        { status: 400 }
      );
    }

    const userId = parseInt(userIdParam);
    if (isNaN(userId)) {
      return NextResponse.json(
        { 
          error: 'Valid User ID is required',
          code: 'INVALID_USER_ID'
        },
        { status: 400 }
      );
    }

    // Fetch user from database
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const userData = user[0];
    const totalSpent = userData.totalSpent || 0;
    const cashbackBalance = userData.cashbackBalance || 0;

    // Calculate tier information
    const currentTier = calculateTier(totalSpent);
    const cashbackRate = TIER_THRESHOLDS[currentTier].cashbackRate;
    const nextTier = getNextTier(currentTier);
    const amountUntilNextTier = calculateAmountUntilNextTier(totalSpent, currentTier);
    const tierDescription = TIER_DESCRIPTIONS[currentTier];

    // Return comprehensive reward information
    return NextResponse.json({
      userId: userData.id,
      totalSpent,
      cashbackBalance,
      currentTier,
      cashbackRate,
      tierThresholds: {
        bronze: {
          min: TIER_THRESHOLDS.bronze.min,
          max: TIER_THRESHOLDS.bronze.max,
          cashbackRate: TIER_THRESHOLDS.bronze.cashbackRate
        },
        silver: {
          min: TIER_THRESHOLDS.silver.min,
          max: TIER_THRESHOLDS.silver.max,
          cashbackRate: TIER_THRESHOLDS.silver.cashbackRate
        },
        gold: {
          min: TIER_THRESHOLDS.gold.min,
          max: TIER_THRESHOLDS.gold.max,
          cashbackRate: TIER_THRESHOLDS.gold.cashbackRate
        },
        platinum: {
          min: TIER_THRESHOLDS.platinum.min,
          cashbackRate: TIER_THRESHOLDS.platinum.cashbackRate
        }
      },
      nextTier,
      amountUntilNextTier,
      tierDescription
    }, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + error,
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}