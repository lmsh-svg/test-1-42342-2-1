'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Search, ShoppingCart, Filter, Package, SlidersHorizontal, Globe, MapPin, ChevronDown, Gift, TrendingDown, Percent } from 'lucide-react';
import FiltersPanel from '@/components/marketplace/filters-panel';
import Navbar from '@/components/marketplace/navbar';
import { ShippingWidget } from '@/components/marketplace/shipping-widget';
import { useAuth } from '@/hooks/use-auth';

const MAIN_CATEGORIES = [
  'Cartridges',
  'Disposables', 
  'Concentrates',
  'Edibles',
  'Flower',
  'Pre Rolls',
  'Accessories',
  'Topicals',
  'BYOB'
];

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
  variantsCount: number;
  totalVariantsStock: number;
}

interface BulkPricingRule {
  id: number;
  productId: number;
  minQuantity: number;
  discountType: string;
  discountValue: number;
  finalPrice: number | null;
}

interface MarkupPrice {
  basePrice: number;
  finalPrice: number;
  hasMarkup: boolean;
}

export default function BrowsePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [bulkPricing, setBulkPricing] = useState<Record<number, BulkPricingRule[]>>({});
  const [markupPrices, setMarkupPrices] = useState<Record<number, MarkupPrice>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedVolumes, setSelectedVolumes] = useState<string[]>([]);
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [showLocalOnly, setShowLocalOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  const userHasLocalAccess = user?.role === 'admin';

  useEffect(() => {
    // Read brand from URL params on mount
    const brandFromUrl = searchParams.get('brand');
    if (brandFromUrl && !selectedBrands.includes(brandFromUrl)) {
      setSelectedBrands([brandFromUrl]);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, selectedBrands, selectedVolumes, showOutOfStock, showLocalOnly]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '10000');
      
      if (selectedCategory !== 'all') {
        params.append('mainCategory', selectedCategory);
      }
      
      selectedBrands.forEach(brand => {
        params.append('brand', brand);
      });
      
      selectedVolumes.forEach(volume => {
        params.append('volume', volume);
      });
      
      if (!showOutOfStock) {
        params.append('inStock', 'true');
      }
      
      if (showLocalOnly) {
        params.append('localOnly', 'true');
      }
      
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {};
      
      if (showLocalOnly && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/products?${params.toString()}`, { headers });
      const data = await response.json();
      
      if (response.ok) {
        setProducts(data);
        // Fetch bulk pricing for all products
        fetchBulkPricing(data.map((p: Product) => p.id));
        // Fetch markup prices for all products
        fetchMarkupPrices(data);
      } else {
        console.error('Failed to fetch products:', data);
        setProducts([]);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMarkupPrices = async (products: Product[]) => {
    try {
      const markupData: Record<number, MarkupPrice> = {};
      
      await Promise.all(
        products.map(async (product) => {
          try {
            const response = await fetch(
              `/api/admin/calculate-markup-price?productId=${product.id}&categoryName=${product.mainCategory}&basePrice=${product.price}`
            );
            if (response.ok) {
              const data = await response.json();
              markupData[product.id] = {
                basePrice: data.basePrice,
                finalPrice: data.finalPrice,
                hasMarkup: data.appliedMarkups && data.appliedMarkups.length > 0
              };
            }
          } catch (error) {
            console.error(`Failed to fetch markup for product ${product.id}:`, error);
          }
        })
      );
      
      setMarkupPrices(markupData);
    } catch (error) {
      console.error('Failed to fetch markup prices:', error);
    }
  };

  const fetchBulkPricing = async (productIds: number[]) => {
    try {
      const bulkPricingData: Record<number, BulkPricingRule[]> = {};
      
      await Promise.all(
        productIds.map(async (productId) => {
          try {
            const response = await fetch(`/api/admin/bulk-pricing?productId=${productId}`);
            if (response.ok) {
              const rules = await response.json();
              if (rules.length > 0) {
                bulkPricingData[productId] = rules;
              }
            }
          } catch (error) {
            console.error(`Failed to fetch bulk pricing for product ${productId}:`, error);
          }
        })
      );
      
      setBulkPricing(bulkPricingData);
    } catch (error) {
      console.error('Failed to fetch bulk pricing:', error);
    }
  };

  const getDisplayPrice = (product: Product): number => {
    // Use markup-adjusted price if available, otherwise use base price
    const markupPrice = markupPrices[product.id];
    return markupPrice?.finalPrice || product.price;
  };

  const getLowestBulkPrice = (productId: number, basePrice: number) => {
    const rules = bulkPricing[productId];
    if (!rules || rules.length === 0) return null;
    
    // Use markup-adjusted price as the base for bulk calculations
    const displayPrice = getDisplayPrice(products.find(p => p.id === productId)!);
    
    const lowestRule = rules.reduce((lowest, rule) => {
      const rulePrice = rule.finalPrice || displayPrice - (rule.discountType === 'percentage' 
        ? (displayPrice * rule.discountValue / 100)
        : rule.discountValue);
      
      const lowestPrice = lowest.finalPrice || displayPrice - (lowest.discountType === 'percentage'
        ? (displayPrice * lowest.discountValue / 100)
        : lowest.discountValue);
      
      return rulePrice < lowestPrice ? rule : lowest;
    }, rules[0]);
    
    return lowestRule.finalPrice || displayPrice - (lowestRule.discountType === 'percentage'
      ? (displayPrice * lowestRule.discountValue / 100)
      : lowestRule.discountValue);
  };

  const filteredProducts = products
    .filter(product => {
      const matchesSearch = searchQuery === '' || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return b.id - a.id;
      }
    });

  const handleProductClick = (productId: number) => {
    router.push(`/marketplace/product/${productId}`);
  };

  const getTotalStock = (product: Product) => {
    return product.stockQuantity + product.totalVariantsStock;
  };

  const activeFiltersCount = selectedBrands.length + selectedVolumes.length + (showOutOfStock ? 1 : 0);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pb-20 lg:pb-8">
        <div className="border-b border-border/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <ShippingWidget />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Browse Products</h1>
              <p className="text-muted-foreground mt-1">
                {showLocalOnly ? 'Browse local pickup products' : 'Explore our full catalog'}
              </p>
            </div>
            
            {userHasLocalAccess && (
              <div className="flex items-center gap-3 bg-card/50 backdrop-blur border border-border/50 rounded-lg p-1">
                <Button
                  variant={!showLocalOnly ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setShowLocalOnly(false)}
                  className="gap-2"
                >
                  <Globe className="h-4 w-4" />
                  <span className="hidden sm:inline">Online</span>
                </Button>
                <Button
                  variant={showLocalOnly ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setShowLocalOnly(true)}
                  className="gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  <span className="hidden sm:inline">Local</span>
                </Button>
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card/50 border-border/50 backdrop-blur"
              />
            </div>
          </div>

          <div className="mb-6 hidden lg:block">
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="w-full justify-start overflow-x-auto bg-card/50 border border-border/50 backdrop-blur p-1">
                <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  All Products
                </TabsTrigger>
                {MAIN_CATEGORIES.map(category => (
                  <TabsTrigger 
                    key={category} 
                    value={category}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap"
                  >
                    {category}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-card/50 border-border/50 backdrop-blur">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline">Filters</span>
                    {activeFiltersCount > 0 && (
                      <Badge variant="secondary" className="ml-1">{activeFiltersCount}</Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[400px] sm:w-[500px]">
                  <FiltersPanel
                    selectedBrands={selectedBrands}
                    onBrandsChange={setSelectedBrands}
                    selectedVolumes={selectedVolumes}
                    onVolumesChange={setSelectedVolumes}
                    showOutOfStock={showOutOfStock}
                    onShowOutOfStockChange={setShowOutOfStock}
                    showLocalOnly={false}
                    onShowLocalOnlyChange={() => {}}
                    userHasLocalAccess={false}
                  />
                </SheetContent>
              </Sheet>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-10 px-3 rounded-md border border-border/50 bg-card/50 text-sm backdrop-blur focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="newest">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Name: A to Z</option>
              </select>
            </div>

            <div className="text-sm text-muted-foreground hidden sm:block">
              Showing {filteredProducts.length} products
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-muted-foreground">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No products found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  {searchQuery ? 'Try adjusting your search or filters' : 'No products available in this category'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {filteredProducts.map((product) => {
                const totalStock = getTotalStock(product);
                const isLowStock = totalStock < 10 && totalStock > 0;
                const displayPrice = getDisplayPrice(product);
                const lowestBulkPrice = getLowestBulkPrice(product.id, displayPrice);
                const hasBulkPricing = bulkPricing[product.id] && bulkPricing[product.id].length > 0;
                const hasMarkup = markupPrices[product.id]?.hasMarkup;
                
                return (
                  <Card 
                    key={product.id}
                    className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 cursor-pointer"
                    onClick={() => handleProductClick(product.id)}
                  >
                    <div className="relative aspect-square bg-muted/50">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      )}
                      
                      {totalStock > 0 && (
                        <Badge 
                          className={`absolute top-1.5 right-1.5 text-xs ${isLowStock ? 'bg-destructive/90' : 'bg-secondary/90'} backdrop-blur-sm`}
                        >
                          {totalStock}
                        </Badge>
                      )}
                      
                      {product.variantsCount > 0 && (
                        <Badge className="absolute top-1.5 left-1.5 text-xs bg-primary/90 backdrop-blur-sm">
                          {product.variantsCount}
                        </Badge>
                      )}
                      
                      <div className="absolute bottom-1.5 left-1.5 flex gap-1">
                        {hasBulkPricing && (
                          <Badge className="text-xs bg-green-500/90 backdrop-blur-sm flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" />
                            Bulk
                          </Badge>
                        )}
                        
                        {hasMarkup && (
                          <Badge className="text-xs bg-purple-500/90 backdrop-blur-sm flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                          </Badge>
                        )}
                      </div>
                      
                      {totalStock === 0 && (
                        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                          <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-3 space-y-1.5">
                      {product.brand && (
                        <p className="text-xs text-primary font-medium truncate">{product.brand}</p>
                      )}
                      
                      <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors min-h-[2.5rem]">
                        {product.name}
                      </h3>
                      
                      {product.volume && (
                        <p className="text-xs text-muted-foreground truncate">{product.volume}</p>
                      )}
                      
                      <div className="flex items-center justify-between pt-1.5">
                        <div className="flex flex-col">
                          {hasMarkup && displayPrice !== product.price && (
                            <span className="text-xs text-muted-foreground line-through">
                              ${product.price.toFixed(2)}
                            </span>
                          )}
                          {lowestBulkPrice && lowestBulkPrice < displayPrice ? (
                            <>
                              {!hasMarkup && (
                                <span className="text-xs text-muted-foreground line-through">
                                  ${displayPrice.toFixed(2)}
                                </span>
                              )}
                              <span className="text-lg font-bold text-green-600">
                                From ${lowestBulkPrice.toFixed(2)}
                              </span>
                            </>
                          ) : (
                            <span className={`text-lg font-bold ${hasMarkup ? 'text-primary' : 'text-foreground'}`}>
                              ${displayPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProductClick(product.id);
                          }}
                          disabled={totalStock === 0}
                          className="h-7 px-2 text-xs"
                        >
                          {product.variantsCount > 0 ? (
                            <Filter className="h-3 w-3" />
                          ) : (
                            <ShoppingCart className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-border/50 bg-card/95 backdrop-blur-xl">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1 px-2 py-2 min-w-max">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                All
              </button>
              {MAIN_CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    selectedCategory === category
                      ? 'bg-primary text-primary-foreground shadow-lg'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {category}
                </button>
              ))}
              <button
                onClick={() => router.push('/marketplace/reward-store')}
                className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 hover:from-amber-500/30 hover:to-orange-500/30 transition-all flex items-center gap-1.5 border border-amber-500/30"
              >
                <Gift className="h-3.5 w-3.5" />
                <span>Reward Store</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}