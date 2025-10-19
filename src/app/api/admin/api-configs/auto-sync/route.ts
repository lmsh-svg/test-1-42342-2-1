import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiConfigurations, apiLogs } from '@/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';

/**
 * Auto-sync API route
 * Checks for configurations with autoSyncEnabled and syncs if interval has passed
 * Can be called by a cron job or scheduled task
 */
export async function POST(request: NextRequest) {
  try {
    // Get all active configurations with auto-sync enabled
    const configs = await db
      .select()
      .from(apiConfigurations)
      .where(
        and(
          eq(apiConfigurations.isActive, true),
          eq(apiConfigurations.autoSyncEnabled, true)
        )
      );

    if (configs.length === 0) {
      return NextResponse.json({
        message: 'No configurations with auto-sync enabled',
        synced: []
      });
    }

    const now = new Date();
    const syncResults = [];

    for (const config of configs) {
      try {
        // Check if enough time has passed since last sync
        const shouldSync = !config.lastSyncedAt || 
          (config.syncIntervalMinutes && 
           new Date(config.lastSyncedAt).getTime() + (config.syncIntervalMinutes * 60 * 1000) <= now.getTime());

        if (!shouldSync) {
          continue;
        }

        // Trigger sync
        const syncRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/api-configs/${config.id}/sync`, {
          method: 'POST'
        });

        const syncData = await syncRes.json();

        syncResults.push({
          configId: config.id,
          configName: config.name,
          success: syncRes.ok,
          ...syncData
        });

      } catch (error) {
        syncResults.push({
          configId: config.id,
          configName: config.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: `Auto-sync completed for ${syncResults.length} configurations`,
      synced: syncResults,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('Auto-sync error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error,
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

/**
 * Get auto-sync status
 */
export async function GET(request: NextRequest) {
  try {
    // Get all configurations with auto-sync enabled
    const configs = await db
      .select({
        id: apiConfigurations.id,
        name: apiConfigurations.name,
        isActive: apiConfigurations.isActive,
        autoSyncEnabled: apiConfigurations.autoSyncEnabled,
        syncIntervalMinutes: apiConfigurations.syncIntervalMinutes,
        lastSyncedAt: apiConfigurations.lastSyncedAt
      })
      .from(apiConfigurations)
      .where(eq(apiConfigurations.autoSyncEnabled, true));

    const now = new Date();
    const status = configs.map(config => {
      let nextSyncAt = null;
      let timeUntilNextSync = null;

      if (config.lastSyncedAt && config.syncIntervalMinutes) {
        const lastSync = new Date(config.lastSyncedAt);
        const nextSync = new Date(lastSync.getTime() + (config.syncIntervalMinutes * 60 * 1000));
        nextSyncAt = nextSync.toISOString();
        timeUntilNextSync = Math.max(0, Math.floor((nextSync.getTime() - now.getTime()) / 1000 / 60)); // minutes
      }

      return {
        ...config,
        nextSyncAt,
        timeUntilNextSync: timeUntilNextSync ? `${timeUntilNextSync} minutes` : 'Ready to sync'
      };
    });

    return NextResponse.json({
      configurations: status,
      totalEnabled: configs.length
    });

  } catch (error) {
    console.error('GET auto-sync status error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + error,
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}