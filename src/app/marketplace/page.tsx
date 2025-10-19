'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Package, TrendingUp, Sparkles, Award, ChevronRight, ShoppingCart } from 'lucide-react';
import Navbar from '@/components/marketplace/navbar';
import { ShippingWidget } from '@/components/marketplace/shipping-widget';
import CryptoPriceWidget from '@/components/marketplace/crypto-price-widget';
import { useAuth } from '@/hooks/use-auth';
import { useInactivityLogout } from '@/hooks/use-inactivity-logout';
import { InactivityWarning } from '@/components/auth/inactivity-warning';

interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  brand: string | null;
  stockQuantity: number;
  variantsCount: number;
  totalVariantsStock: number;
}

interface RewardData {
  currentTier: string;
  cashbackRate: number;
  totalSpent: number;
  nextTier: string | null;
  amountUntilNextTier: number;
}

const TIER_CONFIG: Record<string, { name: string; icon: string; color: string }> = {
  bronze: { name: 'Bronze', icon: '🥉', color: 'text-amber-600' },
  silver: { name: 'Silver', icon: '🥈', color: 'text-slate-400' },
  gold: { name: 'Gold', icon: '🥇', color: 'text-yellow-500' },
  platinum: { name: 'Platinum', icon: '💎', color: 'text-purple-400' },
};

