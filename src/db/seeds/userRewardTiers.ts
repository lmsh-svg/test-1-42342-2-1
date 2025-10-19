import { db } from '@/db';
import { userRewardTiers } from '@/db/schema';

async function main() {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const sampleUserRewardTiers = [
        {
            userId: 1,
            tierName: 'silver',
            totalReviews: 8,
            totalReviewsWithImages: 4,
            rewardPoints: 95,
            createdAt: sixtyDaysAgo.toISOString(),
            updatedAt: threeDaysAgo.toISOString(),
        },
        {
            userId: 2,
            tierName: 'bronze',
            totalReviews: 3,
            totalReviewsWithImages: 1,
            rewardPoints: 35,
            createdAt: sixtyDaysAgo.toISOString(),
            updatedAt: fiveDaysAgo.toISOString(),
        },
        {
            userId: 3,
            tierName: 'gold',
            totalReviews: 18,
            totalReviewsWithImages: 10,
            rewardPoints: 230,
            createdAt: sixtyDaysAgo.toISOString(),
            updatedAt: sevenDaysAgo.toISOString(),
        },
    ];

    await db.insert(userRewardTiers).values(sampleUserRewardTiers);
    
    console.log('✅ User reward tiers seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});