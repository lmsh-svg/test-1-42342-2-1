/**
 * Product API Parser
 * Comprehensive parsing logic for external product API JSON format
 * NOW SUPPORTS: Parent products with variants (colors, flavors, strains)
 */

export interface RawProductTier {
  price: number;
  qty: string; // e.g., "1+", "2+", "3+"
}

export interface RawProduct {
  id: number;
  name: string;
  desc?: string;
  price: number;
  tiers?: RawProductTier[];
  images?: string[];
  tags?: string[];
  brand?: string;
  qty?: number; // Warehouse stock - ignore for tier pricing
  [key: string]: any; // Allow for additional fields
}

// NEW: Support for nested API structure with parent/variant relationships
export interface RawAPIResponse {
  lastUpdated?: number;
  nextUpdate?: number;
  imagePathPrefix?: string;
  imageSizeVariants?: number[];
  data?: Array<{
    name?: string; // PARENT product name
    desc?: string; // PARENT description
    brand?: string | null;
    tags?: string[];
    imgs?: Record<string, string>;
    cat?: string | null;
    products?: RawProduct[]; // CHILD variants
  }>;
  products?: RawProduct[]; // Alternative flat structure
}

export interface ParsedVariant {
  variantName: string;
  variantType: string; // "color", "flavor", "strain", "size"
  stockQuantity: number;
  priceModifier: number; // Difference from base price
  isAvailable: boolean;
  sourceId: string;
  tiers: ParsedPricingTier[];
}

export interface ParsedProduct {
  sourceId: string;
  name: string;
  description: string | null;
  price: number; // Base price (lowest variant price)
  imageUrl: string | null;
  images: string[];
  mainCategory: string;
  subCategory: string | null;
  brand: string | null;
  volume: string | null;
  stockQuantity: number;
  pricingTiers: ParsedPricingTier[]; // Base product tiers
  variants: ParsedVariant[]; // NEW: Product variants
}

export interface ParsedPricingTier {
  minQuantity: number;
  price: number;
  quantityLabel: string; // "1+", "3+", etc.
}

/**
 * Determine variant type from context
 */
function detectVariantType(variantName: string, parentData: { tags?: string[]; desc?: string; brand?: string }): string {
  const name = variantName.toLowerCase();
  const context = [
    ...(parentData.tags || []),
    parentData.desc || '',
    parentData.brand || ''
  ].join(' ').toLowerCase();

  // Color variants
  const colors = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'grey', 'gray', 'silver', 'gold', 'brown', 'cream'];
  if (colors.some(color => name.includes(color))) {
    return 'color';
  }

  // Strain variants (cannabis)
  if (parentData.tags?.some(tag => tag.toLowerCase().includes('strain'))) {
    return 'strain';
  }

  // Flavor variants
  const flavorWords = ['flavor', 'taste', 'berry', 'mint', 'vanilla', 'chocolate', 'cherry', 'grape', 'lemon'];
  if (flavorWords.some(word => name.includes(word) || context.includes(word))) {
    return 'flavor';
  }

  // Size variants
  const sizeWords = ['small', 'medium', 'large', 'xl', 'mini', 'regular', 'oz', 'ml', 'g', 'mg'];
  if (sizeWords.some(word => name.includes(word))) {
    return 'size';
  }

  // Default to generic "option"
  return 'option';
}

