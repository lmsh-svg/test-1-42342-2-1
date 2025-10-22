/**
 * Product API Parser
 * Comprehensive parsing logic for external product API JSON format
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

// NEW: Support for nested API structure
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
    cat?: string | null;
    products?: RawProduct[];
  }>;
  products?: RawProduct[]; // Alternative flat structure
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
}

export interface ParsedPricingTier {
  minQuantity: number;
  price: number;
  quantityLabel: string; // "1+", "3+", etc.
}

/**
 * Extract flat product list from nested API structure
 */
export function extractProductsFromAPI(apiResponse: RawAPIResponse | RawProduct[]): RawProduct[] {
  // Handle direct array format
  if (Array.isArray(apiResponse)) {
    return apiResponse;
  }

  const products: RawProduct[] = [];

  // Handle nested data[].products[] structure
  if (apiResponse.data && Array.isArray(apiResponse.data)) {
    for (const dataItem of apiResponse.data) {
      if (dataItem.products && Array.isArray(dataItem.products)) {
        // Merge parent-level data into each product
        for (const product of dataItem.products) {
          products.push({
            ...product,
            // Inherit from parent if not set in child
            brand: product.brand || dataItem.brand || undefined,
            tags: product.tags && product.tags.length > 0 ? product.tags : dataItem.tags || [],
            desc: product.desc || dataItem.desc || undefined,
          });
        }
      }
    }
    
    console.log(`Extracted ${products.length} products from nested data structure`);
    return products;
  }

  // Handle flat products array
  if (apiResponse.products && Array.isArray(apiResponse.products)) {
    console.log(`Extracted ${apiResponse.products.length} products from flat structure`);
    return apiResponse.products;
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
 * Determines category based on tags, description, brand, and name
 */
export function assignCategory(product: RawProduct): { main: string; sub: string | null } {
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
      
      // Check for strain types
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
    // Pre Rolls
    { keywords: ['pre roll', 'pre-roll', 'preroll', 'joint', 'blunt'], main: 'Pre Rolls', sub: null },
    
    // Cartridges
    { keywords: ['cartridge', 'cart', 'vape cart', '510 thread'], main: 'Cartridges', sub: null },
    
    // Disposables
    { keywords: ['disposable', 'disposable vape', 'puff bar', 'disposable pen'], main: 'Disposables', sub: null },
    
    // Concentrates
    { keywords: ['liquid diamonds', 'concentrate', 'wax', 'shatter', 'budder', 'crumble', 'rosin', 'resin', 'distillate', 'sauce'], main: 'Concentrates', sub: null },
    
    // Edibles
    { keywords: ['edible', 'gummies', 'gummy', 'chocolate', 'candy', 'brownie', 'cookie', 'beverage'], main: 'Edibles', sub: null },
    
    // Flower
    { keywords: ['flower', 'bud', 'eighth', '1/8', 'quarter', '1/4', 'half ounce', 'ounce'], main: 'Flower', sub: null },
    
    // Topicals
    { keywords: ['topical', 'lotion', 'balm', 'cream', 'salve', 'bath', 'bath bomb'], main: 'Topicals', sub: null },
    
    // Accessories
    { keywords: ['grinder', 'pipe', 'bong', 'paper', 'rolling', 'lighter', 'tray', 'accessory', 'battery', 'torch'], main: 'Accessories', sub: null },
  ];

  for (const { keywords, main, sub } of categoryMap) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        return { main, sub: sub || null };
      }
    }
  }

  // Default to Miscellaneous if no category determined
  return { main: 'Miscellaneous', sub: null };
}

/**
 * Extract volume information from product name/description
 */
