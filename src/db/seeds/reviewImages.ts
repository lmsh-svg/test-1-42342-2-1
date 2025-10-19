import { db } from '@/db';
import { reviewImages } from '@/db/schema';

async function main() {
    const sampleReviewImages = [
        {
            reviewId: 1,
            imageUrl: 'https://example.com/review-images/review-1-image-1.jpg',
            createdAt: new Date('2024-01-16T10:17:00.000Z').toISOString(),
        },
        {
            reviewId: 1,
            imageUrl: 'https://example.com/review-images/review-1-image-2.jpg',
            createdAt: new Date('2024-01-16T10:18:00.000Z').toISOString(),
        },
        {
            reviewId: 2,
            imageUrl: 'https://example.com/review-images/review-2-image-1.jpg',
            createdAt: new Date('2024-01-17T15:33:00.000Z').toISOString(),
        },
        {
            reviewId: 3,
            imageUrl: 'https://example.com/review-images/review-3-image-1.jpg',
            createdAt: new Date('2024-01-18T09:47:00.000Z').toISOString(),
        },
        {
            reviewId: 3,
            imageUrl: 'https://example.com/review-images/review-3-image-2.jpg',
            createdAt: new Date('2024-01-18T09:48:00.000Z').toISOString(),
        },
        {
            reviewId: 5,
            imageUrl: 'https://example.com/review-images/review-5-image-1.jpg',
            createdAt: new Date('2024-01-20T14:23:00.000Z').toISOString(),
        },
        {
            reviewId: 7,
            imageUrl: 'https://example.com/review-images/review-7-image-1.jpg',
            createdAt: new Date('2024-01-22T11:38:00.000Z').toISOString(),
        },
    ];

    await db.insert(reviewImages).values(sampleReviewImages);
    
    console.log('✅ Review images seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});