/**
 * Extract flat product list from nested API structure
 * NOW PROPERLY HANDLES PARENT/VARIANT RELATIONSHIPS
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

  // Handle direct array format (flat products, no variants)
  if (Array.isArray(apiResponse)) {
    // Each product is standalone
    for (const product of apiResponse) {
      results.push({
        parent: {
          name: product.name,
          desc: product.desc,
          brand: product.brand,
          tags: product.tags,
          imgs: {},
          cat: null
        },
        variants: [product]
      });
    }
    return results;
  }

  // Handle nested data[].products[] structure
  if (apiResponse.data && Array.isArray(apiResponse.data)) {
    for (const dataItem of apiResponse.data) {
      if (dataItem.products && Array.isArray(dataItem.products)) {
        results.push({
          parent: {
            name: dataItem.name || 'Unnamed Product',
            desc: dataItem.desc,
            brand: dataItem.brand,
            tags: dataItem.tags,
            imgs: dataItem.imgs,
            cat: dataItem.cat
          },
          variants: dataItem.products
        });
      }
    }
    
    console.log(`Extracted ${results.length} parent products with variants from nested data structure`);
    return results;
  }

  // Handle flat products array (no variants)
  if (apiResponse.products && Array.isArray(apiResponse.products)) {
    for (const product of apiResponse.products) {
      results.push({
        parent: {
          name: product.name,
          desc: product.desc,
          brand: product.brand,
          tags: product.tags,
          imgs: {},
          cat: null
        },
        variants: [product]
      });
    }
    console.log(`Extracted ${results.length} products from flat structure`);
    return results;
  }

  console.warn('No products found in API response. Structure:', {
    hasData: !!apiResponse.data,
    dataIsArray: Array.isArray(apiResponse.data),
    hasProducts: !!apiResponse.products,
    productsIsArray: Array.isArray(apiResponse.products),
    keys: Object.keys(apiResponse)
  });

  return [];
}

/**
 * Category Assignment Logic
 */
export function assignCategory(product: { tags?: string[]; desc?: string; brand?: string; name?: string }): { main: string; sub: string | null } {
  const searchText = [
    ...(product.tags || []),
    product.desc || '',
    product.brand || '',
    product.name || ''
  ].join(' ').toLowerCase();

  // Strain-based categorization (from tags)
  if (product.tags && product.tags.length > 0) {
    for (const tag of product.tags) {
      const tagLower = tag.toLowerCase();
      
      if (tagLower.includes('strain type = indica')) {
        return { main: 'Flower', sub: 'Indica' };
      }
      if (tagLower.includes('strain type = sativa')) {
        return { main: 'Flower', sub: 'Sativa' };
      }
      if (tagLower.includes('strain type = hybrid')) {
        return { main: 'Flower', sub: 'Hybrid' };
      }
    }
  }

  // Category inference from product content
  const categoryMap: Array<{ keywords: string[]; main: string; sub?: string }> = [
    { keywords: ['pre roll', 'pre-roll', 'preroll', 'joint', 'blunt'], main: 'Pre Rolls', sub: null },
    { keywords: ['cartridge', 'cart', 'vape cart', '510 thread'], main: 'Cartridges', sub: null },
    { keywords: ['disposable', 'disposable vape', 'puff bar', 'disposable pen'], main: 'Disposables', sub: null },
    { keywords: ['liquid diamonds', 'concentrate', 'wax', 'shatter', 'budder', 'crumble', 'rosin', 'resin', 'distillate', 'sauce'], main: 'Concentrates', sub: null },
    { keywords: ['edible', 'gummies', 'gummy', 'chocolate', 'candy', 'brownie', 'cookie', 'beverage'], main: 'Edibles', sub: null },
    { keywords: ['flower', 'bud', 'eighth', '1/8', 'quarter', '1/4', 'half ounce', 'ounce'], main: 'Flower', sub: null },
    { keywords: ['topical', 'lotion', 'balm', 'cream', 'salve', 'bath', 'bath bomb'], main: 'Topicals', sub: null },
    { keywords: ['grinder', 'pipe', 'bong', 'paper', 'rolling', 'lighter', 'tray', 'accessory', 'battery', 'torch'], main: 'Accessories', sub: null },
  ];

  for (const { keywords, main, sub } of categoryMap) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        return { main, sub: sub || null };
      }
    }
  }

  return { main: 'Miscellaneous', sub: null };
}

/**
 * Extract volume information
 */
