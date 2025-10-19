import { db } from '@/db';
import { supportTickets } from '@/db/schema';

async function main() {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const sampleTickets = [
        {
            userId: 1,
            orderId: 1,
            subject: 'Question about order delivery time',
            status: 'open',
            priority: 'medium',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        },
        {
            userId: 2,
            orderId: 2,
            subject: 'Product arrived damaged - need replacement',
            status: 'in_progress',
            priority: 'high',
            createdAt: twoDaysAgo.toISOString(),
            updatedAt: oneDayAgo.toISOString(),
        },
        {
            userId: 3,
            orderId: null,
            subject: 'How do I track my order?',
            status: 'resolved',
            priority: 'low',
            createdAt: sevenDaysAgo.toISOString(),
            updatedAt: fiveDaysAgo.toISOString(),
        },
        {
            userId: 1,
            orderId: null,
            subject: 'Need help with account settings',
            status: 'closed',
            priority: 'low',
            createdAt: fifteenDaysAgo.toISOString(),
            updatedAt: fourteenDaysAgo.toISOString(),
        },
    ];

    await db.insert(supportTickets).values(sampleTickets);
    
    console.log('✅ Support tickets seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});