export default function MarketplacePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [featuredBrands, setFeaturedBrands] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rewardData, setRewardData] = useState<RewardData | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  const { showWarning, secondsRemaining, dismissWarning } = useInactivityLogout(!!user);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch products
      const response = await fetch('/api/products?limit=100&inStock=true');
      const products = await response.json();
      
      if (response.ok) {
        setFeaturedProducts(products.slice(0, 6));
        setTrendingProducts(products.slice(6, 14));
        
        const brands = Array.from(new Set(products.map((p: Product) => p.brand).filter(Boolean)));
        setFeaturedBrands(brands.slice(0, 8) as string[]);
      }
      
      // Fetch user data
      if (user) {
        const [rewardRes, profileRes] = await Promise.all([
          fetch(`/api/user/rewards?userId=${user.id}`),
          fetch(`/api/user/profile?userId=${user.id}`)
        ]);
        
        if (rewardRes.ok) {
          setRewardData(await rewardRes.json());
        }
        
        if (profileRes.ok) {
          setUserProfile(await profileRes.json());
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductClick = (productId: number) => {
    router.push(`/marketplace/product/${productId}`);
  };

  const getTotalStock = (product: Product) => {
    return product.stockQuantity + product.totalVariantsStock;
  };

  const calculateRewardProgress = () => {
    if (!rewardData || !rewardData.nextTier) return 100;
    
    const tierThresholds: Record<string, number> = {
      bronze: 0,
      silver: 1000,
      gold: 5000,
      platinum: 10000
    };
    
    const currentMin = tierThresholds[rewardData.currentTier];
    const nextMin = tierThresholds[rewardData.nextTier];
    const range = nextMin - currentMin;
    const progress = rewardData.totalSpent - currentMin;
    
    return Math.min(100, (progress / range) * 100);
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
          <div className="text-center">
            <Package className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="border-b border-border/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <ShippingWidget />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="mb-12 text-center">
            {userProfile?.storeName && (
              <div className="flex items-center justify-center gap-3 mb-4">
                {userProfile?.storeLogo && (
                  <img src={userProfile.storeLogo} alt="Store logo" className="h-12 w-12 object-contain" />
                )}
                <h1 className="text-5xl font-bold text-foreground">
                  {userProfile.storeName}
                </h1>
              </div>
            )}
            {!userProfile?.storeName && (
              <div className="flex items-center justify-center gap-3 mb-4">
                <Sparkles className="h-12 w-12 text-primary" />
                <h1 className="text-5xl font-bold text-foreground">
                  Welcome to the Marketplace
                </h1>
              </div>
            )}
            <p className="text-xl text-muted-foreground mb-8">
              Discover premium products with fast, reliable shipping
            </p>
            <Button 
              size="lg" 
              onClick={() => router.push('/marketplace/browse')}
              className="gap-2"
            >
              Browse All Products
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Featured Products Section */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold flex items-center gap-2">
                <TrendingUp className="h-8 w-8 text-primary" />
                Featured Products
              </h2>
              <Button variant="ghost" onClick={() => router.push('/marketplace/browse')} className="gap-2">
                View All
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {featuredProducts.map((product) => {
                const totalStock = getTotalStock(product);
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
                        <Badge className="absolute top-1.5 right-1.5 text-xs bg-secondary/90 backdrop-blur-sm">
                          {totalStock}
                        </Badge>
                      )}
                    </div>

                    <CardContent className="p-3 space-y-1.5">
                      {product.brand && (
                        <p className="text-xs text-primary font-medium truncate">{product.brand}</p>
                      )}
                      <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors min-h-[2.5rem]">
                        {product.name}
                      </h3>
                      <div className="flex items-center justify-between pt-1.5">
                        <span className="text-lg font-bold text-foreground">
                          ${product.price.toFixed(2)}
                        </span>
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProductClick(product.id);
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          <ShoppingCart className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Trending Products Section */}
          {trendingProducts.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold flex items-center gap-2">
                  <Sparkles className="h-8 w-8 text-primary" />
                  Trending Now
                </h2>
                <Button variant="ghost" onClick={() => router.push('/marketplace/browse')} className="gap-2">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                {trendingProducts.map((product) => {
                  const totalStock = getTotalStock(product);
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
                      </div>

                      <CardContent className="p-3 space-y-1.5">
                        <h3 className="font-semibold text-xs text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                          {product.name}
                        </h3>
                        <span className="text-sm font-bold text-foreground">
                          ${product.price.toFixed(2)}
                        </span>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Featured Brands Section */}
          {featuredBrands.length > 0 && (
            <div className="mb-12">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <Award className="h-8 w-8 text-primary" />
                Featured Brands
              </h2>
              <div className="flex flex-wrap gap-3">
                {featuredBrands.map((brand, index) => (
                  <Badge 
                    key={index}
                    variant="outline" 
                    className="px-6 py-3 text-base cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => router.push('/marketplace/browse')}
                  >
                    {brand}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Rewards Progress Section */}
          {rewardData && (
            <Card className="border-border/50 bg-gradient-to-br from-card/50 to-primary/5 backdrop-blur">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4 lg:mb-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="text-3xl sm:text-4xl lg:text-5xl">
                      {TIER_CONFIG[rewardData.currentTier]?.icon || '🥉'}
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold">
                        {TIER_CONFIG[rewardData.currentTier]?.name || 'Bronze'} Member
                      </h3>
                      <p className="text-sm sm:text-base text-muted-foreground">
                        Earning {rewardData.cashbackRate}% cashback on all purchases
                      </p>
                    </div>
                  </div>
                  <Button 
                    size="lg"
                    variant="outline" 
                    onClick={() => router.push('/marketplace/rewards')}
                    className="gap-2 w-full sm:w-auto"
                  >
                    <Award className="h-5 w-5" />
                    View Rewards
                  </Button>
                </div>
                
                {rewardData.nextTier && (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <span className="text-sm sm:text-base text-muted-foreground">
                        Progress to {TIER_CONFIG[rewardData.nextTier]?.name}
                      </span>
                      <span className="font-bold text-base sm:text-lg">
                        ${rewardData.amountUntilNextTier.toFixed(2)} to go
                      </span>
                    </div>
                    <Progress value={calculateRewardProgress()} className="h-2 sm:h-3" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <InactivityWarning
          open={showWarning}
          secondsRemaining={secondsRemaining}
          onDismiss={dismissWarning}
        />
      </div>
    </>
  );
}