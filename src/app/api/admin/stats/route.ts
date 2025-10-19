import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, users } from '@/db/schema';
import { sql, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Get total revenue from all completed/delivered orders
    const revenueResult = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)`,
        completedOrders: sql<number>`COUNT(*)`,
      })
      .from(orders)
      .where(eq(orders.status, 'delivered'));

    // Get total user count
    const userCountResult = await db
      .select({
        totalUsers: sql<number>`COUNT(*)`,
      })
      .from(users);

    // Get pending orders count
    const pendingOrdersResult = await db
      .select({
        pendingOrders: sql<number>`COUNT(*)`,
      })
      .from(orders)
      .where(eq(orders.status, 'pending'));

    // Get total orders count
    const totalOrdersResult = await db
      .select({
        totalOrders: sql<number>`COUNT(*)`,
      })
      .from(orders);

    const stats = {
      totalRevenue: Number(revenueResult[0]?.totalRevenue || 0),
      completedOrders: Number(revenueResult[0]?.completedOrders || 0),
      totalUsers: Number(userCountResult[0]?.totalUsers || 0),
      pendingOrders: Number(pendingOrdersResult[0]?.pendingOrders || 0),
      totalOrders: Number(totalOrdersResult[0]?.totalOrders || 0),
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error('[ADMIN-STATS] Error fetching stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch admin statistics',
        code: 'STATS_FETCH_ERROR',
      },
      { status: 500 }
    );
  }
}