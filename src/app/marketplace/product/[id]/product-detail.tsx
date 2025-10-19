'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ShoppingCart, Package, Minus, Plus, CheckCircle2, AlertCircle, ChevronRight, TrendingDown, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { ProductReviews } from '@/components/marketplace/product-reviews';

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  mainCategory: string;
  brand: string | null;
  volume: string | null;
  stockQuantity: number;
  isAvailable: boolean;
  variantsCount?: number;
  totalVariantsStock?: number;
}

interface ProductImage {
  id: number;
  productId: number;
  imageUrl: string;
  isPrimary: boolean;
  displayOrder: number;
}

interface Variant {
  id: number;
  productId: number;
  variantName: string;
  variantType: string;
  stockQuantity: number;
  priceModifier: number;
  isAvailable: boolean;
  createdAt: string;
}

interface BulkPricingRule {
  id: number;
  productId: number;
  minQuantity: number;
  discountType: string;
  discountValue: number;
  finalPrice: number | null;
  createdAt: string;
}

interface MarkupCalculation {
  basePrice: number;
  finalPrice: number;
  appliedMarkups: {
    id: number;
    name: string;
    type: string;
    markupType: string;
    markupValue: number;
    priority: number;
    priceAfterMarkup: number;
  }[];
}

interface PricingTier {
  quantity: string; // e.g., "1+", "3+", "5+"
  minQuantity: number;
  pricePerUnit: number;
  totalPrice: number;
  savings: number;
  isActive: boolean;
}

interface ProductDetailProps {
  productId: string;
}

