/**
 * Product API Parser V2
 * 
 * Parses the exact JSON structure from the Product API with proper:
 * - Category detection from "cat" field
 * - Variant grouping (1 product → multiple variants)
 * - Image proxy URL construction
 * - Pricing tier extraction
 */

export interface APIProduct {
  name: string;
  desc: string | null;
  brand: string | null;
  tags: string[];
  imgs: Record<string, string>;
  cat: string | null;
  products: APIVariant[];
}

export interface APIVariant {
  name: string;
  tiers: APITier[];
  qty: number;
  desc: string | null;
  tags: string[];
  id: number;
  price: number;
  images: string[];
}

export interface APITier {
  price: number;
  qty: string; // e.g., "5+", "10+"
}

export interface ParsedProduct {
  sourceId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  mainCategory: string;
  brand: string | null;
  stockQuantity: number;
  variants: ParsedVariant[];
  pricingTiers: ParsedTier[];
  images: string[];
}

export interface ParsedVariant {
  variantName: string;
  variantType: string;
  stockQuantity: number;
  priceModifier: number;
  isAvailable: boolean;
  sourceId: string;
  pricingTiers: ParsedTier[];
}

export interface ParsedTier {
  minQuantity: number;
  price: number;
  quantityLabel: string;
}

/**
 * Parse the API JSON structure
 */
export function parseProductAPI(
  apiData: any,
  imageProxyDomain: string = 'https://chadsflooring.bz',
  defaultImageSize: number = 450
): ParsedProduct[] {
  if (!apiData || !apiData.data || !Array.isArray(apiData.data)) {
    throw new Error('Invalid API structure: missing "data" array');
  }

  const imagePathPrefix = apiData.imagePathPrefix || '/uploads/products/';
  const imageSizeVariants = apiData.imageSizeVariants || [950, 750, 450, 400, 375, 325, 300, 250, 225, 178, 80];

  const products: ParsedProduct[] = [];

  for (const item of apiData.data) {
    try {
      const parsed = parseProductItem(
        item,
        imageProxyDomain,
        imagePathPrefix,
        defaultImageSize,
        imageSizeVariants
      );
      if (parsed) {
        products.push(parsed);
      }
    } catch (error) {
      console.error(`Failed to parse product item:`, error);
      // Continue with next item instead of failing entire import
    }
  }

  return products;
}

function parseProductItem(
  item: APIProduct,
  imageProxyDomain: string,
  imagePathPrefix: string,
  defaultImageSize: number,
  imageSizeVariants: number[]
): ParsedProduct | null {
  if (!item.products || item.products.length === 0) {
    console.warn(`Skipping product "${item.name}": no variants found`);
    return null;
  }

  // Use the first variant's data as base product info
  const firstVariant = item.products[0];
  const sourceId = `api-${firstVariant.id}`;

  // Determine category
  const mainCategory = determineCategory(item);

  // Get base price (lowest price among all variants)
  const basePrice = Math.min(...item.products.map(v => v.price));

  // Parse main product image
  const imageUrl = parseMainImage(item.imgs, imageProxyDomain, imagePathPrefix, defaultImageSize);

  // Parse additional images from first variant
  const additionalImages = parseImages(
    firstVariant.images || [],
    imageProxyDomain,
    imagePathPrefix,
    defaultImageSize
  );

  // Combine all images
  const allImages = imageUrl ? [imageUrl, ...additionalImages] : additionalImages;

  // Total stock across all variants
  const totalStock = item.products.reduce((sum, v) => sum + (v.qty || 0), 0);

  // Parse variants
  const variants = parseVariants(item.products, basePrice);

  // Parse pricing tiers from first variant (if exists)
  const pricingTiers = parseTiers(firstVariant.tiers || []);

  return {
    sourceId,
    name: item.name,
    description: sanitizeDescription(item.desc || firstVariant.desc),
    price: basePrice,
    imageUrl: imageUrl,
    mainCategory,
    brand: item.brand,
    stockQuantity: totalStock,
    variants,
    pricingTiers,
    images: allImages,
  };
}

/**
 * Determine category from "cat" field or parse from product name
 */
