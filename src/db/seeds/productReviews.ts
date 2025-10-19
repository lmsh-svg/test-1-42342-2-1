import { db } from '@/db';
import { productReviews } from '@/db/schema';

async function main() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const getRandomDateInLast30Days = (index: number, total: number) => {
        const daysDiff = Math.floor((index / total) * 30);
        const date = new Date(thirtyDaysAgo.getTime() + daysDiff * 24 * 60 * 60 * 1000);
        return date.toISOString();
    };

    const sampleReviews = [
        {
            userId: 1,
            productId: 1,
            orderId: 1,
            rating: 5,
            title: 'Outstanding quality!',
            comment: 'This product exceeded all my expectations. The quality is top-notch and it arrived earlier than expected. I would definitely recommend this to anyone looking for a reliable purchase.',
            isVerified: true,
            helpfulCount: 23,
            createdAt: getRandomDateInLast30Days(0, 10),
            updatedAt: getRandomDateInLast30Days(0, 10),
        },
        {
            userId: 2,
            productId: 2,
            orderId: 2,
            rating: 4,
            title: 'Great product!',
            comment: 'Very satisfied with my purchase. The product works exactly as described and the delivery was fast. Only minor complaint is the packaging could be better, but overall a solid buy.',
            isVerified: true,
            helpfulCount: 18,
            createdAt: getRandomDateInLast30Days(1, 10),
            updatedAt: getRandomDateInLast30Days(1, 10),
        },
        {
            userId: 3,
            productId: 3,
            orderId: 3,
            rating: 5,
            title: 'Highly recommended',
            comment: 'Absolutely love this product! The attention to detail is impressive and it has made my daily routine so much easier. Best purchase I have made in a while.',
            isVerified: true,
            helpfulCount: 21,
            createdAt: getRandomDateInLast30Days(2, 10),
            updatedAt: getRandomDateInLast30Days(2, 10),
        },
        {
            userId: 1,
            productId: 4,
            orderId: null,
            rating: 3,
            title: 'Could be better',
            comment: 'The product is decent but not as good as I hoped. It does what it is supposed to do, but I feel like the quality could be improved for the price point.',
            isVerified: false,
            helpfulCount: 9,
            createdAt: getRandomDateInLast30Days(3, 10),
            updatedAt: getRandomDateInLast30Days(3, 10),
        },
        {
            userId: 2,
            productId: 5,
            orderId: 1,
            rating: 4,
            title: 'Worth every penny',
            comment: 'Really happy with this purchase. The product performs well and the value for money is excellent. Shipping was quick and customer service was responsive to my questions.',
            isVerified: true,
            helpfulCount: 15,
            createdAt: getRandomDateInLast30Days(4, 10),
            updatedAt: getRandomDateInLast30Days(4, 10),
        },
        {
            userId: 3,
            productId: 1,
            orderId: 2,
            rating: 5,
            title: 'Perfect for my needs',
            comment: 'This is exactly what I was looking for. The functionality is great and it integrates seamlessly with my existing setup. Could not be happier with this choice.',
            isVerified: true,
            helpfulCount: 19,
            createdAt: getRandomDateInLast30Days(5, 10),
            updatedAt: getRandomDateInLast30Days(5, 10),
        },
        {
            userId: 1,
            productId: 2,
            orderId: null,
            rating: 2,
            title: 'Disappointed',
            comment: 'Unfortunately this product did not meet my expectations. The quality feels cheaper than advertised and it stopped working properly after just a few uses. Would not recommend.',
            isVerified: false,
            helpfulCount: 12,
            createdAt: getRandomDateInLast30Days(6, 10),
            updatedAt: getRandomDateInLast30Days(6, 10),
        },
        {
            userId: 2,
            productId: 3,
            orderId: null,
            rating: 3,
            title: 'Not what I expected',
            comment: 'The product arrived as described but it is not quite what I was hoping for. It works fine but I expected more features for the price. Might return it.',
            isVerified: false,
            helpfulCount: 7,
            createdAt: getRandomDateInLast30Days(7, 10),
            updatedAt: getRandomDateInLast30Days(7, 10),
        },
        {
            userId: 3,
            productId: 4,
            orderId: 3,
            rating: 4,
            title: 'Amazing quality',
            comment: 'The build quality on this is fantastic. You can tell it is made with care and attention to detail. Works great and looks even better in person than in the photos.',
            isVerified: true,
            helpfulCount: 25,
            createdAt: getRandomDateInLast30Days(8, 10),
            updatedAt: new Date(new Date(getRandomDateInLast30Days(8, 10)).getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
            userId: 1,
            productId: 5,
            orderId: null,
            rating: 1,
            title: 'Waste of money',
            comment: 'Very disappointed with this purchase. The product broke within the first week and customer service has been unresponsive. Save your money and buy something else.',
            isVerified: false,
            helpfulCount: 14,
            createdAt: getRandomDateInLast30Days(9, 10),
            updatedAt: new Date(new Date(getRandomDateInLast30Days(9, 10)).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
    ];

    await db.insert(productReviews).values(sampleReviews);
    
    console.log('✅ Product reviews seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});