import { db } from '@/db';
import { products, productVariants, orderItems } from '@/db/schema';

interface RawProduct {
  name: string;
  qty: number;
  price: number;
  desc?: string;
  images?: string[];
}

interface ProductGroup {
  name: string;
  products: RawProduct[];
}

interface JsonData {
  imagePathPrefix: string;
  data: ProductGroup[];
}

interface BaseProduct {
  baseName: string;
  totalStock: number;
  price: number;
  description: string | null;
  imageUrl: string | null;
  mainCategory: string;
  subCategory: string;
  brand: string | null;
  volume: string | null;
  variants: Array<{
    variantName: string;
    variantType: string;
    stockQuantity: number;
  }>;
}

const MAIN_CATEGORY_MAP: Record<string, string> = {
  'Cartridges': 'Cartridges',
  'Disposables': 'Disposables',
  'Disposable': 'Disposables',
  'Concentrates': 'Concentrates',
  'Edibles': 'Edibles',
  'Flower': 'Flower',
  'Pre Rolls': 'Pre Rolls',
  'Pre-Rolls': 'Pre Rolls',
  'Accessories': 'Accessories',
  'Topicals': 'Topicals',
  'BYOB': 'BYOB',
};

function normalizeProductName(name: string): string {
  return name.replace(/\s*-\s*/g, ' - ').trim();
}

function extractBaseNameAndVariant(name: string): { baseName: string; variantName: string | null } {
  const normalized = normalizeProductName(name);
  const dashIndex = normalized.indexOf(' - ');
  
  if (dashIndex === -1) {
    return { baseName: normalized.trim(), variantName: null };
  }
  
  const baseName = normalized.substring(0, dashIndex).trim();
  const variantName = normalized.substring(dashIndex + 3).trim();
  
  return { baseName, variantName: variantName || null };
}

function determineVariantType(mainCategory: string, variantName: string): string {
  const lowerVariant = variantName.toLowerCase();
  const lowerCategory = mainCategory.toLowerCase();
  
  if (lowerCategory.includes('accessor')) {
    if (/black|white|silver|gold|red|blue|green|pink|purple|yellow|orange/i.test(lowerVariant)) {
      return 'color';
    }
    return 'style';
  }
  
  if (lowerCategory.includes('cartridge') || lowerCategory.includes('disposable')) {
    if (/indica|sativa|hybrid/i.test(lowerVariant)) {
      return 'strain';
    }
    return 'flavor';
  }
  
  if (lowerCategory.includes('flower') || lowerCategory.includes('roll')) {
    return 'strain';
  }
  
  if (lowerCategory.includes('edible')) {
    return 'flavor';
  }
  
  return 'type';
}

/**
 * Enhanced category detection - matches api-parsers.ts logic
 */
