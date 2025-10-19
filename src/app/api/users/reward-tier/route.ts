import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, userRewardTiers } from '@/db/schema';
import { eq } from 'drizzle-orm';

const TIER_THRESHOLDS = {
  bronze: { min: 1, max: 4 },
  silver: { min: 5, max: 14 },
  gold: { min: 15, max: 29 },
  platinum: { min: 30, max: Infinity }
};

const TIER_DESCRIPTIONS = {
  bronze: 'Welcome to our rewards program! Start earning points with every review.',
  silver: 'Great progress! Enjoy enhanced benefits and exclusive offers.',
  gold: 'You\'re a valued contributor! Access premium rewards and early product launches.',
  platinum: 'Elite status! Maximum benefits including priority support and special perks.'
};

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];

function calculateTierProgress(totalReviews: number, currentTier: string) {
  const currentTierIndex = TIER_ORDER.indexOf(currentTier);
  
  if (currentTierIndex === TIER_ORDER.length - 1) {
    return {
      nextTier: null,
      reviewsUntilNextTier: 0
    };
  }

  const nextTier = TIER_ORDER[currentTierIndex + 1];
  const nextTierThreshold = TIER_THRESHOLDS[nextTier as keyof typeof TIER_THRESHOLDS].min;
  const reviewsUntilNextTier = Math.max(0, nextTierThreshold - totalReviews);

  return {
    nextTier,
    reviewsUntilNextTier
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || isNaN(parseInt(userId))) {
      return NextResponse.json({
        error: 'Valid userId is required',
        code: 'INVALID_USER_ID'
      }, { status: 400 });
    }

    const userIdInt = parseInt(userId);

    const user = await db.select()
      .from(users)
      .where(eq(users.id, userIdInt))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      }, { status: 404 });
    }

    let rewardTier = await db.select()
      .from(userRewardTiers)
      .where(eq(userRewardTiers.userId, userIdInt))
      .limit(1);

    if (rewardTier.length === 0) {
      const now = new Date().toISOString();
      const newRewardTier = await db.insert(userRewardTiers)
        .values({
          userId: userIdInt,
          tierName: 'bronze',
          totalReviews: 0,
          totalReviewsWithImages: 0,
          rewardPoints: 0,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      rewardTier = newRewardTier;
    }

    const tierData = rewardTier[0];
    const tierProgress = calculateTierProgress(tierData.totalReviews, tierData.tierName);

    return NextResponse.json({
      id: tierData.id,
      userId: tierData.userId,
      tierName: tierData.tierName,
      totalReviews: tierData.totalReviews,
      totalReviewsWithImages: tierData.totalReviewsWithImages,
      rewardPoints: tierData.rewardPoints,
      createdAt: tierData.createdAt,
      updatedAt: tierData.updatedAt,
      nextTier: tierProgress.nextTier,
      reviewsUntilNextTier: tierProgress.reviewsUntilNextTier,
      tierDescription: TIER_DESCRIPTIONS[tierData.tierName as keyof typeof TIER_DESCRIPTIONS]
    }, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error
    }, { status: 500 });
  }
}