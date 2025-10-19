/**
 * API Parsers for JSON and HTML product data
 * Handles image extraction and product data normalization
 */

interface ParsedProduct {
  sourceId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  images?: string[];
  category?: string;
  mainCategory: string;
  subCategory?: string;
  brand?: string;
  volume?: string;
  stockQuantity: number;
  isAvailable: boolean;
  tags?: Record<string, string>;
  variants?: Array<{
    variantName: string;
    variantType: string;
    price: number;
    stockQuantity: number;
    imageUrl?: string;
  }>;
  // Add breakdown pricing info
  bulkPricing?: Array<{
    minQuantity: number;
    price: number;
  }>;
}

interface ParseResult {
  products: ParsedProduct[];
  errors: string[];
  warnings: string[];
}

/**
 * Helper function to extract products from various JSON structures
 */
function findProductsInObject(obj: any, depth: number = 0): any[] {
  if (depth > 5) return []; // Prevent infinite recursion
  
  let products: any[] = [];
  
  // If it's an array, check if it contains products
  if (Array.isArray(obj)) {
    // Check if items look like products
    const hasProductFields = obj.some(item => 
      item && typeof item === 'object' && (
        item.name || item.title || item.productName ||
        item.price || item.cost || item.amount
      )
    );
    
    if (hasProductFields) {
      return obj;
    }
    
    // Otherwise, recursively search array items
    for (const item of obj) {
      products = products.concat(findProductsInObject(item, depth + 1));
    }
    return products;
  }
  
  // If it's an object, look for product-like arrays
  if (obj && typeof obj === 'object') {
    // Common keys that might contain product arrays
    const productKeys = [
      'products', 'items', 'data', 'results', 'entries', 
      'catalog', 'inventory', 'goods', 'merchandise'
    ];
    
    for (const key of productKeys) {
      if (Array.isArray(obj[key])) {
        const found = findProductsInObject(obj[key], depth + 1);
        if (found.length > 0) {
          products = products.concat(found);
        }
      }
    }
    
    // If no products found yet, recursively search all values
    if (products.length === 0) {
      for (const value of Object.values(obj)) {
        if (value && typeof value === 'object') {
          const found = findProductsInObject(value, depth + 1);
          if (found.length > 0) {
            products = products.concat(found);
            break; // Stop after finding first valid set
          }
        }
      }
    }
  }
  
  return products;
}

/**
 * Helper to safely extract string value from various field names
 */
function extractField(item: any, ...fieldNames: string[]): string | undefined {
  for (const fieldName of fieldNames) {
    const value = item[fieldName];
    if (value !== undefined && value !== null && value !== '') {
      return String(value).trim();
    }
  }
  return undefined;
}

/**
 * Helper to safely extract number value
 */
function extractNumber(item: any, ...fieldNames: string[]): number {
  for (const fieldName of fieldNames) {
    const value = item[fieldName];
    if (value !== undefined && value !== null) {
      const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
      if (!isNaN(num)) {
        return num;
      }
    }
  }
  return 0;
}

/**
 * Enhanced category detection from product name and description
 */
function detectMainCategory(name: string, description: string = '', category: string = ''): string {
  const nameL = name?.toLowerCase() || '';
  const descL = description?.toLowerCase() || '';
  const catL = category?.toLowerCase() || '';
  const combined = `${nameL} ${descL} ${catL}`;

  // DISPOSABLES - Highest priority to catch AIO and disposable vapes
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

  // EDIBLES - Second priority for gummies, beverages, soft gels, etc.
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

  // TOPICALS - Balms, lotions, creams
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

  // PRE ROLLS - Joints, blunts, infused rolls (check before concentrates)
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

  // CARTRIDGES - Vape cartridges and tanks (check before concentrates)
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

  // ACCESSORIES - Batteries, devices, tools, lighters
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

  // BYOB (Build Your Own Brand) - White label, bulk products
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

  // CONCENTRATES - Wax, shatter, rosin, badder, etc.
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

  // FALLBACK: Try to infer from brand or product type patterns
  // Check if it's a cartridge brand
  const cartridgeBrands = ['raw garden', 'stiiizy', 'plug play', 'friendly farms'];
  if (cartridgeBrands.some(brand => combined.includes(brand))) {
    return 'Cartridges';
  }
  
  // Check if it's a concentrate brand
  const concentrateBrands = ['710 labs', 'west coast cure', 'friendly brand'];
  if (concentrateBrands.some(brand => combined.includes(brand))) {
    return 'Concentrates';
  }
  
  // Check if it's an edible brand
  const edibleBrands = ['lost farms', 'kiva', 'wyld', 'kanha', 'potters'];
  if (edibleBrands.some(brand => combined.includes(brand))) {
    return 'Edibles';
  }

  // ULTIMATE FALLBACK: Default to Concentrates as it's the most general category
  return 'Concentrates';
}

