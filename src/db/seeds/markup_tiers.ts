import { db } from '@/db';
import { markupTiers } from '@/db/schema';

async function main() {
    const sampleMarkupTiers = [
        // Tiers for markup ID 6 (Tier-Based Markup for Cartridges category)
        {
            markupId: 6,
            minQuantity: 1,
            maxQuantity: 10,
            markupValue: 20,
            createdAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        },
        {
            markupId: 6,
            minQuantity: 11,
            maxQuantity: 49,
            markupValue: 14,
            createdAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        },
        {
            markupId: 6,
            minQuantity: 50,
            maxQuantity: null,
            markupValue: 10,
            createdAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        },
        
        // Tiers for markup ID 8 (Future Promo for Flower category)
        {
            markupId: 8,
            minQuantity: 1,
            maxQuantity: 5,
            markupValue: 25,
            createdAt: new Date('2024-02-01T08:30:00Z').toISOString(),
        },
        {
            markupId: 8,
            minQuantity: 6,
            maxQuantity: 20,
            markupValue: 20,
            createdAt: new Date('2024-02-01T08:30:00Z').toISOString(),
        },
        {
            markupId: 8,
            minQuantity: 21,
            maxQuantity: null,
            markupValue: 15,
            createdAt: new Date('2024-02-01T08:30:00Z').toISOString(),
        },
        
        // Tiers for markup ID 7 (Product Specific Markup)
        {
            markupId: 7,
            minQuantity: 1,
            maxQuantity: 10,
            markupValue: 5.99,
            createdAt: new Date('2024-01-20T14:15:00Z').toISOString(),
        },
        {
            markupId: 7,
            minQuantity: 11,
            maxQuantity: 50,
            markupValue: 4.99,
            createdAt: new Date('2024-01-20T14:15:00Z').toISOString(),
        },
        {
            markupId: 7,
            minQuantity: 51,
            maxQuantity: 100,
            markupValue: 3.99,
            createdAt: new Date('2024-01-20T14:15:00Z').toISOString(),
        },
        {
            markupId: 7,
            minQuantity: 101,
            maxQuantity: null,
            markupValue: 2.99,
            createdAt: new Date('2024-01-20T14:15:00Z').toISOString(),
        },
    ];

    await db.insert(markupTiers).values(sampleMarkupTiers);
    
    console.log('✅ Markup tiers seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});