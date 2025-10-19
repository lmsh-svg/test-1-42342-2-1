'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ShoppingCart, Package, Minus, Plus, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
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

interface ProductDetailProps {
  productId: string;
}

export default function ProductDetail({ productId }: ProductDetailProps) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, Variant>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchProductData();
  }, [productId]);

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
            {quantity} × {product.name} (${(currentPrice * quantity).toFixed(2)})
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

  const getCurrentPrice = () => {
    if (!product) return 0;
    const variantModifiers = Object.values(selectedVariants).reduce(
      (sum, v) => sum + v.priceModifier, 
      0
    );
    return product.price + variantModifiers;
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

          {/* Price */}
          <div className="border-b pb-6">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-5xl font-bold text-foreground">
                ${currentPrice.toFixed(2)}
              </span>
              {hasVariants && Object.values(selectedVariants).some(v => v.priceModifier !== 0) && (
                <span className="text-lg text-muted-foreground line-through">
                  ${product.price.toFixed(2)}
                </span>
              )}
            </div>
            
            {/* Price Breakdown */}
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
                  Add to Cart - ${(currentPrice * quantity).toFixed(2)}
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