function determineCategory(item: APIProduct): string {
  // Priority 1: Use "cat" field if available
  if (item.cat && item.cat.trim() !== '') {
    return item.cat.trim();
  }

  // Priority 2: Parse from product name using keywords
  const name = item.name.toLowerCase();
  const brand = (item.brand || '').toLowerCase();

  // Category keyword mapping (in priority order)
  const categoryMap: Record<string, string[]> = {
    'Pre Rolls': ['pre-roll', 'preroll', 'pre roll'],
    'Cartridges': ['cartridge', 'cart', 'vape cart', '510 thread'],
    'Disposables': ['disposable', 'dispo', 'disposable vape'],
    'Concentrates': ['concentrate', 'rosin', 'wax', 'shatter', 'crumble', 'budder', 'live resin'],
    'Edibles': ['edible', 'gummy', 'gummies', 'chocolate', 'candy'],
    'Flower': ['flower', 'eighth', '3.5g', 'bud', 'oz', 'ounce'],
    'Accessories': ['battery', 'torch', 'grinder', 'lighter', 'pipe', 'bong', 'rig', 'chillum', 'ashcatcher', 'downstem'],
    'Topicals': ['topical', 'cream', 'balm', 'lotion'],
  };

  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(keyword => name.includes(keyword) || brand.includes(keyword))) {
      return category;
    }
  }

  // Default category
  return 'Uncategorized';
}

/**
 * Parse main product image from imgs object
 */
function parseMainImage(
  imgs: Record<string, string>,
  imageProxyDomain: string,
  imagePathPrefix: string,
  defaultImageSize: number
): string | null {
  if (!imgs || Object.keys(imgs).length === 0) {
    return null;
  }

  // Get first image
  const firstImageName = Object.values(imgs)[0];
  if (!firstImageName) return null;

  return constructImageURL(firstImageName, imageProxyDomain, imagePathPrefix, defaultImageSize);
}

/**
 * Parse images array
 */
function parseImages(
  images: string[],
  imageProxyDomain: string,
  imagePathPrefix: string,
  defaultImageSize: number
): string[] {
  return images
    .filter(img => img && img.trim() !== '')
    .map(img => constructImageURL(img, imageProxyDomain, imagePathPrefix, defaultImageSize))
    .filter(url => url !== null) as string[];
}

/**
 * Construct full image URL with proxy domain and size replacement
 */
function constructImageURL(
  imageName: string,
  imageProxyDomain: string,
  imagePathPrefix: string,
  defaultImageSize: number
): string | null {
  if (!imageName || imageName.trim() === '') return null;

  // Replace placeholder with actual size
  const finalImageName = imageName.replace('x_imgvariantsize', `x${defaultImageSize}`);

  // Ensure proxy domain doesn't have trailing slash
  const cleanProxyDomain = imageProxyDomain.replace(/\/$/, '');

  return `${cleanProxyDomain}${imagePathPrefix}${finalImageName}`;
}

/**
 * Parse variants from products array
 */
function parseVariants(apiProducts: APIVariant[], basePrice: number): ParsedVariant[] {
  if (apiProducts.length <= 1) {
    // No variants - single product
    return [];
  }

  return apiProducts.map(product => {
    const priceModifier = product.price - basePrice;

    return {
      variantName: product.name,
      variantType: 'option', // Generic type, could be enhanced with name parsing
      stockQuantity: product.qty || 0,
      priceModifier,
      isAvailable: (product.qty || 0) > 0,
      sourceId: `api-variant-${product.id}`,
      pricingTiers: parseTiers(product.tiers || []),
    };
  });
}

/**
 * Parse pricing tiers
 */
function parseTiers(tiers: APITier[]): ParsedTier[] {
  if (!tiers || tiers.length === 0) {
    return [];
  }

  return tiers.map(tier => {
    // Parse quantity string (e.g., "5+" → 5, "10+" → 10)
    const minQuantity = parseInt(tier.qty.replace('+', '').trim()) || 1;

    return {
      minQuantity,
      price: tier.price,
      quantityLabel: tier.qty,
    };
  }).sort((a, b) => a.minQuantity - b.minQuantity);
}

/**
 * Sanitize HTML description
 */
function sanitizeDescription(desc: string | null): string | null {
  if (!desc) return null;

  // Replace <BR> and <br> tags with actual line breaks
  let sanitized = desc.replace(/<BR>/gi, '\n').replace(/<br>/gi, '\n');

  // Remove other HTML tags but keep content
  sanitized = sanitized.replace(/<B>/gi, '**').replace(/<\/B>/gi, '**');
  sanitized = sanitized.replace(/<b>/gi, '**').replace(/<\/b>/gi, '**');

  return sanitized.trim();
}

/**
 * Get available categories from parsed products
 */
export function getAvailableCategories(products: ParsedProduct[]): string[] {
  const categories = new Set<string>();
  products.forEach(p => categories.add(p.mainCategory));
  return Array.from(categories).sort();
}

/**
 * Get available brands from parsed products
 */
export function getAvailableBrands(products: ParsedProduct[]): string[] {
  const brands = new Set<string>();
  products.forEach(p => {
    if (p.brand) brands.add(p.brand);
  });
  return Array.from(brands).sort();
}
