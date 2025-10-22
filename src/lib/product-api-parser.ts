/**
 * Product API Parser
 * Handles your specific API format with parent products and variants
 */

export interface RawProductTier {
  price: number;
  qty: string; // e.g., "1+", "5+"
}

export interface RawProduct {
  id: number;
  name: string;
  desc?: string;
  price: number;
  tiers?: RawProductTier[];
  images?: string[];
  tags?: string[];
  qty?: number;
  [key: string]: any;
}

export interface RawAPIResponse {
  lastUpdated?: number;
  nextUpdate?: number;
  imagePathPrefix?: string;
  imageSizeVariants?: number[];
  data?: Array<{
    name?: string;
    desc?: string;
    brand?: string | null;
    tags?: string[];
    imgs?: Record<string, string>;
    cat?: string | null; // IMPORTANT: Pre-assigned category from API
    products?: RawProduct[];
  }>;
  products?: RawProduct[];
}

export interface ParsedVariant {
  variantName: string;
  variantType: string;
  stockQuantity: number;
  priceModifier: number;
  isAvailable: boolean;
  sourceId: string;
  tiers: ParsedPricingTier[];
}

export interface ParsedProduct {
  sourceId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  images: string[];
  mainCategory: string;
  subCategory: string | null;
  brand: string | null;
  volume: string | null;
  stockQuantity: number;
  pricingTiers: ParsedPricingTier[];
  variants: ParsedVariant[];
}

export interface ParsedPricingTier {
  minQuantity: number;
  price: number;
  quantityLabel: string;
}

/**
 * Category Assignment - RESPECTS API's `cat` field first!
 */
export function assignCategory(
  product: { tags?: string[]; desc?: string; brand?: string; name?: string },
  apiCategory?: string | null
): { main: string; sub: string | null } {
  // PRIORITY 1: Use the API's pre-assigned category if available
  if (apiCategory && apiCategory.trim() !== '') {
    return { main: apiCategory, sub: null };
  }

  const searchText = [
    ...(product.tags || []),
    product.desc || '',
    product.name || ''
  ].join(' ').toLowerCase();

  // PRIORITY 2: Check for strain types in tags
  if (product.tags) {
    for (const tag of product.tags) {
      const tagLower = tag.toLowerCase();
      if (tagLower.includes('strain type = indica')) return { main: 'Flower', sub: 'Indica' };
      if (tagLower.includes('strain type = sativa')) return { main: 'Flower', sub: 'Sativa' };
      if (tagLower.includes('strain type = hybrid')) return { main: 'Flower', sub: 'Hybrid' };
    }
  }

  // PRIORITY 3: Keyword-based detection (IMPROVED)
  const categoryRules: Array<{ keywords: string[]; main: string; sub?: string }> = [
    // Pre Rolls
    { keywords: ['pre roll', 'pre-roll', 'preroll', 'joint'], main: 'Pre Rolls' },
    
    // Cartridges
    { keywords: ['cartridge', 'cart', 'vape cart', '510'], main: 'Cartridges' },
    
    // Disposables
    { keywords: ['disposable', 'puff bar', 'disposable pen', 'disposable vape'], main: 'Disposables' },
    
    // Concentrates
    { keywords: ['concentrate', 'rosin', 'resin', 'wax', 'shatter', 'budder', 'diamonds', 'sauce', 'distillate'], main: 'Concentrates' },
    
    // Edibles
    { keywords: ['edible', 'gummies', 'gummy', 'chocolate', 'candy', 'cookie', 'brownie'], main: 'Edibles' },
    
    // Flower
    { keywords: ['flower', 'bud', 'eighth', 'quarter', 'ounce', 'indoor', 'outdoor'], main: 'Flower' },
    
    // Accessories (EXPANDED)
    { keywords: ['battery', 'torch', 'lighter', 'grinder', 'pipe', 'bong', 'stem', 'downstem', 'ashcatcher', 'chillum', 'atomizer', 'glass', 'accessory'], main: 'Accessories' },
  ];

  for (const rule of categoryRules) {
    if (rule.keywords.some(keyword => searchText.includes(keyword))) {
      return { main: rule.main, sub: rule.sub || null };
    }
  }

  // FALLBACK: Check brand-specific categories
  const brand = (product.brand || '').toLowerCase();
  if (brand && ['maven', 'hisi', 'puffco', 'focus v', 'cali crusher', 'santa cruz'].some(b => brand.includes(b))) {
    return { main: 'Accessories', sub: null };
  }

  // LAST RESORT: Miscellaneous (should rarely happen now)
  return { main: 'Miscellaneous', sub: null };
}

