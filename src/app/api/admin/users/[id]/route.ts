import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, productReviews, reviewImages, orders, orderItems, supportTickets, ticketMessages, trackingInfo, userRewardTiers } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Validate ID is a valid positive integer
    const userId = parseInt(id);
    if (!id || isNaN(userId) || userId <= 0) {
      return NextResponse.json(
        { 
          error: "Valid positive integer ID is required",
          code: "INVALID_ID" 
        },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      return NextResponse.json(
        { 
          error: "User not found",
          code: "USER_NOT_FOUND" 
        },
        { status: 404 }
      );
    }

    const userToDelete = existingUser[0];
    console.log(`Starting cascade deletion for user ID: ${userId}`);

    // Initialize deletion counters
    const deletedRecords = {
      reviewImages: 0,
      productReviews: 0,
      ticketMessages: 0,
      supportTickets: 0,
      trackingInfo: 0,
      orderItems: 0,
      orders: 0,
      userRewardTiers: 0
    };

    // Step 1: Get user's order IDs for cascade deletion
    console.log('Step 1: Fetching user orders...');
    const userOrders = await db.select({ id: orders.id })
      .from(orders)
      .where(eq(orders.userId, userId));
    
    const orderIds = userOrders.map(order => order.id);
    console.log(`Found ${orderIds.length} orders for user ${userId}`);

    // Step 2: Delete review images (references productReviews which references users)
    console.log('Step 2: Deleting review images...');
    const userReviews = await db.select({ id: productReviews.id })
      .from(productReviews)
      .where(eq(productReviews.userId, userId));
    
    const reviewIds = userReviews.map(review => review.id);
    
    if (reviewIds.length > 0) {
      const deletedReviewImages = await db.delete(reviewImages)
        .where(inArray(reviewImages.reviewId, reviewIds))
        .returning();
      deletedRecords.reviewImages = deletedReviewImages.length;
      console.log(`Deleted ${deletedRecords.reviewImages} review images`);
    }

    // Step 3: Delete product reviews (references users)
    console.log('Step 3: Deleting product reviews...');
    const deletedReviews = await db.delete(productReviews)
      .where(eq(productReviews.userId, userId))
      .returning();
    deletedRecords.productReviews = deletedReviews.length;
    console.log(`Deleted ${deletedRecords.productReviews} product reviews`);

    // Step 4: Delete ticket messages (references supportTickets and users)
    console.log('Step 4: Deleting ticket messages...');
    const deletedMessages = await db.delete(ticketMessages)
      .where(eq(ticketMessages.userId, userId))
      .returning();
    deletedRecords.ticketMessages = deletedMessages.length;
    console.log(`Deleted ${deletedRecords.ticketMessages} ticket messages`);

    // Step 5: Delete support tickets (references users)
    console.log('Step 5: Deleting support tickets...');
    const deletedTickets = await db.delete(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .returning();
    deletedRecords.supportTickets = deletedTickets.length;
    console.log(`Deleted ${deletedRecords.supportTickets} support tickets`);

    // Step 6: Delete tracking info (references orders which references users)
    console.log('Step 6: Deleting tracking info...');
    if (orderIds.length > 0) {
      const deletedTracking = await db.delete(trackingInfo)
        .where(inArray(trackingInfo.orderId, orderIds))
        .returning();
      deletedRecords.trackingInfo = deletedTracking.length;
      console.log(`Deleted ${deletedRecords.trackingInfo} tracking info records`);
    }

    // Step 7: Delete order items (references orders which references users)
    console.log('Step 7: Deleting order items...');
    if (orderIds.length > 0) {
      const deletedItems = await db.delete(orderItems)
        .where(inArray(orderItems.orderId, orderIds))
        .returning();
      deletedRecords.orderItems = deletedItems.length;
      console.log(`Deleted ${deletedRecords.orderItems} order items`);
    }

    // Step 8: Delete orders (references users)
    console.log('Step 8: Deleting orders...');
    const deletedOrders = await db.delete(orders)
      .where(eq(orders.userId, userId))
      .returning();
    deletedRecords.orders = deletedOrders.length;
    console.log(`Deleted ${deletedRecords.orders} orders`);

    // Step 9: Delete user reward tiers (references users)
    console.log('Step 9: Deleting user reward tiers...');
    const deletedRewardTiers = await db.delete(userRewardTiers)
      .where(eq(userRewardTiers.userId, userId))
      .returning();
    deletedRecords.userRewardTiers = deletedRewardTiers.length;
    console.log(`Deleted ${deletedRecords.userRewardTiers} user reward tier records`);

    // Step 10: Finally delete the user record itself
    console.log('Step 10: Deleting user record...');
    const deletedUser = await db.delete(users)
      .where(eq(users.id, userId))
      .returning();

    if (deletedUser.length === 0) {
      console.error('Failed to delete user record');
      return NextResponse.json(
        { 
          error: "Failed to delete user",
          code: "DELETE_FAILED" 
        },
        { status: 500 }
      );
    }

    console.log(`Successfully completed cascade deletion for user ID: ${userId}`);

    // Remove passwordHash from response
    const { passwordHash, ...userWithoutPassword } = deletedUser[0];

    return NextResponse.json({
      message: "User and all related data deleted successfully",
      user: userWithoutPassword,
      deletedRecords
    }, { status: 200 });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + error,
        code: "DELETE_FAILED"
      },
      { status: 500 }
    );
  }
}