export function extractVolume(product: RawProduct): string | null {
  const searchText = `${product.name} ${product.desc || ''}`.toLowerCase();
  
  const volumePatterns = [
    /(\d+\.?\d*)\s*(g|gram|grams)/i,
    /(\d+\.?\d*)\s*(mg|milligram|milligrams)/i,
    /(\d+\.?\d*)\s*(ml|milliliter|milliliters)/i,
    /(\d+\.?\d*)\s*(oz|ounce|ounces)/i,
    /(\d+)\s*(pack|ct|count)/i,
    /(\d+\.?\d*)(g|mg|ml)/i, // Compact format
  ];

  for (const pattern of volumePatterns) {
    const match = searchText.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return null;
}

/**
 * Parse pricing tiers from API format
 */
export function parsePricingTiers(product: RawProduct): ParsedPricingTier[] {
  if (!product.tiers || product.tiers.length === 0) {
    return [];
  }

  const tiers = product.tiers
    .map(tier => {
      // Parse quantity from strings like "1+", "3+", "10+"
      const qtyMatch = tier.qty.match(/(\d+)\+?/);
      const minQuantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;

      return {
        minQuantity,
        price: tier.price,
        quantityLabel: tier.qty
      };
    })
    .sort((a, b) => a.minQuantity - b.minQuantity); // Sort by quantity ascending

  return tiers;
}

/**
 * Deduplicate products by ID first, then by name
 */
export function deduplicateProducts(products: RawProduct[]): RawProduct[] {
  const uniqueById = new Map<number, RawProduct>();
  const uniqueByName = new Map<string, RawProduct>();

  for (const product of products) {
    // Check by ID first
    if (product.id) {
      const existing = uniqueById.get(product.id);
      if (!existing) {
        uniqueById.set(product.id, product);
      } else {
        // Keep the one with more tiers or longer description
        const currentTierCount = product.tiers?.length || 0;
        const existingTierCount = existing.tiers?.length || 0;
        const currentDescLength = product.desc?.length || 0;
        const existingDescLength = existing.desc?.length || 0;

        if (currentTierCount > existingTierCount || 
            (currentTierCount === existingTierCount && currentDescLength > existingDescLength)) {
          uniqueById.set(product.id, product);
        }
      }
    }
  }

  // Second pass: check by name for products without IDs or duplicates
  const deduplicatedById = Array.from(uniqueById.values());
  
  for (const product of deduplicatedById) {
    const normalizedName = product.name.trim().toLowerCase();
    const existing = uniqueByName.get(normalizedName);
    
    if (!existing) {
      uniqueByName.set(normalizedName, product);
    } else {
      // Keep the one with more tiers or longer description
      const currentTierCount = product.tiers?.length || 0;
      const existingTierCount = existing.tiers?.length || 0;
      const currentDescLength = product.desc?.length || 0;
      const existingDescLength = existing.desc?.length || 0;

      if (currentTierCount > existingTierCount || 
          (currentTierCount === existingTierCount && currentDescLength > existingDescLength)) {
        uniqueByName.set(normalizedName, product);
      }
    }
  }

  return Array.from(uniqueByName.values());
}

/**
 * Main parser function - converts raw API products to parsed format
 */
export function parseProducts(rawProducts: RawProduct[]): ParsedProduct[] {
  // Step 1: Deduplicate
  const uniqueProducts = deduplicateProducts(rawProducts);

  // Step 2: Parse each product
  const parsedProducts = uniqueProducts.map(product => {
    const category = assignCategory(product);
    const pricingTiers = parsePricingTiers(product);
    const volume = extractVolume(product);

    // Use first image as primary, rest as additional
    const images = product.images || [];
    const imageUrl = images.length > 0 ? images[0] : null;

    return {
      sourceId: product.id.toString(),
      name: product.name.trim(),
      description: product.desc?.trim() || null,
      price: product.price,
      imageUrl,
      images,
      mainCategory: category.main,
      subCategory: category.sub,
      brand: product.brand?.trim() || null,
      volume,
      stockQuantity: 0, // Set by availability logic
      pricingTiers
    };
  });

  // Step 3: Sort alphabetically by name within categories
  parsedProducts.sort((a, b) => {
    if (a.mainCategory !== b.mainCategory) {
      return a.mainCategory.localeCompare(b.mainCategory);
    }
    return a.name.localeCompare(b.name);
  });

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

  // Check tier changes
  const existingTierString = JSON.stringify(existing.pricingTiers);
  const incomingTierString = JSON.stringify(incoming.pricingTiers);
  if (existingTierString !== incomingTierString) {
    changedFields.push('pricingTiers');
  }

  return {
    hasChanges: changedFields.length > 0,
    changedFields
  };
}