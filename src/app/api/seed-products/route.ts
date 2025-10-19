import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, orderItems } from '@/db/schema';

export async function POST() {
  try {
    console.log('🚀 Starting products seeding...');
    
    // Step 1: Delete order_items first (foreign key constraint)
    console.log('🗑️  Deleting existing order items...');
    await db.delete(orderItems);
    
    // Step 2: Delete existing products
    console.log('🗑️  Deleting existing products...');
    await db.delete(products);
    
    // Step 3: Fetch JSON data
    console.log('📥 Fetching product data from external source...');
    const url = 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/document-uploads/scrape-1759788403656.json';
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }
    
    const jsonData = await response.json();
    
    // Step 4: Extract imagePathPrefix
    const imagePathPrefix = jsonData.imagePathPrefix || '';
    console.log(`📸 Image path prefix: ${imagePathPrefix}`);
    
    // Category mapping helper
    const MAIN_CATEGORIES = [
      'Cartridges', 'Disposables', 'Concentrates', 'Edibles', 
      'Flower', 'Pre Rolls', 'Accessories', 'Topicals', 'BYOB'
    ];
    
    const mapToMainCategory = (groupName: string): string => {
      const normalized = groupName.toLowerCase().trim();
      
      // Direct matches
      if (normalized.includes('cartridge')) return 'Cartridges';
      if (normalized.includes('disposable')) return 'Disposables';
      if (normalized.includes('concentrate')) return 'Concentrates';
      if (normalized.includes('edible')) return 'Edibles';
      if (normalized.includes('flower')) return 'Flower';
      if (normalized.includes('pre roll') || normalized.includes('preroll')) return 'Pre Rolls';
      if (normalized.includes('accessory') || normalized.includes('accessories')) return 'Accessories';
      if (normalized.includes('topical')) return 'Topicals';
      if (normalized.includes('byob')) return 'BYOB';
      
      // Default fallback
      return 'Accessories';
    };
    
    const extractBrand = (productName: string): string | null => {
      if (!productName) return null;
      
      // Try to extract brand from product name (typically first word or before dash/pipe)
      const parts = productName.split(/[-|]/);
      if (parts.length > 1) {
        const potentialBrand = parts[0].trim();
        // Only return if it looks like a brand (not too long, not a common word)
        if (potentialBrand.length > 2 && potentialBrand.length < 30) {
          return potentialBrand;
        }
      }
      
      return null;
    };
    
    const extractVolume = (productName: string, qtyField?: any): string | null => {
      if (!productName) return null;
      
      // Common volume patterns
      const volumePatterns = [
        /(\d+\.?\d*)\s*(oz|ounce)/i,
        /(\d+\.?\d*)\s*g(?:gram)?/i,
        /(\d+)\s*mg/i,
        /(\d+)\s*ml/i,
        /(\d+)\s*pack/i,
        /(\d+)\s*ct/i,
      ];
      
      for (const pattern of volumePatterns) {
        const match = productName.match(pattern);
        if (match) {
          return match[0].toLowerCase().replace(/\s+/g, '');
        }
      }
      
      return null;
    };
    
    // Step 5: Transform products with enhanced categorization
    console.log('🔄 Transforming products with categorization...');
    const productsArray: any[] = [];
    
    for (const group of jsonData.data) {
      const groupName = group.name;
      const mainCategory = mapToMainCategory(groupName);
      const subCategory = groupName;
      const groupProducts = group.products || [];
      
      console.log(`📦 Processing group: ${groupName} → Main: ${mainCategory} (${groupProducts.length} products)`);
      
      for (const product of groupProducts) {
        let imageUrl = null;
        
        // Handle image URL transformation
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
          const originalImage = product.images[0];
          const transformedImage = originalImage.replace('x_imgvariantsize', 'x450');
          imageUrl = imagePathPrefix + transformedImage;
        }
        
        // Clean description by replacing \r\n with \n
        let cleanDescription = product.desc || null;
        if (cleanDescription) {
          cleanDescription = cleanDescription.replace(/\\r\\n/g, '\n').replace(/\r\n/g, '\n');
        }
        
        const stockQty = Number(product.qty) || 0;
        const brand = extractBrand(product.name);
        const volume = extractVolume(product.name, product.qty);
        
        productsArray.push({
          name: product.name,
          description: cleanDescription,
          price: Number(product.price) || 0,
          stockQuantity: stockQty,
          imageUrl: imageUrl,
          category: groupName, // Keep original for backward compatibility
          mainCategory: mainCategory,
          subCategory: subCategory,
          brand: brand,
          volume: volume,
          isAvailable: stockQty > 0,
          createdAt: new Date().toISOString(),
        });
      }
    }
    
    console.log(`📊 Total products to insert: ${productsArray.length}`);
    
    if (productsArray.length === 0) {
      return NextResponse.json({ 
        message: 'No products found in the data source',
        count: 0 
      });
    }
    
    // Step 6: Bulk insert in batches to avoid query size limits
    console.log('💾 Inserting products into database in batches...');
    const batchSize = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < productsArray.length; i += batchSize) {
      const batch = productsArray.slice(i, i + batchSize);
      await db.insert(products).values(batch);
      totalInserted += batch.length;
      console.log(`✓ Inserted batch ${Math.floor(i / batchSize) + 1} (${totalInserted}/${productsArray.length})`);
    }
    
    // Get statistics
    const mainCategories = [...new Set(productsArray.map(p => p.mainCategory))];
    const brands = [...new Set(productsArray.map(p => p.brand).filter(Boolean))];
    const volumes = [...new Set(productsArray.map(p => p.volume).filter(Boolean))];
    
    console.log(`✅ Products seeded successfully`);
    console.log(`📊 Total products: ${totalInserted}`);
    console.log(`📁 Main categories: ${mainCategories.join(', ')}`);
    console.log(`🏷️  Brands found: ${brands.length}`);
    console.log(`📏 Volumes found: ${volumes.length}`);
    
    return NextResponse.json({ 
      message: 'Products seeded successfully',
      count: totalInserted,
      mainCategories: mainCategories,
      brandsCount: brands.length,
      volumesCount: volumes.length,
      productsWithStock: productsArray.filter(p => p.stockQuantity > 0).length
    });
    
  } catch (error) {
    console.error('❌ Seeder failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to seed products',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}