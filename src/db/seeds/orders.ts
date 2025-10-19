import { db } from '@/db';
import { orders } from '@/db/schema';

async function main() {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const sampleOrders = [
        {
            userId: 1,
            status: 'pending',
            totalAmount: 299.99,
            shippingAddress: '123 Main St, New York, NY 10001',
            notes: 'Please leave at front door',
            createdAt: twoDaysAgo.toISOString(),
            updatedAt: twoDaysAgo.toISOString(),
        },
        {
            userId: 2,
            status: 'shipped',
            totalAmount: 1599.50,
            shippingAddress: '456 Oak Avenue, Los Angeles, CA 90001',
            notes: 'Call before delivery',
            createdAt: fiveDaysAgo.toISOString(),
            updatedAt: oneDayAgo.toISOString(),
        },
        {
            userId: 3,
            status: 'delivered',
            totalAmount: 79.99,
            shippingAddress: '789 Elm Street, Chicago, IL 60601',
            notes: null,
            createdAt: tenDaysAgo.toISOString(),
            updatedAt: threeDaysAgo.toISOString(),
        }
    ];

    await db.insert(orders).values(sampleOrders);
    
    console.log('✅ Orders seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});