function detectMainCategory(productName: string, description: string = '', groupName: string = ''): string {
  const nameL = productName?.toLowerCase() || '';
  const descL = description?.toLowerCase() || '';
  const groupL = groupName?.toLowerCase() || '';
  const combined = `${nameL} ${descL} ${groupL}`;

  // DISPOSABLES - Highest priority
  if (
    combined.includes('disposable') ||
    combined.includes('all-in-one') ||
    combined.includes('all in one') ||
    combined.includes(' aio ') ||
    nameL.includes(' aio ') ||
    nameL.endsWith(' aio')
  ) {
    return 'Disposables';
  }

  // EDIBLES - Second priority
  if (
    combined.includes('gummies') ||
    combined.includes('gummy') ||
    combined.includes('gummi') ||
    combined.includes('soft gel') ||
    combined.includes('softgel') ||
    combined.includes('fruit chew') ||
    combined.includes('beverage') ||
    combined.includes('drink') ||
    combined.includes('soda') ||
    combined.includes('drops') ||
    combined.includes('chronobon') ||
    combined.includes('edible') ||
    combined.includes('infused chew') ||
    combined.includes('candy') ||
    combined.includes('chocolate') ||
    combined.includes('cookie') ||
    combined.includes('brownie') ||
    combined.includes('mint') ||
    combined.includes('lozenge') ||
    combined.includes('capsule') ||
    combined.includes('applicator')
  ) {
    return 'Edibles';
  }

  // TOPICALS
  if (
    combined.includes('balm') ||
    combined.includes('topical') ||
    combined.includes('lotion') ||
    combined.includes('cream') ||
    combined.includes('salve') ||
    combined.includes('patch') ||
    combined.includes('infused balm')
  ) {
    return 'Topicals';
  }

  // FLOWER - Must check before concentrates
  if (
    combined.includes('flower') ||
    combined.includes('bud') ||
    combined.includes('thca isolate') ||
    combined.includes('living soil flower') ||
    combined.includes('head stash flower') ||
    combined.includes('premium flower') ||
    combined.includes('exotic flower') ||
    nameL.includes('flower') ||
    descL.includes('flower')
  ) {
    return 'Flower';
  }

  // PRE ROLLS - Check before concentrates
  if (
    combined.includes('pre roll') ||
    combined.includes('preroll') ||
    combined.includes('pre-roll') ||
    combined.includes('joint') ||
    combined.includes('blunt') ||
    combined.includes('infused roll') ||
    combined.includes('crushed diamond') ||
    (combined.includes('crushed') && combined.includes('diamond'))
  ) {
    return 'Pre Rolls';
  }

  // CARTRIDGES - Check before concentrates
  if (
    combined.includes('cartridge') ||
    combined.includes(' cart ') ||
    nameL.includes(' cart ') ||
    nameL.endsWith(' cart') ||
    combined.includes('vape cart') ||
    combined.includes('510 cart') ||
    combined.includes('live resin cart') ||
    combined.includes('distillate cart') ||
    (combined.includes('tank') && !combined.includes('battery')) ||
    combined.includes('caliplug cart') ||
    combined.includes('melted diamonds tank')
  ) {
    return 'Cartridges';
  }

  // ACCESSORIES
  if (
    combined.includes('battery') ||
    combined.includes('vape pen') ||
    combined.includes('device') ||
    combined.includes('starter pack') ||
    combined.includes('starter kit') ||
    combined.includes('lighter') ||
    combined.includes('bic lighter') ||
    combined.includes('tool') ||
    combined.includes('accessory') ||
    combined.includes('grinder') ||
    combined.includes('storage') ||
    combined.includes('stealth box') ||
    combined.includes('0% nicotine') ||
    combined.includes('nicotine') ||
    combined.includes('mod u dope') ||
    combined.includes('cartdub') ||
    combined.includes('oil tool') ||
    combined.includes('recovery kit') ||
    combined.includes('oil remover') ||
    combined.includes('stunning glass') ||
    combined.includes('dip devices')
  ) {
    return 'Accessories';
  }

  // BYOB
  if (
    combined.includes('white label') ||
    combined.includes('bulk') ||
    combined.includes('wholesale') ||
    combined.includes('byob') ||
    combined.includes('d9 distillate') ||
    combined.includes('distillate syringe') ||
    combined.includes('ht-fse') ||
    combined.includes('ht fse')
  ) {
    return 'BYOB';
  }

  // CONCENTRATES
  if (
    combined.includes('concentrate') ||
    combined.includes('badder') ||
    combined.includes('budder') ||
    combined.includes('shatter') ||
    combined.includes('wax') ||
    combined.includes('crumble') ||
    combined.includes('sauce') ||
    combined.includes('persy') ||
    combined.includes('dab') ||
    combined.includes('extract') ||
    combined.includes('water hash') ||
    combined.includes('persy water hash') ||
    combined.includes('live resin sugar') ||
    combined.includes('persy rosin') ||
    combined.includes('persy badder') ||
    combined.includes('rosin') ||
    combined.includes('resin')
  ) {
    return 'Concentrates';
  }

  // Brand-based fallback detection
  const cartridgeBrands = ['raw garden', 'stiiizy', 'plug play', 'friendly farms'];
  if (cartridgeBrands.some(brand => combined.includes(brand))) {
    return 'Cartridges';
  }
  
  const concentrateBrands = ['710 labs', 'west coast cure', 'friendly brand'];
  if (concentrateBrands.some(brand => combined.includes(brand))) {
    return 'Concentrates';
  }
  
  const edibleBrands = ['lost farms', 'kiva', 'wyld', 'kanha', 'potters'];
  if (edibleBrands.some(brand => combined.includes(brand))) {
    return 'Edibles';
  }

  // ULTIMATE FALLBACK: Default to Concentrates
  return 'Concentrates';
}

