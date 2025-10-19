import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { productReviews, reviewImages, userRewardTiers, users, products, orders, orderItems } from '@/db/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';

function obfuscateUsername(username: string): string {
  if (username.length <= 2) {
    return username;
  }
  const first = username.charAt(0);
  const last = username.charAt(username.length - 1);
  const middle = '*'.repeat(username.length - 2);
  return `${first}${middle}${last}`;
}

function calculateTierName(totalReviews: number): string {
  if (totalReviews >= 30) return 'Platinum';
  if (totalReviews >= 15) return 'Gold';
  if (totalReviews >= 5) return 'Silver';
  return 'Bronze';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;
    const searchParams = request.nextUrl.searchParams;

    if (!productId || isNaN(parseInt(productId))) {
      return NextResponse.json({
        error: 'Valid product ID is required',
        code: 'INVALID_PRODUCT_ID'
      }, { status: 400 });
    }

    const productIdInt = parseInt(productId);

    const product = await db.select()
      .from(products)
      .where(eq(products.id, productIdInt))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json({
        error: 'Product not found',
        code: 'PRODUCT_NOT_FOUND'
      }, { status: 404 });
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'date';
    const order = searchParams.get('order') || 'desc';
    const ratingFilter = searchParams.get('rating');

    let query = db.select({
      review: productReviews,
      user: users,
      rewardTier: userRewardTiers
    })
      .from(productReviews)
      .leftJoin(users, eq(productReviews.userId, users.id))
      .leftJoin(userRewardTiers, eq(productReviews.userId, userRewardTiers.userId))
      .where(eq(productReviews.productId, productIdInt));

    if (ratingFilter) {
      const rating = parseInt(ratingFilter);
      if (!isNaN(rating) && rating >= 1 && rating <= 5) {
        query = db.select({
          review: productReviews,
          user: users,
          rewardTier: userRewardTiers
        })
          .from(productReviews)
          .leftJoin(users, eq(productReviews.userId, users.id))
          .leftJoin(userRewardTiers, eq(productReviews.userId, userRewardTiers.userId))
          .where(and(
            eq(productReviews.productId, productIdInt),
            eq(productReviews.rating, rating)
          ));
      }
    }

    let orderByColumn;
    switch (sortBy) {
      case 'rating':
        orderByColumn = productReviews.rating;
        break;
      case 'helpful':
        orderByColumn = productReviews.helpfulCount;
        break;
      case 'date':
      default:
        orderByColumn = productReviews.createdAt;
        break;
    }

    const orderFn = order === 'asc' ? asc : desc;
    const results = await query
      .orderBy(orderFn(orderByColumn))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = results.length > limit;
    const reviewsData = results.slice(0, limit);

    const reviewIds = reviewsData.map(r => r.review.id);
    let images: any[] = [];
    if (reviewIds.length > 0) {
      images = await db.select()
        .from(reviewImages)
        .where(inArray(reviewImages.reviewId, reviewIds));
    }

    const reviewsWithDetails = reviewsData.map(({ review, user, rewardTier }) => {
      const reviewImgs = images.filter(img => img.reviewId === review.id);
      
      return {
        ...review,
        user: {
          username: user ? obfuscateUsername(user.username) : 'Unknown'
        },
        rewardTier: rewardTier ? {
          tierName: rewardTier.tierName,
          totalReviews: rewardTier.totalReviews,
          rewardPoints: rewardTier.rewardPoints
        } : {
          tierName: 'Bronze',
          totalReviews: 0,
          rewardPoints: 0
        },
        images: reviewImgs.map(img => ({
          id: img.id,
          imageUrl: img.imageUrl,
          createdAt: img.createdAt
        }))
      };
    });

    const allReviews = await db.select({
      rating: productReviews.rating
    })
      .from(productReviews)
      .where(eq(productReviews.productId, productIdInt));

    const totalReviews = allReviews.length;
    const averageRating = totalReviews > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

    return NextResponse.json({
      reviews: reviewsWithDetails,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews,
      pagination: {
        limit,
        offset,
        hasMore
      }
    }, { status: 200 });

  } catch (error) {
    console.error('GET reviews error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;

    if (!productId || isNaN(parseInt(productId))) {
      return NextResponse.json({
        error: 'Valid product ID is required',
        code: 'INVALID_PRODUCT_ID'
      }, { status: 400 });
    }

    const productIdInt = parseInt(productId);

    const body = await request.json();
    const { userId, rating, title, comment, orderId } = body;

    if (!userId) {
      return NextResponse.json({
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      }, { status: 400 });
    }

    if (!rating) {
      return NextResponse.json({
        error: 'Rating is required',
        code: 'MISSING_RATING'
      }, { status: 400 });
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({
        error: 'Rating must be an integer between 1 and 5',
        code: 'INVALID_RATING'
      }, { status: 400 });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({
        error: 'Title is required and must be a non-empty string',
        code: 'INVALID_TITLE'
      }, { status: 400 });
    }

    if (title.length > 200) {
      return NextResponse.json({
        error: 'Title must not exceed 200 characters',
        code: 'TITLE_TOO_LONG'
      }, { status: 400 });
    }

    if (comment !== undefined && comment !== null) {
      if (typeof comment !== 'string') {
        return NextResponse.json({
          error: 'Comment must be a string',
          code: 'INVALID_COMMENT'
        }, { status: 400 });
      }
      if (comment.length > 2000) {
        return NextResponse.json({
          error: 'Comment must not exceed 2000 characters',
          code: 'COMMENT_TOO_LONG'
        }, { status: 400 });
      }
    }

    const product = await db.select()
      .from(products)
      .where(eq(products.id, productIdInt))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json({
        error: 'Product not found',
        code: 'PRODUCT_NOT_FOUND'
      }, { status: 404 });
    }

    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      }, { status: 404 });
    }

    const existingReview = await db.select()
      .from(productReviews)
      .where(and(
        eq(productReviews.userId, userId),
        eq(productReviews.productId, productIdInt)
      ))
      .limit(1);

    if (existingReview.length > 0) {
      return NextResponse.json({
        error: 'You have already reviewed this product',
        code: 'DUPLICATE_REVIEW'
      }, { status: 409 });
    }

    let isVerified = false;

    if (orderId) {
      const order = await db.select()
        .from(orders)
        .where(and(
          eq(orders.id, orderId),
          eq(orders.userId, userId)
        ))
        .limit(1);

      if (order.length > 0) {
        const orderItem = await db.select()
          .from(orderItems)
          .where(and(
            eq(orderItems.orderId, orderId),
            eq(orderItems.productId, productIdInt)
          ))
          .limit(1);

        if (orderItem.length > 0) {
          isVerified = true;
        }
      }
    }

    const now = new Date().toISOString();

    const newReview = await db.insert(productReviews)
      .values({
        userId,
        productId: productIdInt,
        orderId: orderId || null,
        rating,
        title: title.trim(),
        comment: comment ? comment.trim() : null,
        isVerified,
        helpfulCount: 0,
        createdAt: now,
        updatedAt: now
      })
      .returning();

    const existingTier = await db.select()
      .from(userRewardTiers)
      .where(eq(userRewardTiers.userId, userId))
      .limit(1);

    if (existingTier.length > 0) {
      const newTotalReviews = existingTier[0].totalReviews + 1;
      const newTierName = calculateTierName(newTotalReviews);
      const newRewardPoints = existingTier[0].rewardPoints + 10;

      await db.update(userRewardTiers)
        .set({
          totalReviews: newTotalReviews,
          tierName: newTierName,
          rewardPoints: newRewardPoints,
          updatedAt: now
        })
        .where(eq(userRewardTiers.userId, userId));
    } else {
      const newTierName = calculateTierName(1);

      await db.insert(userRewardTiers)
        .values({
          userId,
          tierName: newTierName,
          totalReviews: 1,
          totalReviewsWithImages: 0,
          rewardPoints: 10,
          createdAt: now,
          updatedAt: now
        });
    }

    return NextResponse.json(newReview[0], { status: 201 });

  } catch (error) {
    console.error('POST review error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error
    }, { status: 500 });
  }
}