/**
 * Parse JSON data with flexible field mapping
 */
export function parseJSONProducts(data: string): ParseResult {
  const result: ParseResult = {
    products: [],
    errors: [],
    warnings: []
  };

  try {
    const parsed = JSON.parse(data);
    
    // Check for specific chadsflooring.bz format
    if (parsed.imagePathPrefix && parsed.data && Array.isArray(parsed.data)) {
      result.warnings.push('Detected chadsflooring.bz API format');
      
      const baseUrl = 'https://chadsflooring.bz';
      const imagePrefix = parsed.imagePathPrefix;
      
      for (let i = 0; i < parsed.data.length; i++) {
        try {
          const item = parsed.data[i];
          
          // Each item has nested products array
          if (!item.products || !Array.isArray(item.products)) {
            continue;
          }
          
          const parentName = item.name || 'Unnamed Product';
          const productsArray = item.products;
          
          if (productsArray.length === 0) {
            continue;
          }
          
          // Use first product as the main product data
          const firstProduct = productsArray[0];
          const sourceId = firstProduct.id?.toString() || `json-${Date.now()}-${i}`;
          const name = parentName;
          const description = item.desc || firstProduct.desc;
          const price = parseFloat(firstProduct.price) || 0;
          
          if (price === 0) {
            result.warnings.push(`Skipping ${name}: no valid price`);
            continue;
          }
          
          // Process images
          const images: string[] = [];
          for (const product of productsArray) {
            if (product.images && Array.isArray(product.images)) {
              for (const imgPath of product.images) {
                const processedPath = imgPath.replace('x_imgvariantsize', 'x250');
                const fullUrl = `${baseUrl}${imagePrefix}${processedPath}`;
                if (!images.includes(fullUrl)) {
                  images.push(fullUrl);
                }
              }
            }
          }
          
          if (item.imgs && typeof item.imgs === 'object') {
            for (const imgPath of Object.values(item.imgs)) {
              if (typeof imgPath === 'string') {
                const fullUrl = `${baseUrl}${imagePrefix}${imgPath}`;
                if (!images.includes(fullUrl)) {
                  images.push(fullUrl);
                }
              }
            }
          }
          
          // Extract fields
          const brand = firstProduct.brand || item.brand;
          const category = firstProduct.cat || item.cat;
          
          // CRITICAL FIX: Use enhanced category detection
          const mainCategory = detectMainCategory(name, description, category);
          
          // Calculate total stock
          let totalStock = 0;
          for (const product of productsArray) {
            totalStock += Math.max(0, parseInt(product.qty) || 0);
          }
          
          // Extract tags
          const tags: Record<string, string> = {};
          const tagsList = item.tags || [];
          if (Array.isArray(tagsList)) {
            tagsList.forEach((tag: any, idx: number) => {
              if (typeof tag === 'string') {
                tags[`tag${idx + 1}`] = tag;
              } else if (tag && typeof tag === 'object') {
                Object.entries(tag).forEach(([key, value]) => {
                  if (value !== undefined && value !== null) {
                    tags[key] = String(value);
                  }
                });
              }
            });
          }
          
          // Create variants only if multiple products
          const variants: ParsedProduct['variants'] = [];
          
          if (productsArray.length > 1) {
            for (const product of productsArray) {
              const variantName = product.name || 'Default';
              const variantPrice = parseFloat(product.price) || price;
              const variantStock = Math.max(0, parseInt(product.qty) || 0);
              
              let variantImage: string | undefined;
              if (product.images && Array.isArray(product.images) && product.images.length > 0) {
                const processedPath = product.images[0].replace('x_imgvariantsize', 'x250');
                variantImage = `${baseUrl}${imagePrefix}${processedPath}`;
              }
              
              variants.push({
                variantName,
                variantType: 'flavor',
                price: variantPrice,
                stockQuantity: variantStock,
                imageUrl: variantImage
              });
            }
          }
          
          const parsedProduct: ParsedProduct = {
            sourceId,
            name,
            description: description || undefined,
            price,
            imageUrl: images[0] || undefined,
            images: images.length > 1 ? images : undefined,
            category: category || undefined,
            mainCategory,
            subCategory: undefined,
            brand: brand || undefined,
            volume: undefined,
            stockQuantity: variants.length > 0 ? 0 : Math.max(0, parseInt(firstProduct.qty) || 0),
            isAvailable: totalStock > 0,
            tags: Object.keys(tags).length > 0 ? tags : undefined,
            variants: variants.length > 0 ? variants : undefined
          };
          
          result.products.push(parsedProduct);
        } catch (itemError) {
          result.errors.push(`Failed to parse item ${i}: ${itemError}`);
        }
      }
      
      if (result.products.length > 0) {
        result.warnings.push(`Successfully parsed ${result.products.length} products with enhanced category detection`);
        return result;
      }
    }
    
    // Fall back to generic JSON parsing
    const items = findProductsInObject(parsed);
    
    if (items.length === 0) {
      result.warnings.push('No products found in JSON structure');
      return result;
    }

    result.warnings.push(`Found ${items.length} potential products in JSON`);

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        
        // Skip if not an object
        if (!item || typeof item !== 'object') {
          continue;
        }
        
        // Extract source ID
        const sourceId = extractField(
          item,
          'id', 'productId', 'sku', 'sourceId', 'product_id', 'item_id', 'uid'
        ) || `json-${Date.now()}-${i}`;

        // Extract name
        const name = extractField(
          item,
          'name', 'title', 'productName', 'product_name', 'item_name', 'displayName'
        ) || 'Unnamed Product';

        // Extract price
        const price = extractNumber(
          item,
          'price', 'cost', 'amount', 'priceValue', 'unitPrice', 'price_value', 'retail_price', 'sale_price'
        );

        // Skip if no valid price
        if (price === 0) {
          result.warnings.push(`Skipping item ${i}: no valid price found`);
          continue;
        }

        // Extract images - handle multiple formats
        let images: string[] = [];
        let imageUrl: string | undefined;

        // Check various image field formats
        const imageFields = [
          'images', 'imageUrls', 'image_urls', 'pictures', 'photos', 'media'
        ];
        
        for (const field of imageFields) {
          if (item[field] && Array.isArray(item[field])) {
            images = item[field].map((img: any) => {
              if (typeof img === 'string') return img;
              if (img?.url) return img.url;
              if (img?.src) return img.src;
              if (img?.imageUrl) return img.imageUrl;
              return null;
            }).filter(Boolean);
            break;
          }
        }

        // Check single image fields
        if (images.length === 0) {
          const singleImage = extractField(
            item,
            'image', 'imageUrl', 'image_url', 'thumbnail', 'img', 'picture', 'photo', 'primaryImage'
          );
          if (singleImage) {
            images = [singleImage];
          }
        }

        // Set primary image
        imageUrl = images[0];

        // Extract description
        const description = extractField(
          item,
          'description', 'desc', 'details', 'summary', 'info', 'about', 'product_description'
        );

        // Extract category information
        const mainCategory = extractField(
          item,
          'mainCategory', 'main_category', 'category', 'type', 'productType', 'product_type', 'categoryName'
        ) || 'Other';
        
        const subCategory = extractField(
          item,
          'subCategory', 'sub_category', 'subcategory', 'subtype'
        );
        
        const category = extractField(item, 'category', 'cat');

        // Extract brand
        const brand = extractField(
          item,
          'brand', 'manufacturer', 'vendor', 'maker', 'brandName', 'brand_name'
        );

        // Extract volume/size
        const volume = extractField(
          item,
          'volume', 'size', 'weight', 'capacity', 'amount', 'unit', 'packaging'
        );

        // Extract stock
        const stockQuantity = Math.max(0, extractNumber(
          item,
          'stockQuantity', 'stock', 'inventory', 'quantity', 'qty', 'available', 'stock_quantity', 'in_stock'
        ));

        // Extract availability
        let isAvailable = stockQuantity > 0;
        if (item.isAvailable !== undefined) {
          isAvailable = Boolean(item.isAvailable);
        } else if (item.available !== undefined) {
          isAvailable = Boolean(item.available);
        } else if (item.in_stock !== undefined) {
          isAvailable = Boolean(item.in_stock);
        }

        // Extract tags
        const tags: Record<string, string> = {};
        if (item.tags && typeof item.tags === 'object') {
          if (Array.isArray(item.tags)) {
            // Handle tag arrays
            item.tags.forEach((tag: any, idx: number) => {
              if (typeof tag === 'string') {
                tags[`tag${idx + 1}`] = tag;
              } else if (tag && typeof tag === 'object' && tag.name && tag.value) {
                tags[tag.name] = tag.value;
              }
            });
          } else {
            // Handle tag objects
            Object.entries(item.tags).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                tags[key] = String(value);
              }
            });
          }
        }

        // Extract variants
        const variants: ParsedProduct['variants'] = [];
        const variantFields = ['variants', 'options', 'variations', 'choices', 'flavors', 'colors'];
        
        for (const field of variantFields) {
          if (item[field] && Array.isArray(item[field])) {
            for (const variant of item[field]) {
              if (!variant || typeof variant !== 'object') continue;
              
              const variantName = extractField(
                variant,
                'name', 'variantName', 'variant_name', 'title', 'option', 'label'
              ) || 'Default';
              
              const variantType = extractField(
                variant,
                'type', 'variantType', 'variant_type', 'optionType', 'category'
              ) || 'option';
              
              const variantPrice = extractNumber(
                variant,
                'price', 'cost', 'amount', 'priceModifier', 'price_modifier'
              );
              
              const variantStock = Math.max(0, extractNumber(
                variant,
                'stock', 'stockQuantity', 'stock_quantity', 'quantity', 'available'
              ));
              
              const variantImage = extractField(
                variant,
                'imageUrl', 'image_url', 'image', 'img', 'picture'
              );

              variants.push({
                variantName,
                variantType,
                price: variantPrice || price,
                stockQuantity: variantStock,
                imageUrl: variantImage
              });
            }
            break; // Use first valid variants array found
          }
        }

        const product: ParsedProduct = {
          sourceId,
          name,
          description,
          price,
          imageUrl,
          images: images.length > 1 ? images : undefined,
          category,
          mainCategory,
          subCategory,
          brand,
          volume,
          stockQuantity,
          isAvailable,
          tags: Object.keys(tags).length > 0 ? tags : undefined,
          variants: variants.length > 0 ? variants : undefined
        };

        result.products.push(product);
      } catch (itemError) {
        result.errors.push(`Failed to parse item ${i}: ${itemError}`);
      }
    }

    if (result.products.length === 0 && result.errors.length === 0) {
      result.warnings.push('No valid products could be extracted from JSON data');
    }

  } catch (error) {
    result.errors.push(`Failed to parse JSON: ${error}`);
  }

  return result;
}

