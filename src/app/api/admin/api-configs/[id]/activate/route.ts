import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiConfigurations } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { 
          error: 'Valid configuration ID is required',
          code: 'INVALID_ID'
        },
        { status: 400 }
      );
    }

    const configId = parseInt(id);

    // Fetch the target configuration
    const targetConfig = await db
      .select()
      .from(apiConfigurations)
      .where(eq(apiConfigurations.id, configId))
      .limit(1);

    if (targetConfig.length === 0) {
      return NextResponse.json(
        { 
          error: 'Configuration not found',
          code: 'CONFIG_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const config = targetConfig[0];
    const configType = config.type;

    // Deactivate all other configurations of the same type
    const deactivated = await db
      .update(apiConfigurations)
      .set({ 
        isActive: false
      })
      .where(
        and(
          eq(apiConfigurations.type, configType),
          ne(apiConfigurations.id, configId)
        )
      )
      .returning();

    const deactivatedCount = deactivated.length;

    // Activate the target configuration
    const activated = await db
      .update(apiConfigurations)
      .set({ 
        isActive: true
      })
      .where(eq(apiConfigurations.id, configId))
      .returning();

    if (activated.length === 0) {
      return NextResponse.json(
        { 
          error: 'Failed to activate configuration',
          code: 'ACTIVATION_FAILED'
        },
        { status: 500 }
      );
    }

    const activatedConfig = activated[0];

    return NextResponse.json(
      {
        message: 'Configuration activated successfully',
        activatedConfig: {
          id: activatedConfig.id,
          name: activatedConfig.name,
          type: activatedConfig.type,
          isActive: activatedConfig.isActive
        },
        deactivatedCount
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('POST /api/api-configurations/[id]/activate error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + error,
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}