export function extractVolume(text: string): string | null {
  const volumePatterns = [
    /(\d+\.?\d*)\s*(g|gram|grams)/i,
    /(\d+\.?\d*)\s*(mg|milligram|milligrams)/i,
    /(\d+\.?\d*)\s*(ml|milliliter|milliliters)/i,
    /(\d+\.?\d*)\s*(oz|ounce|ounces)/i,
    /(\d+)\s*(pack|ct|count)/i,
    /(\d+\.?\d*)(g|mg|ml)/i,
  ];

  for (const pattern of volumePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return null;
}

/**
 * Parse pricing tiers
 */
export function parsePricingTiers(tiers?: RawProductTier[]): ParsedPricingTier[] {
  if (!tiers || tiers.length === 0) {
    return [];
  }

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
 * Main parser function - NOW HANDLES VARIANTS PROPERLY
 */
export function parseProducts(rawData: Array<{ parent: any; variants: RawProduct[] }>): ParsedProduct[] {
  const parsedProducts: ParsedProduct[] = [];

  for (const { parent, variants } of rawData) {
    // Get category from parent data
    const category = assignCategory({
      tags: parent.tags,
      desc: parent.desc,
      brand: parent.brand,
      name: parent.name
    });

    // Get parent-level images
    const parentImages: string[] = [];
    if (parent.imgs && typeof parent.imgs === 'object') {
      parentImages.push(...Object.values(parent.imgs));
    }

    // Find the lowest price among variants for the base price
    const lowestPrice = Math.min(...variants.map(v => v.price));

    // Find a variant with tiers to use as base tiers (prefer the first one with tiers)
    const baseTiers = variants.find(v => v.tiers && v.tiers.length > 0)?.tiers || [];

    // Parse variants
    const parsedVariants: ParsedVariant[] = variants.map(variant => {
      const variantType = detectVariantType(variant.name, parent);
      const priceModifier = variant.price - lowestPrice;

      return {
        variantName: variant.name,
        variantType,
        stockQuantity: variant.qty || 0,
        priceModifier,
        isAvailable: true,
        sourceId: variant.id.toString(),
        tiers: parsePricingTiers(variant.tiers)
      };
    });

    // Extract volume from parent name/description
    const volume = extractVolume(`${parent.name} ${parent.desc || ''}`);

    // Create the product
    parsedProducts.push({
      sourceId: `parent_${parent.name.replace(/\s+/g, '_')}`,
      name: parent.name,
      description: parent.desc || null,
      price: lowestPrice,
      imageUrl: parentImages[0] || null,
      images: parentImages,
      mainCategory: category.main,
      subCategory: category.sub,
      brand: parent.brand || null,
      volume,
      stockQuantity: variants.reduce((sum, v) => sum + (v.qty || 0), 0),
      pricingTiers: parsePricingTiers(baseTiers),
      variants: parsedVariants
    });
  }

  // Sort alphabetically by name
  parsedProducts.sort((a, b) => a.name.localeCompare(b.name));

  return parsedProducts;
}

/**
 * Detect changes between existing and new product data
 */
export function detectProductChanges(
  existing: ParsedProduct,
  incoming: ParsedProduct
): {
  hasChanges: boolean;
  changedFields: string[];
} {
  const changedFields: string[] = [];

  if (existing.price !== incoming.price) {
    changedFields.push('price');
  }

  if (existing.description !== incoming.description) {
    changedFields.push('description');
  }

  if (existing.mainCategory !== incoming.mainCategory) {
    changedFields.push('mainCategory');
  }

  if (existing.imageUrl !== incoming.imageUrl) {
    changedFields.push('imageUrl');
  }

  const existingTierString = JSON.stringify(existing.pricingTiers);
  const incomingTierString = JSON.stringify(incoming.pricingTiers);
  if (existingTierString !== incomingTierString) {
    changedFields.push('pricingTiers');
  }

  const existingVariantString = JSON.stringify(existing.variants);
  const incomingVariantString = JSON.stringify(incoming.variants);
  if (existingVariantString !== incomingVariantString) {
    changedFields.push('variants');
  }

  return {
    hasChanges: changedFields.length > 0,
    changedFields
  };
}