/**
 * Parse HTML data with product extraction (NO IMAGES)
 * CRITICAL: HTML parsing will NOT extract images - only JSON should provide images
 */
export function parseHTMLProducts(html: string): ParseResult {
  const result: ParseResult = {
    products: [],
    errors: [],
    warnings: []
  };

  result.warnings.push('HTML parsing: Images will NOT be extracted (use JSON for images)');

  try {
    // Remove HTML comments
    let cleanHtml = html.replace(/<!--[\s\S]*?-->/g, '');

    // Extract all product blocks (div with class="prod")
    const prodRegex = /<div class="prod">([\s\S]*?)<\/div>\s*(?=<div class="prod">|$)/gi;
    const matches = [...cleanHtml.matchAll(prodRegex)];

    if (matches.length === 0) {
      result.warnings.push('No product blocks found in HTML');
      return result;
    }

    for (let i = 0; i < matches.length; i++) {
      try {
        const block = matches[i][1];

        // Extract product name from h2
        const nameMatch = block.match(/<h2[^>]*class="h"[^>]*>(.*?)<\/h2>/i);
        const rawName = nameMatch ? nameMatch[1].trim() : 'Unnamed Product';
        
        // Remove category suffix in parentheses
        const name = rawName.replace(/\s*\([^)]*\)\s*$/, '').trim();

        // Extract brand
        const brandMatch = block.match(/<p[^>]*class="bi"[^>]*>brand:\s*(.*?)<\/p>/i);
        const brand = brandMatch ? brandMatch[1].trim() : undefined;

        // Extract description
        const descMatch = block.match(/<p[^>]*class="mb0 bi"[^>]*>desc:<\/p>\s*<p[^>]*class="bi mt0"[^>]*>([\s\S]*?)<\/p>/i);
        const description = descMatch ? descMatch[1].trim().replace(/<BR>/gi, '\n') : undefined;

        // CRITICAL: DO NOT extract images from HTML
        // Images should ONLY come from JSON

        // Extract tags
        const tags: Record<string, string> = {};
        const tagsSection = block.match(/<div[^>]*class="bi"[^>]*>tags:<\/div>\s*<ul>([\s\S]*?)<\/ul>/i);
        if (tagsSection) {
          const tagMatches = [...tagsSection[1].matchAll(/<li[^>]*class="ti"[^>]*>(.*?)<\/li>/gi)];
          for (const tagMatch of tagMatches) {
            const tagText = tagMatch[1].trim();
            const [key, value] = tagText.split('=').map(s => s.trim());
            if (key && value) {
              tags[key] = value;
            }
          }
        }

        // Extract individual product items (variants) with breakdown pricing
        const itemsSection = block.match(/<h5[^>]*class="mb0"[^>]*>Products:<\/h5>\s*<ul>([\s\S]*?)<\/ul>/i);
        const variants: ParsedProduct['variants'] = [];
        const bulkPricing: ParsedProduct['bulkPricing'] = [];
        let mainPrice = 0;
        let mainStock = 0;
        let mainSourceId = `html-${Date.now()}-${i}`;

        if (itemsSection) {
          const itemMatches = [...itemsSection[1].matchAll(/<li[^>]*class="pi"[^>]*>([\s\S]*?)<\/li>/gi)];
          
          for (let j = 0; j < itemMatches.length; j++) {
            const itemBlock = itemMatches[j][1];
            
            // Extract product ID and variant name
            const itemNameMatch = itemBlock.match(/<h4>Product (\d+):\s*(.*?)<\/h4>/i);
            const itemId = itemNameMatch ? itemNameMatch[1] : String(j);
            const variantName = itemNameMatch ? itemNameMatch[2].trim() : 'Default';
            
            // Extract price and stock
            const priceStockMatch = itemBlock.match(/\$(\d+(?:\.\d+)?)\s*\|\s*stock:\s*(\d+)/i);
            const price = priceStockMatch ? parseFloat(priceStockMatch[1]) : 0;
            const stock = priceStockMatch ? parseInt(priceStockMatch[2]) : 0;

            // Extract bulk pricing tiers if available
            const tierMatches = [...itemBlock.matchAll(/(\d+)\+:\s*\$(\d+(?:\.\d+)?)/gi)];
            if (tierMatches.length > 0) {
              for (const tierMatch of tierMatches) {
                bulkPricing.push({
                  minQuantity: parseInt(tierMatch[1]),
                  price: parseFloat(tierMatch[2])
                });
              }
            }

            if (j === 0) {
              mainPrice = price;
              mainStock = stock;
              mainSourceId = itemId;
            }

            variants.push({
              variantName,
              variantType: 'variant',
              price,
              stockQuantity: stock,
              imageUrl: undefined // NO IMAGES FROM HTML
            });
          }
        }

        // Determine main category from tags or name
        let mainCategory = 'Other';
        const categoryInName = rawName.match(/\(([^)]+)\)$/);
        if (categoryInName) {
          mainCategory = categoryInName[1];
        } else if (tags['Type']) {
          mainCategory = tags['Type'];
        }

        // Map to standard categories
        const categoryMap: Record<string, string> = {
          'accessories': 'Accessories',
          'accessory': 'Accessories',
          'cartridge': 'Cartridges',
          'cartridges': 'Cartridges',
          'disposable': 'Disposables',
          'disposables': 'Disposables',
          'concentrate': 'Concentrates',
          'concentrates': 'Concentrates',
          'edible': 'Edibles',
          'edibles': 'Edibles',
          'flower': 'Flower',
          'pre roll': 'Pre Rolls',
          'pre-roll': 'Pre Rolls',
          'preroll': 'Pre Rolls',
          'topical': 'Topicals',
          'topicals': 'Topicals'
        };

        mainCategory = categoryMap[mainCategory.toLowerCase()] || mainCategory;

        const product: ParsedProduct = {
          sourceId: mainSourceId,
          name,
          description,
          price: mainPrice,
          imageUrl: undefined, // NO IMAGES FROM HTML
          images: undefined, // NO IMAGES FROM HTML
          category: undefined,
          mainCategory,
          subCategory: undefined,
          brand,
          volume: undefined,
          stockQuantity: mainStock,
          isAvailable: mainStock > 0,
          tags: Object.keys(tags).length > 0 ? tags : undefined,
          variants: variants.length > 0 ? variants : undefined,
          bulkPricing: bulkPricing.length > 0 ? bulkPricing : undefined
        };

        result.products.push(product);
      } catch (itemError) {
        result.errors.push(`Failed to parse product block ${i}: ${itemError}`);
      }
    }

    if (result.products.length === 0) {
      result.warnings.push('No products extracted from HTML');
    }

  } catch (error) {
    result.errors.push(`Failed to parse HTML: ${error}`);
  }

  return result;
}