export default function ProductDetail({ productId }: ProductDetailProps) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, Variant>>({});
  const [bulkPricingRules, setBulkPricingRules] = useState<BulkPricingRule[]>([]);
  const [markupCalculation, setMarkupCalculation] = useState<MarkupCalculation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [selectedTierQuantity, setSelectedTierQuantity] = useState<number>(1);
  const { user } = useAuth();

  useEffect(() => {
    fetchProductData();
  }, [productId]);

  useEffect(() => {
    // Recalculate pricing tiers whenever markup or bulk pricing changes
    if (product) {
      calculatePricingTiers();
    }
  }, [product, markupCalculation, bulkPricingRules, selectedVariants]);

  const calculatePricingTiers = () => {
    if (!product) return;

    const basePrice = markupCalculation?.finalPrice || product.price;
    const variantModifiers = Object.values(selectedVariants).reduce(
      (sum, v) => sum + v.priceModifier, 
      0
    );
    const baseWithVariants = basePrice + variantModifiers;

    // Get all unique quantity breakpoints from bulk pricing rules
    const quantityBreakpoints = [1];
    bulkPricingRules.forEach(rule => {
      if (!quantityBreakpoints.includes(rule.minQuantity)) {
        quantityBreakpoints.push(rule.minQuantity);
      }
    });
    quantityBreakpoints.sort((a, b) => a - b);

    const tiers: PricingTier[] = quantityBreakpoints.map(minQty => {
      const { price: unitPrice } = calculateBulkPrice(baseWithVariants, minQty);
      
      return {
        quantity: `${minQty}+`,
        minQuantity: minQty,
        pricePerUnit: unitPrice,
        totalPrice: unitPrice * minQty,
        savings: (baseWithVariants - unitPrice) * minQty,
        isActive: quantity >= minQty
      };
    });

    setPricingTiers(tiers);
  };

  const fetchProductData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      // Fetch product details
      const productRes = await fetch(`/api/products?id=${productId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      
      if (productRes.ok) {
        const productData = await productRes.json();
        setProduct(productData);
        
        // Fetch markup calculation
        try {
          const markupRes = await fetch(
            `/api/admin/calculate-markup-price?productId=${productId}&categoryName=${productData.mainCategory}&basePrice=${productData.price}`
          );
          if (markupRes.ok) {
            const markupData = await markupRes.json();
            setMarkupCalculation(markupData);
          }
        } catch (error) {
          console.error('Failed to fetch markup calculation:', error);
        }
        
        // Fetch bulk pricing rules
        const bulkPricingRes = await fetch(`/api/admin/bulk-pricing?productId=${productId}`);
        if (bulkPricingRes.ok) {
          const bulkPricingData = await bulkPricingRes.json();
          setBulkPricingRules(bulkPricingData);
        }
        
        // Fetch product images
        const imagesRes = await fetch(`/api/admin/product-images?productId=${productId}`);
        if (imagesRes.ok) {
          const imagesData = await imagesRes.json();
          setProductImages(imagesData);
        }
        
        // Fetch variants if they exist
        if (productData.variantsCount && productData.variantsCount > 0) {
          const variantsRes = await fetch(`/api/products/${productId}/variants`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          });
          
          if (variantsRes.ok) {
            const variantsData = await variantsRes.json();
            setVariants(variantsData);
            
            // Auto-select first available variant for each type
            const variantsByType = groupVariantsByType(variantsData);
            const initialSelection: Record<string, Variant> = {};
            
            Object.entries(variantsByType).forEach(([type, typeVariants]) => {
              const firstAvailable = typeVariants.find(v => v.stockQuantity > 0);
              if (firstAvailable) {
                initialSelection[type] = firstAvailable;
              }
            });
            
            setSelectedVariants(initialSelection);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Failed to load product details');
    } finally {
      setIsLoading(false);
    }
  };

  const groupVariantsByType = (variants: Variant[]): Record<string, Variant[]> => {
    return variants.reduce((acc, variant) => {
      if (!acc[variant.variantType]) {
        acc[variant.variantType] = [];
      }
      acc[variant.variantType].push(variant);
      return acc;
    }, {} as Record<string, Variant[]>);
  };

  const getFilteredVariantsByType = (typeVariants: Variant[]): Variant[] => {
    const totalVariants = typeVariants.length;
    const outOfStockCount = typeVariants.filter(v => v.stockQuantity === 0).length;
    const outOfStockRatio = outOfStockCount / totalVariants;
    
    if (outOfStockRatio > 0.5) {
      return typeVariants.filter(v => v.stockQuantity > 0);
    }
    
    return typeVariants;
  };

  const handleVariantChange = (type: string, variantId: string) => {
    const variant = variants.find(v => v.id.toString() === variantId);
    if (variant) {
      setSelectedVariants(prev => ({
        ...prev,
        [type]: variant
      }));
    }
  };

  const handleTierChange = (tierQty: string) => {
    const minQty = parseInt(tierQty);
    setSelectedTierQuantity(minQty);
    setQuantity(minQty);
  };

  const getBasePrice = () => {
    if (!product) return 0;
    // Use markup-adjusted price as the base
    return markupCalculation?.finalPrice || product.price;
  };

  const getCurrentPrice = () => {
    const basePrice = getBasePrice();
    const variantModifiers = Object.values(selectedVariants).reduce(
      (sum, v) => sum + v.priceModifier, 
      0
    );
    return basePrice + variantModifiers;
  };

  const calculateBulkPrice = (basePrice: number, qty: number): { price: number; savings: number; appliedRule: BulkPricingRule | null } => {
    if (bulkPricingRules.length === 0) {
      return { price: basePrice, savings: 0, appliedRule: null };
    }

    // Find the highest applicable rule (highest minQuantity that's still <= qty)
    const applicableRules = bulkPricingRules
      .filter(rule => rule.minQuantity <= qty)
      .sort((a, b) => b.minQuantity - a.minQuantity);

    if (applicableRules.length === 0) {
      return { price: basePrice, savings: 0, appliedRule: null };
    }

    const rule = applicableRules[0];
    let discountedPrice = basePrice;

    if (rule.finalPrice !== null) {
      discountedPrice = rule.finalPrice;
    } else if (rule.discountType === 'percentage') {
      discountedPrice = basePrice * (1 - rule.discountValue / 100);
    } else if (rule.discountType === 'fixed_amount') {
      discountedPrice = Math.max(0, basePrice - rule.discountValue);
    }

    const savings = basePrice - discountedPrice;
    return { price: discountedPrice, savings, appliedRule: rule };
  };

  const getFinalPrice = () => {
    const basePrice = getCurrentPrice();
    const { price } = calculateBulkPrice(basePrice, quantity);
    return price;
  };

  const getTotalPrice = () => {
    return getFinalPrice() * quantity;
  };

  const getSavingsInfo = () => {
    const basePrice = getCurrentPrice();
    const { savings, appliedRule } = calculateBulkPrice(basePrice, quantity);
    return { savings, appliedRule };
  };

  const getNextTierInfo = () => {
    const higherRules = bulkPricingRules
      .filter(rule => rule.minQuantity > quantity)
      .sort((a, b) => a.minQuantity - b.minQuantity);

    if (higherRules.length === 0) return null;

    const nextRule = higherRules[0];
    const basePrice = getCurrentPrice();
    
    let nextTierPrice = basePrice;
    if (nextRule.finalPrice !== null) {
      nextTierPrice = nextRule.finalPrice;
    } else if (nextRule.discountType === 'percentage') {
      nextTierPrice = basePrice * (1 - nextRule.discountValue / 100);
    } else if (nextRule.discountType === 'fixed_amount') {
      nextTierPrice = Math.max(0, basePrice - nextRule.discountValue);
    }

    return {
      minQuantity: nextRule.minQuantity,
      pricePerUnit: nextTierPrice,
      totalSavings: (basePrice - nextTierPrice) * nextRule.minQuantity,
    };
  };

  const addToCart = async () => {
    if (!product) {
      toast.error('Product data not loaded');
      return;
    }
    
    // Check if all required variants are selected
    if (variants.length > 0) {
      const variantsByType = groupVariantsByType(variants);
      const missingVariants = Object.keys(variantsByType).filter(
        type => !selectedVariants[type]
      );
      
      if (missingVariants.length > 0) {
        toast.error(`Please select: ${missingVariants.join(', ')}`);
        return;
      }
    }
    
    setIsAddingToCart(true);
    
    try {
      // Get current cart
      const cartData = localStorage.getItem('cart');
      const cart = cartData ? JSON.parse(cartData) : {};
      
      // Create unique cart key
      const selectedVariantIds = Object.values(selectedVariants)
        .map(v => v.id)
        .sort()
        .join('-');
      const cartKey = selectedVariantIds 
        ? `${product.id}-variants-${selectedVariantIds}`
        : `${product.id}`;
      
      // Add to cart
      cart[cartKey] = (cart[cartKey] || 0) + quantity;
      localStorage.setItem('cart', JSON.stringify(cart));
      
      // Show success message with action button
      toast.success(
        <div className="flex flex-col gap-1">
          <p className="font-semibold">Added to cart! 🎉</p>
          <p className="text-sm text-muted-foreground">
            {quantity} × {product.name} (${getTotalPrice().toFixed(2)})
          </p>
        </div>,
        {
          duration: 4000,
          action: {
            label: 'View Cart',
            onClick: () => router.push('/marketplace/cart')
          }
        }
      );
      
      // Reset quantity to 1
      setQuantity(1);
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add to cart. Please try again.');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const getAvailableStock = () => {
    if (!product) return 0;
    
    if (variants.length === 0) {
      return product.stockQuantity;
    }
    
    // If variants exist, return stock of selected variants
    const selectedVariantsList = Object.values(selectedVariants);
    if (selectedVariantsList.length === 0) {
      // Don't return 0 - instead return total stock to keep button enabled
      return product.totalVariantsStock || 0;
    }
    
    // Return minimum stock among selected variants
    return Math.min(...selectedVariantsList.map(v => v.stockQuantity));
  };

  const getTotalStock = () => {
    if (!product) return 0;
    return product.stockQuantity + (product.totalVariantsStock || 0);
  };

  const allImages = [
    ...(product?.imageUrl ? [product.imageUrl] : []),
    ...productImages.map(img => img.imageUrl)
  ].filter((url, index, self) => self.indexOf(url) === index);

  const currentPrice = getCurrentPrice();
  const finalPrice = getFinalPrice();
  const totalPrice = getTotalPrice();
  const { savings, appliedRule } = getSavingsInfo();
  const nextTierInfo = getNextTierInfo();
  const availableStock = getAvailableStock();
  const totalStock = getTotalStock();
  const hasVariants = variants.length > 0;
  const variantsByType = groupVariantsByType(variants);

  // Thumbnail navigation
  const visibleThumbnails = 3;
  const canScrollLeft = thumbnailStartIndex > 0;
  const canScrollRight = thumbnailStartIndex + visibleThumbnails < allImages.length;

  const scrollThumbnails = (direction: 'left' | 'right') => {
    if (direction === 'left' && canScrollLeft) {
      setThumbnailStartIndex(prev => Math.max(0, prev - 1));
    } else if (direction === 'right' && canScrollRight) {
      setThumbnailStartIndex(prev => Math.min(allImages.length - visibleThumbnails, prev + 1));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Product not found</h2>
          <p className="text-muted-foreground">The product you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={() => router.push('/marketplace')}
        className="mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back to Marketplace
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Left: Product Images */}
        <div className="space-y-3">
          {/* Main Image - Smaller */}
          <div className="relative w-full aspect-square max-w-md mx-auto bg-muted rounded-lg overflow-hidden">
            {allImages.length > 0 ? (
              <img
                src={allImages[selectedImageIndex]}
                alt={product.name}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-24 w-24 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Thumbnail Slider - 3 boxes with arrows */}
          {allImages.length > 1 && (
            <div className="flex items-center gap-2 max-w-md mx-auto">
              <Button
                variant="outline"
                size="icon"
                onClick={() => scrollThumbnails('left')}
                disabled={!canScrollLeft}
                className="flex-shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex-1 grid grid-cols-3 gap-2">
                {allImages
                  .slice(thumbnailStartIndex, thumbnailStartIndex + visibleThumbnails)
                  .map((url, relativeIndex) => {
                    const absoluteIndex = thumbnailStartIndex + relativeIndex;
                    return (
                      <button
                        key={absoluteIndex}
                        onClick={() => setSelectedImageIndex(absoluteIndex)}
                        className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          selectedImageIndex === absoluteIndex
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <img
                          src={url}
                          alt={`${product.name} - ${absoluteIndex + 1}`}
                          className="object-cover w-full h-full"
                        />
                      </button>
                    );
                  })}
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={() => scrollThumbnails('right')}
                disabled={!canScrollRight}
                className="flex-shrink-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Right: Product Info */}
        <div className="space-y-6">
          {/* Header */}
          <div>
            {product.brand && (
              <p className="text-sm text-primary font-semibold mb-2 uppercase tracking-wide">{product.brand}</p>
            )}
            <h1 className="text-4xl font-bold mb-3">{product.name}</h1>
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <Badge variant="outline" className="text-sm">{product.mainCategory}</Badge>
              {product.volume && <Badge variant="secondary" className="text-sm">{product.volume}</Badge>}
            </div>
          </div>

          {/* Price with Markup & Bulk Pricing */}
          <div className="border-b pb-6">
            {/* Markup Notification */}
            {markupCalculation && markupCalculation.appliedMarkups.length > 0 && (
              <div className="mb-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-start gap-2 text-sm">
                  <Percent className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">Store Markup Applied</p>
                    {markupCalculation.appliedMarkups.map((markup, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground">
                        {markup.name}: {markup.markupType === 'percentage' 
                          ? `${markup.markupValue > 0 ? '+' : ''}${markup.markupValue}%`
                          : `${markup.markupValue > 0 ? '+' : ''}$${markup.markupValue.toFixed(2)}`
                        }
                      </p>
                    ))}
                    <p className="text-xs text-primary font-medium">
                      Base: ${product.price.toFixed(2)} → Final: ${markupCalculation.finalPrice.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* PRICING TIERS SELECTOR - NEW */}
            {pricingTiers.length > 1 && (
              <div className="mb-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  Volume Pricing - Select Quantity Tier
                </h4>
                
                <Select 
                  value={selectedTierQuantity.toString()} 
                  onValueChange={handleTierChange}
                >
                  <SelectTrigger className="h-12 border-2">
                    <SelectValue>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{selectedTierQuantity}+ Units</span>
                        <span className="text-primary font-bold">
                          ${pricingTiers.find(t => t.minQuantity === selectedTierQuantity)?.pricePerUnit.toFixed(2)}/unit
                        </span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {pricingTiers.map((tier) => (
                      <SelectItem 
                        key={tier.minQuantity} 
                        value={tier.minQuantity.toString()}
                        className="py-3"
                      >
                        <div className="flex items-center justify-between w-full gap-4">
                          <div className="flex flex-col">
                            <span className="font-semibold">{tier.quantity}</span>
                            {tier.savings > 0 && (
                              <span className="text-xs text-green-600">
                                Save ${tier.savings.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-primary">
                              ${tier.pricePerUnit.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              per unit
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Pricing Tiers Table */}
                <div className="mt-3 border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Quantity</th>
                        <th className="text-right p-2 font-medium">Price/Unit</th>
                        <th className="text-right p-2 font-medium">You Save</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricingTiers.map((tier) => (
                        <tr 
                          key={tier.minQuantity}
                          className={`border-t cursor-pointer hover:bg-muted/30 ${
                            tier.minQuantity === selectedTierQuantity ? 'bg-primary/5 font-medium' : ''
                          }`}
                          onClick={() => handleTierChange(tier.minQuantity.toString())}
                        >
                          <td className="p-2">{tier.quantity}</td>
                          <td className="text-right p-2 font-semibold text-primary">
                            ${tier.pricePerUnit.toFixed(2)}
                          </td>
                          <td className="text-right p-2 text-green-600">
                            {tier.savings > 0 ? `$${tier.savings.toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Current Price Display */}
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-5xl font-bold text-foreground">
                ${getFinalPrice().toFixed(2)}
              </span>
              {savings > 0 && (
                <span className="text-lg text-muted-foreground line-through">
                  ${getCurrentPrice().toFixed(2)}
                </span>
              )}
            </div>

            {/* Bulk Pricing Savings Badge */}
            {savings > 0 && appliedRule && (
              <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <TrendingDown className="h-5 w-5" />
                  <div>
                    <p className="font-semibold">Bulk Discount Applied!</p>
                    <p className="text-sm">Save ${savings.toFixed(2)} per unit (${(savings * quantity).toFixed(2)} total)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Bulk Pricing Tiers Table */}
            {bulkPricingRules.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">Volume Pricing</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Quantity</th>
                        <th className="text-right p-2 font-medium">Price/Unit</th>
                        <th className="text-right p-2 font-medium">You Save</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPricingRules
                        .sort((a, b) => a.minQuantity - b.minQuantity)
                        .map((rule) => {
                          let rulePrice = currentPrice;
                          if (rule.finalPrice !== null) {
                            rulePrice = rule.finalPrice;
                          } else if (rule.discountType === 'percentage') {
                            rulePrice = currentPrice * (1 - rule.discountValue / 100);
                          } else if (rule.discountType === 'fixed_amount') {
                            rulePrice = Math.max(0, currentPrice - rule.discountValue);
                          }
                          const ruleSavings = currentPrice - rulePrice;
                          const isActive = appliedRule?.id === rule.id;

                          return (
                            <tr 
                              key={rule.id} 
                              className={`border-t ${isActive ? 'bg-primary/5 font-medium' : ''}`}
                            >
                              <td className="p-2">{rule.minQuantity}+</td>
                              <td className="text-right p-2">${rulePrice.toFixed(2)}</td>
                              <td className="text-right p-2 text-green-600 dark:text-green-400">
                                ${ruleSavings.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Next Tier Incentive */}
            {nextTierInfo && (
              <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Buy {nextTierInfo.minQuantity}+ </span>
                  and save ${nextTierInfo.totalSavings.toFixed(2)} 
                  <span className="text-primary"> (${nextTierInfo.pricePerUnit.toFixed(2)}/unit)</span>
                </p>
              </div>
            )}
            
            {/* Variant Price Breakdown */}
            {hasVariants && Object.values(selectedVariants).some(v => v.priceModifier !== 0) && (
              <div className="mt-3 space-y-1 text-sm">
                {Object.entries(selectedVariants).map(([type, variant]) => 
                  variant.priceModifier !== 0 && (
                    <div key={type} className="flex items-center gap-2 text-muted-foreground">
                      <span className="capitalize">{type}: {variant.variantName}</span>
                      <span className={variant.priceModifier > 0 ? 'text-primary font-medium' : 'text-green-600 font-medium'}>
                        {variant.priceModifier > 0 ? '+' : ''}${variant.priceModifier.toFixed(2)}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Description with HTML rendering */}
          {product.description && (
            <div className="border-b pb-6">
              <div 
                className="text-muted-foreground leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}

          {/* Stock Status */}
          <div className="flex items-center justify-between border-b pb-6">
            <div className="flex items-center gap-2">
              {availableStock > 0 ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-600">In Stock</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span className="font-medium text-destructive">Out of Stock</span>
                </>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Available</p>
              <p className="text-2xl font-bold">{totalStock}</p>
            </div>
          </div>

          {/* Variant Selection */}
          {hasVariants && (
            <div className="space-y-4 border-b pb-6">
              <h3 className="font-semibold text-lg">Select Options</h3>
              {Object.entries(variantsByType).map(([type, typeVariants]) => {
                const selectedVariant = selectedVariants[type];
                const filteredVariants = getFilteredVariantsByType(typeVariants);
                const outOfStockCount = typeVariants.filter(v => v.stockQuantity === 0).length;
                const showingAllVariants = filteredVariants.length === typeVariants.length;
                
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium capitalize">{type}</label>
                      {selectedVariant && (
                        <span className="text-sm text-muted-foreground">
                          {selectedVariant.stockQuantity} in stock
                        </span>
                      )}
                    </div>
                    <Select
                      value={selectedVariant?.id.toString()}
                      onValueChange={(value) => handleVariantChange(type, value)}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder={`Select ${type}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredVariants.map((variant) => (
                          <SelectItem 
                            key={variant.id} 
                            value={variant.id.toString()}
                            disabled={variant.stockQuantity === 0}
                          >
                            <div className="flex items-center justify-between w-full gap-4">
                              <span>{variant.variantName}</span>
                              <div className="flex items-center gap-2 text-xs">
                                <span className={variant.stockQuantity === 0 ? 'text-destructive' : 'text-muted-foreground'}>
                                  {variant.stockQuantity > 0 
                                    ? `${variant.stockQuantity} available` 
                                    : showingAllVariants ? 'Unavailable' : ''
                                  }
                                </span>
                                {variant.priceModifier !== 0 && (
                                  <span className={variant.priceModifier > 0 ? 'text-primary' : 'text-green-600'}>
                                    ({variant.priceModifier > 0 ? '+' : ''}${variant.priceModifier.toFixed(2)})
                                  </span>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!showingAllVariants && outOfStockCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {outOfStockCount} {type}{outOfStockCount > 1 ? 's' : ''} currently unavailable
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Quantity & Add to Cart */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Quantity:</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1 || isAddingToCart}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-20 text-center font-medium text-xl">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                  disabled={quantity >= availableStock || isAddingToCart}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button
              onClick={addToCart}
              disabled={availableStock === 0 || isAddingToCart}
              className="w-full h-14 text-lg"
              size="lg"
            >
              {isAddingToCart ? (
                <>
                  <Package className="h-5 w-5 mr-2 animate-spin" />
                  Adding to Cart...
                </>
              ) : availableStock === 0 ? (
                'Out of Stock'
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Add to Cart - ${totalPrice.toFixed(2)}
                  {savings > 0 && (
                    <span className="ml-2 text-sm opacity-90">
                      (Save ${(savings * quantity).toFixed(2)})
                    </span>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="mt-16">
        <h2 className="text-3xl font-bold mb-8">Customer Reviews</h2>
        <ProductReviews productId={parseInt(productId)} />
      </div>
    </div>
  );
}