/**
 * Detect variant type from variant name
 */
function detectVariantType(variantName: string, parentName: string): string {
  const name = variantName.toLowerCase();
  const parent = parentName.toLowerCase();

  // If variant name is the same as parent name, it's a standalone product (no real variant)
  if (variantName === parentName) {
    return 'default';
  }

  // Color detection
  const colors = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'grey', 'gray', 'silver', 'gold', 'cream', 'brown', 'clear', 'transparent'];
  if (colors.some(color => name === color || name.includes(color))) {
    return 'color';
  }

  // Size detection (inches, measurements)
  if (/\d+(\.\d+)?["']/.test(variantName) || /\d+\s*(inch|mm|cm)/.test(name)) {
    return 'size';
  }

  // Strain/Flavor for cannabis products
  if (parent.includes('cart') || parent.includes('disposable') || parent.includes('gummies')) {
    return 'flavor';
  }

  // Default to "option"
  return 'option';
}

/**
 * Extract products from your API format
 */
export function extractProductsFromAPI(apiResponse: RawAPIResponse | RawProduct[]): Array<{
  parent: {
    name: string;
    desc?: string;
    brand?: string | null;
    tags?: string[];
    imgs?: Record<string, string>;
    cat?: string | null;
  };
  variants: RawProduct[];
}> {
  const results: Array<{ parent: any; variants: RawProduct[] }> = [];

  // Handle your nested data[].products[] structure
  if (!Array.isArray(apiResponse) && apiResponse.data && Array.isArray(apiResponse.data)) {
    for (const dataItem of apiResponse.data) {
      if (dataItem.products && Array.isArray(dataItem.products) && dataItem.products.length > 0) {
        results.push({
          parent: {
            name: dataItem.name || 'Unnamed Product',
            desc: dataItem.desc,
            brand: dataItem.brand,
            tags: dataItem.tags || [],
            imgs: dataItem.imgs || {},
            cat: dataItem.cat // IMPORTANT: Preserve the category from API
          },
          variants: dataItem.products
        });
      }
    }
    
    console.log(`✅ Extracted ${results.length} parent products from API`);
    return results;
  }

  // Fallback for flat array
  if (Array.isArray(apiResponse)) {
    for (const product of apiResponse) {
      results.push({
        parent: {
          name: product.name,
          desc: product.desc,
          brand: product.brand,
          tags: product.tags || [],
          imgs: {},
          cat: null
        },
        variants: [product]
      });
    }
    return results;
  }

  console.error('❌ Unrecognized API format');
  return [];
}

/**
 * Parse pricing tiers
 */
export function parsePricingTiers(tiers?: RawProductTier[]): ParsedPricingTier[] {
  if (!tiers || tiers.length === 0) return [];

  return tiers
    .map(tier => {
      const qtyMatch = tier.qty.match(/(\d+)\+?/);
      const minQuantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;
      return {
        minQuantity,
        price: tier.price,
        quantityLabel: tier.qty
      };
    })
    .sort((a, b) => a.minQuantity - b.minQuantity);
}

/**
 * Extract volume from text
 */
