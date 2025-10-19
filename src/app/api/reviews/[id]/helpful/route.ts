import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { productReviews } from '@/db/schema';
import { eq } from 'drizzle-orm';

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
          error: 'Valid review ID is required',
          code: 'INVALID_REVIEW_ID'
        },
        { status: 400 }
      );
    }

    const parsedReviewId = parseInt(reviewId);

    // Check if review exists
    const existingReview = await db
      .select()
      .from(productReviews)
      .where(eq(productReviews.id, parsedReviewId))
      .limit(1);

    if (existingReview.length === 0) {
      return NextResponse.json(
        {
          error: 'Review not found',
          code: 'REVIEW_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const currentReview = existingReview[0];

    // Increment helpfulCount by 1 and update timestamp
    const updatedReview = await db
      .update(productReviews)
      .set({
        helpfulCount: (currentReview.helpfulCount || 0) + 1,
        updatedAt: new Date().toISOString()
      })
      .where(eq(productReviews.id, parsedReviewId))
      .returning();

    if (updatedReview.length === 0) {
      return NextResponse.json(
        {
          error: 'Failed to update review',
          code: 'UPDATE_FAILED'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedReview[0], { status: 200 });
  } catch (error) {
    console.error('POST /api/reviews/[id]/helpful error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error: ' + error
      },
      { status: 500 }
    );
  }
}