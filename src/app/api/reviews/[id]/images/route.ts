import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { reviewImages, productReviews, userRewardTiers } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reviewId = params.id;

    // Validate review ID is a valid integer
    if (!reviewId || isNaN(parseInt(reviewId))) {
      return NextResponse.json(
        { 
          error: "Valid review ID is required",
          code: "INVALID_REVIEW_ID" 
        },
        { status: 400 }
      );
    }

    const parsedReviewId = parseInt(reviewId);

    // Parse request body
    const body = await request.json();
    const { imageUrl, userId } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { 
          error: "User ID is required for authorization",
          code: "MISSING_USER_ID" 
        },
        { status: 400 }
      );
    }

    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
      return NextResponse.json(
        { 
          error: "Valid image URL is required",
          code: "MISSING_IMAGE_URL" 
        },
        { status: 400 }
      );
    }

    // Validate imageUrl format (basic URL validation)
    try {
      new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { 
          error: "Invalid URL format for imageUrl",
          code: "INVALID_URL_FORMAT" 
        },
        { status: 400 }
      );
    }

    // Check if review exists
    const existingReview = await db.select()
      .from(productReviews)
      .where(eq(productReviews.id, parsedReviewId))
      .limit(1);

    if (existingReview.length === 0) {
      return NextResponse.json(
        { 
          error: "Review not found",
          code: "REVIEW_NOT_FOUND" 
        },
        { status: 404 }
      );
    }

    const review = existingReview[0];

    // Verify userId matches the review's userId (authorization check)
    if (review.userId !== userId) {
      return NextResponse.json(
        { 
          error: "Only the review author can add images to this review",
          code: "UNAUTHORIZED" 
        },
        { status: 403 }
      );
    }

    // Insert new image into reviewImages table
    const newImage = await db.insert(reviewImages)
      .values({
        reviewId: parsedReviewId,
        imageUrl: imageUrl.trim(),
        createdAt: new Date().toISOString()
      })
      .returning();

    if (newImage.length === 0) {
      return NextResponse.json(
        { 
          error: "Failed to create review image",
          code: "CREATE_FAILED" 
        },
        { status: 500 }
      );
    }

    // Check if this is the first image for this review
    const imageCount = await db.select({ count: sql<number>`count(*)` })
      .from(reviewImages)
      .where(eq(reviewImages.reviewId, parsedReviewId));

    const totalImages = imageCount[0]?.count || 0;

    // If this was the first image, update userRewardTiers
    if (totalImages === 1) {
      // Check if user has a reward tier record
      const existingTier = await db.select()
        .from(userRewardTiers)
        .where(eq(userRewardTiers.userId, userId))
        .limit(1);

      if (existingTier.length > 0) {
        // Update existing tier
        const currentTier = existingTier[0];
        const newReviewsWithImages = (currentTier.totalReviewsWithImages || 0) + 1;
        const newRewardPoints = (currentTier.rewardPoints || 0) + 5;

        // Calculate new tier based on total reviews with images
        let newTierName = 'bronze';
        if (newReviewsWithImages >= 20) {
          newTierName = 'platinum';
        } else if (newReviewsWithImages >= 10) {
          newTierName = 'gold';
        } else if (newReviewsWithImages >= 5) {
          newTierName = 'silver';
        }

        await db.update(userRewardTiers)
          .set({
            totalReviewsWithImages: newReviewsWithImages,
            rewardPoints: newRewardPoints,
            tierName: newTierName,
            updatedAt: new Date().toISOString()
          })
          .where(eq(userRewardTiers.userId, userId));
      } else {
        // Create new tier record if it doesn't exist
        await db.insert(userRewardTiers)
          .values({
            userId: userId,
            tierName: 'bronze',
            totalReviews: 0,
            totalReviewsWithImages: 1,
            rewardPoints: 5,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
      }
    }

    return NextResponse.json(newImage[0], { status: 201 });

  } catch (error) {
    console.error('POST /api/reviews/[id]/images error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + error
      },
      { status: 500 }
    );
  }
}