export function extractVolume(text: string): string | null {
  const patterns = [
    /(\d+\.?\d*)\s*(g|gram|grams)/i,
    /(\d+\.?\d*)\s*(mg)/i,
    /(\d+\.?\d*)\s*(ml)/i,
    /(\d+\.?\d*)\s*(oz|ounce)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

/**
 * Main parser - converts raw API data to structured products with variants
 */
export function parseProducts(rawData: Array<{ parent: any; variants: RawProduct[] }>): ParsedProduct[] {
  const parsedProducts: ParsedProduct[] = [];
  const seen = new Set<string>(); // Deduplicate by parent name

  for (const { parent, variants } of rawData) {
    // Skip duplicates
    const key = `${parent.name}_${parent.brand || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Get category (RESPECTS API's cat field!)
    const category = assignCategory(
      {
        tags: parent.tags,
        desc: parent.desc,
        brand: parent.brand,
        name: parent.name
      },
      parent.cat // Pass the API's category
    );

    // Skip if still miscategorized (safety check)
    if (category.main === 'Miscellaneous') {
      console.warn(`⚠️ Product "${parent.name}" defaulted to Miscellaneous - check categorization rules`);
    }

    // Get images
    const images: string[] = [];
    if (parent.imgs) {
      images.push(...Object.values(parent.imgs));
    }
    // Add variant images
    for (const variant of variants) {
      if (variant.images) {
        images.push(...variant.images);
      }
    }

    // Find base price (lowest among variants)
    const basePrice = Math.min(...variants.map(v => v.price));

    // Find base tiers (from first variant with tiers)
    const baseTiers = variants.find(v => v.tiers && v.tiers.length > 0)?.tiers || [];

    // Parse variants (ONLY if there are multiple OR if variant name differs from parent)
    const parsedVariants: ParsedVariant[] = [];
    
    // If only 1 variant with same name as parent, treat as no variants
    const hasRealVariants = variants.length > 1 || 
      (variants.length === 1 && variants[0].name !== parent.name);

    if (hasRealVariants) {
      for (const variant of variants) {
        const variantType = detectVariantType(variant.name, parent.name);
        
        parsedVariants.push({
          variantName: variant.name,
          variantType,
          stockQuantity: variant.qty || 0,
          priceModifier: variant.price - basePrice,
          isAvailable: true,
          sourceId: variant.id.toString(),
          tiers: parsePricingTiers(variant.tiers)
        });
      }
    }

    // Extract volume
    const volume = extractVolume(`${parent.name} ${parent.desc || ''}`);

    parsedProducts.push({
      sourceId: variants[0]?.id?.toString() || `gen_${Date.now()}`,
      name: parent.name,
      description: parent.desc || null,
      price: basePrice,
      imageUrl: images[0] || null,
      images: images.slice(0, 5), // Limit to 5 images
      mainCategory: category.main,
      subCategory: category.sub,
      brand: parent.brand || null,
      volume,
      stockQuantity: variants.reduce((sum, v) => sum + (v.qty || 0), 0),
      pricingTiers: parsePricingTiers(baseTiers),
      variants: parsedVariants
    });
  }

  // Sort alphabetically
  parsedProducts.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`✅ Parsed ${parsedProducts.length} unique products`);
  console.log(`📊 Categories: ${Object.entries(
    parsedProducts.reduce((acc, p) => {
      acc[p.mainCategory] = (acc[p.mainCategory] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([cat, count]) => `${cat}: ${count}`).join(', ')}`);

  return parsedProducts;
}

/**
 * Detect changes
 */
export function detectProductChanges(
  existing: ParsedProduct,
  incoming: ParsedProduct
): { hasChanges: boolean; changedFields: string[] } {
  const changedFields: string[] = [];

  if (existing.price !== incoming.price) changedFields.push('price');
  if (existing.description !== incoming.description) changedFields.push('description');
  if (existing.mainCategory !== incoming.mainCategory) changedFields.push('mainCategory');
  if (JSON.stringify(existing.pricingTiers) !== JSON.stringify(incoming.pricingTiers)) {
    changedFields.push('pricingTiers');
  }
  if (JSON.stringify(existing.variants) !== JSON.stringify(incoming.variants)) {
    changedFields.push('variants');
  }

  return {
    hasChanges: changedFields.length > 0,
    changedFields
  };
}