/**
 * Merge duplicate products from different sources
 * Prioritizes JSON data for images, HTML data for better organization
 */
export function mergeDuplicateProducts(products: ParsedProduct[]): ParsedProduct[] {
  const productMap = new Map<string, ParsedProduct>();

  for (const product of products) {
    // Create a normalized key for duplicate detection
    const normalizedName = product.name.toLowerCase().trim().replace(/\s+/g, ' ');
    const key = `${normalizedName}-${product.brand?.toLowerCase() || ''}-${product.volume?.toLowerCase() || ''}`;

    if (productMap.has(key)) {
      // Merge with existing product
      const existing = productMap.get(key)!;
      
      // Merge logic: prefer non-null values
      const merged: ParsedProduct = {
        ...existing,
        // Prefer existing name if it exists, otherwise use new
        name: existing.name || product.name,
        // Merge descriptions
        description: existing.description || product.description,
        // Use lowest non-zero price
        price: existing.price > 0 ? Math.min(existing.price, product.price || existing.price) : product.price,
        // Prefer images from JSON (existing if it has images, otherwise new)
        imageUrl: existing.imageUrl || product.imageUrl,
        images: existing.images || product.images,
        // Prefer more specific category
        mainCategory: existing.mainCategory !== 'Other' ? existing.mainCategory : product.mainCategory,
        subCategory: existing.subCategory || product.subCategory,
        // Prefer existing brand/volume if present
        brand: existing.brand || product.brand,
        volume: existing.volume || product.volume,
        // Add stock quantities
        stockQuantity: existing.stockQuantity + product.stockQuantity,
        // Available if either is available
        isAvailable: existing.isAvailable || product.isAvailable,
        // Merge tags
        tags: { ...existing.tags, ...product.tags },
        // Merge variants (avoid duplicates by name)
        variants: mergeVariants(existing.variants, product.variants),
        // Merge bulk pricing
        bulkPricing: mergeBulkPricing(existing.bulkPricing, product.bulkPricing)
      };

      productMap.set(key, merged);
    } else {
      // New product
      productMap.set(key, product);
    }
  }

  return Array.from(productMap.values());
}