function mapMainCategory(groupName: string): string {
  // First try exact match
  for (const [key, value] of Object.entries(MAIN_CATEGORY_MAP)) {
    if (groupName.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // If no exact match, use enhanced detection
  return detectMainCategory('', '', groupName);
}

function extractBrand(productName: string): string | null {
  const firstWord = productName.split(/[\s-]/)[0]?.trim();
  return firstWord && firstWord.length > 0 ? firstWord : null;
}

function extractVolume(productName: string, description?: string): string | null {
  const text = `${productName} ${description || ''}`;
  const volumePattern = /(\d+\.?\d*)\s*(g|mg|ml|oz|gram|milligram|milliliter|ounce)s?/i;
  const match = text.match(volumePattern);
  return match ? match[0] : null;
}

function transformImageUrl(imageUrl: string, imagePathPrefix: string): string {
  const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${imagePathPrefix}${imageUrl}`;
  return fullUrl.replace(/x_imgvariantsize/g, 'x450');
}

function cleanDescription(description: string | undefined): string | null {
  if (!description) return null;
  return description
    .replace(/\\r\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
}

async function main() {
  console.log('🚀 Starting products seeder...');
  
  // Fetch JSON data
  console.log('📥 Fetching product data from Supabase...');
  const response = await fetch('https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/document-uploads/scrape-1759788403656.json');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.statusText}`);
  }
  
  const jsonData: JsonData = await response.json();
  
  console.log('✅ JSON data fetched successfully');
  console.log(`📊 Image prefix: ${jsonData.imagePathPrefix}`);
  console.log(`📊 Product groups: ${jsonData.data.length}`);
  
  // Flatten all products
  const allRawProducts: Array<{ product: RawProduct; groupName: string }> = [];
  
  for (const group of jsonData.data) {
    for (const product of group.products) {
      allRawProducts.push({ product, groupName: group.name });
    }
  }
  
  console.log(`📊 Total raw products: ${allRawProducts.length}`);
  
  if (allRawProducts.length > 0) {
    console.log('📝 First product example:', JSON.stringify(allRawProducts[0], null, 2));
  }
  
  // Group products by base name
  console.log('\n🔄 Starting deduplication process...');
  const baseProductsMap = new Map<string, BaseProduct>();
  
  for (const { product, groupName } of allRawProducts) {
    const { baseName, variantName } = extractBaseNameAndVariant(product.name);
    const mainCategory = mapMainCategory(groupName);
    
    if (!baseProductsMap.has(baseName)) {
      const imageUrl = product.images && product.images.length > 0
        ? transformImageUrl(product.images[0], jsonData.imagePathPrefix)
        : null;
      
      baseProductsMap.set(baseName, {
        baseName,
        totalStock: 0,
        price: Number(product.price) || 0,
        description: cleanDescription(product.desc),
        imageUrl,
        mainCategory,
        subCategory: groupName,
        brand: extractBrand(baseName),
        volume: extractVolume(baseName, product.desc),
        variants: [],
      });
    }
    
    const baseProduct = baseProductsMap.get(baseName)!;
    baseProduct.totalStock += Number(product.qty) || 0;
    
    if (variantName) {
      const variantType = determineVariantType(mainCategory, variantName);
      baseProduct.variants.push({
        variantName,
        variantType,
        stockQuantity: Number(product.qty) || 0,
      });
    }
  }
  
  console.log(`✅ Deduplication complete`);
  console.log(`📊 Original products: ${allRawProducts.length}`);
  console.log(`📊 Base products: ${baseProductsMap.size}`);
  console.log(`📊 Deduplication savings: ${allRawProducts.length - baseProductsMap.size} duplicates merged`);
  
  const productsWithVariants = Array.from(baseProductsMap.values()).filter(p => p.variants.length > 0);
  const productsWithoutVariants = Array.from(baseProductsMap.values()).filter(p => p.variants.length === 0);
  
  console.log(`📊 Products with variants: ${productsWithVariants.length}`);
  console.log(`📊 Products without variants: ${productsWithoutVariants.length}`);
  
  if (productsWithVariants.length > 0) {
    const example = productsWithVariants[0];
    console.log(`📝 Variant example - Base: "${example.baseName}", Variants: ${example.variants.map(v => `"${v.variantName}" (${v.variantType})`).join(', ')}`);
  }
  
  // Clear existing data
  console.log('\n🗑️  Clearing existing data...');
  await db.delete(orderItems);
  console.log('✅ Deleted order_items');
  
  await db.delete(productVariants);
  console.log('✅ Deleted product_variants');
  
  await db.delete(products);
  console.log('✅ Deleted products');
  
  // Insert base products in batches
  console.log('\n📦 Inserting base products...');
  const baseProductsArray = Array.from(baseProductsMap.values());
  const productIdMap = new Map<string, number>();
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < baseProductsArray.length; i += BATCH_SIZE) {
    const batch = baseProductsArray.slice(i, i + BATCH_SIZE);
    const insertData = batch.map(bp => ({
      name: bp.baseName,
      description: bp.description,
      price: bp.price,
      imageUrl: bp.imageUrl,
      category: bp.subCategory,
      mainCategory: bp.mainCategory,
      subCategory: bp.subCategory,
      brand: bp.brand,
      volume: bp.volume,
      stockQuantity: bp.totalStock,
      isAvailable: bp.totalStock > 0,
      createdAt: new Date().toISOString(),
    }));
    
    const inserted = await db.insert(products).values(insertData).returning();
    
    for (let j = 0; j < inserted.length; j++) {
      productIdMap.set(batch[j].baseName, inserted[j].id);
    }
    
    console.log(`✅ Inserted products batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(baseProductsArray.length / BATCH_SIZE)} (${inserted.length} products)`);
  }
  
  console.log(`✅ All ${baseProductsArray.length} base products inserted`);
  
  // Insert product variants in batches
  console.log('\n📦 Inserting product variants...');
  const allVariants: Array<{
    productId: number;
    variantName: string;
    variantType: string;
    stockQuantity: number;
    priceModifier: number;
    isAvailable: boolean;
    createdAt: string;
  }> = [];
  
  for (const baseProduct of baseProductsArray) {
    const productId = productIdMap.get(baseProduct.baseName);
    if (!productId || baseProduct.variants.length === 0) continue;
    
    for (const variant of baseProduct.variants) {
      allVariants.push({
        productId,
        variantName: variant.variantName,
        variantType: variant.variantType,
        stockQuantity: variant.stockQuantity,
        priceModifier: 0,
        isAvailable: variant.stockQuantity > 0,
        createdAt: new Date().toISOString(),
      });
    }
  }
  
  const VARIANT_BATCH_SIZE = 100;
  
  for (let i = 0; i < allVariants.length; i += VARIANT_BATCH_SIZE) {
    const batch = allVariants.slice(i, i + VARIANT_BATCH_SIZE);
    await db.insert(productVariants).values(batch);
    console.log(`✅ Inserted variants batch ${Math.floor(i / VARIANT_BATCH_SIZE) + 1}/${Math.ceil(allVariants.length / VARIANT_BATCH_SIZE)} (${batch.length} variants)`);
  }
  
  console.log(`✅ All ${allVariants.length} product variants inserted`);
  
  // Final statistics
  console.log('\n📊 FINAL STATISTICS:');
  console.log(`   Total raw products from JSON: ${allRawProducts.length}`);
  console.log(`   Base products created: ${baseProductsArray.length}`);
  console.log(`   Product variants created: ${allVariants.length}`);
  console.log(`   Products with variants: ${productsWithVariants.length}`);
  console.log(`   Products without variants: ${productsWithoutVariants.length}`);
  console.log(`   Deduplication savings: ${allRawProducts.length - baseProductsArray.length} duplicates merged`);
  console.log(`   Total stock across all products: ${baseProductsArray.reduce((sum, p) => sum + p.totalStock, 0)}`);
  
  console.log('\n✅ Products seeder completed successfully');
}

main().catch((error) => {
  console.error('❌ Seeder failed:', error);
  process.exit(1);
});