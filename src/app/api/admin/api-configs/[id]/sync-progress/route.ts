import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiLogs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

// In-memory storage for sync progress (per config)
const syncProgressStore = new Map<number, any>();

export function updateSyncProgress(configId: number, progress: any) {
  syncProgressStore.set(configId, {
    ...progress,
    timestamp: Date.now(),
  });
}

export function clearSyncProgress(configId: number) {
  syncProgressStore.delete(configId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const configId = parseInt(params.id);

    // Get in-memory progress
    const progress = syncProgressStore.get(configId);

    if (progress) {
      // Return active sync progress
      return NextResponse.json(progress);
    }

    // No active sync, check last log entry
    const lastLog = await db
      .select()
      .from(apiLogs)
      .where(eq(apiLogs.configId, configId))
      .orderBy(desc(apiLogs.createdAt))
      .limit(1);

    if (lastLog.length > 0) {
      const log = lastLog[0];
      return NextResponse.json({
        stage: log.status === 'success' ? 'complete' : log.status === 'error' ? 'error' : 'complete',
        totalProducts: log.productsProcessed || 0,
        processedProducts: log.productsProcessed || 0,
        createdProducts: log.productsCreated || 0,
        updatedProducts: log.productsUpdated || 0,
        errors: log.details ? JSON.parse(log.details).errors || [] : [],
        warnings: log.details ? JSON.parse(log.details).warnings || [] : [],
        message: log.message,
      });
    }

    // No progress available
    return NextResponse.json({
      stage: 'fetching',
      totalProducts: 0,
      processedProducts: 0,
      createdProducts: 0,
      updatedProducts: 0,
      errors: [],
      warnings: [],
      message: 'Waiting for sync to start...',
    });

  } catch (error) {
    console.error('GET sync progress error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync progress' },
      { status: 500 }
    );
  }
}