function mergeVariants(
  existing?: ParsedProduct['variants'],
  newVariants?: ParsedProduct['variants']
): ParsedProduct['variants'] | undefined {
  if (!existing && !newVariants) return undefined;
  if (!existing) return newVariants;
  if (!newVariants) return existing;

  const variantMap = new Map<string, typeof existing[0]>();
  
  // Add existing variants
  for (const variant of existing) {
    const key = `${variant.variantName.toLowerCase()}-${variant.variantType}`;
    variantMap.set(key, variant);
  }
  
  // Merge new variants
  for (const variant of newVariants) {
    const key = `${variant.variantName.toLowerCase()}-${variant.variantType}`;
    if (variantMap.has(key)) {
      const existingVariant = variantMap.get(key)!;
      variantMap.set(key, {
        ...existingVariant,
        price: Math.min(existingVariant.price, variant.price || existingVariant.price),
        stockQuantity: existingVariant.stockQuantity + variant.stockQuantity,
        imageUrl: existingVariant.imageUrl || variant.imageUrl
      });
    } else {
      variantMap.set(key, variant);
    }
  }

  return Array.from(variantMap.values());
}

function mergeBulkPricing(
  existing?: ParsedProduct['bulkPricing'],
  newPricing?: ParsedProduct['bulkPricing']
): ParsedProduct['bulkPricing'] | undefined {
  if (!existing && !newPricing) return undefined;
  if (!existing) return newPricing;
  if (!newPricing) return existing;

  const pricingMap = new Map<number, number>();
  
  // Add existing pricing
  for (const tier of existing) {
    pricingMap.set(tier.minQuantity, tier.price);
  }
  
  // Merge new pricing (prefer lower price for same quantity)
  for (const tier of newPricing) {
    if (pricingMap.has(tier.minQuantity)) {
      const existingPrice = pricingMap.get(tier.minQuantity)!;
      pricingMap.set(tier.minQuantity, Math.min(existingPrice, tier.price));
    } else {
      pricingMap.set(tier.minQuantity, tier.price);
    }
  }

  return Array.from(pricingMap.entries())
    .map(([minQuantity, price]) => ({ minQuantity, price }))
    .sort((a, b) => a.minQuantity - b.minQuantity);
}

/**
 * Normalize and validate parsed products
 */
export function normalizeProducts(products: ParsedProduct[]): ParsedProduct[] {
  return products.map(product => {
    // Ensure required fields
    if (!product.name || product.name === 'Unnamed Product') {
      product.name = `Product ${product.sourceId}`;
    }

    // Normalize main category
    const validCategories = [
      'Cartridges', 'Disposables', 'Concentrates', 'Edibles',
      'Flower', 'Pre Rolls', 'Accessories', 'Topicals', 'BYOB'
    ];

    if (!validCategories.includes(product.mainCategory)) {
      product.mainCategory = 'Other';
    }

    // Ensure positive price
    if (product.price < 0) {
      product.price = 0;
    }

    // Ensure non-negative stock
    if (product.stockQuantity < 0) {
      product.stockQuantity = 0;
    }

    return product;
  });
}