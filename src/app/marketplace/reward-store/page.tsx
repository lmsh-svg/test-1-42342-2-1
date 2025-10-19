'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Gift, Package, Search, ShoppingCart, Sparkles, Award, ChevronLeft } from 'lucide-react';
import Navbar from '@/components/marketplace/navbar';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  mainCategory: string;
  brand: string | null;
  stockQuantity: number;
  variantsCount: number;
  totalVariantsStock: number;
}

export default function RewardStorePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cashbackBalance, setCashbackBalance] = useState(0);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch user profile to get cashback balance
      const profileRes = await fetch(`/api/user/profile?userId=${user?.id}`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setUserProfile(profileData);
        setCashbackBalance(profileData.cashbackBalance || 0);
      }

      // Fetch products
      const productsRes = await fetch('/api/products?limit=10000&inStock=true');
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load reward store');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductClick = (productId: number) => {
    router.push(`/marketplace/product/${productId}`);
  };

  const filteredProducts = products
    .filter(product => {
      const matchesSearch = searchQuery === '' || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSearch;
    })
    .sort((a, b) => a.price - b.price); // Sort by price ascending

  const getTotalStock = (product: Product) => {
    return product.stockQuantity + product.totalVariantsStock;
  };

  const canAfford = (price: number) => {
    return cashbackBalance >= price;
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Gift className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading reward store...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            onClick={() => router.push('/marketplace/browse')}
            className="mb-6"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>

          {/* Hero Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl">
                <Gift className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-foreground">Reward Store</h1>
                <p className="text-muted-foreground mt-1">
                  Redeem your cashback rewards for premium products
                </p>
              </div>
            </div>

            {/* Cashback Balance Card */}
            <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500/20 rounded-full">
                      <Award className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Your Reward Balance</p>
                      <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">
                        ${cashbackBalance.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => router.push('/marketplace/rewards')}
                    className="gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    View Rewards Program
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reward products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card/50 border-border/50 backdrop-blur"
              />
            </div>
          </div>

          {/* Products Grid */}
          {filteredProducts.length === 0 ? (
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Gift className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No products available</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  {searchQuery ? 'Try adjusting your search' : 'Check back later for new reward products'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {filteredProducts.map((product) => {
                const totalStock = getTotalStock(product);
                const affordable = canAfford(product.price);
                
                return (
                  <Card 
                    key={product.id}
                    className={`group overflow-hidden border-border/50 bg-card/50 backdrop-blur hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 cursor-pointer ${
                      !affordable ? 'opacity-60' : ''
                    }`}
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

                      {!affordable && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                          <Badge variant="secondary" className="text-xs">
                            Insufficient Balance
                          </Badge>
                        </div>
                      )}

                      {affordable && (
                        <Badge className="absolute top-1.5 left-1.5 text-xs bg-amber-500/90 text-white backdrop-blur-sm">
                          <Gift className="h-3 w-3 mr-1" />
                          Affordable
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
                        <div className="flex items-center gap-1">
                          <Gift className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                            ${product.price.toFixed(2)}
                          </span>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProductClick(product.id);
                          }}
                          disabled={!affordable}
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
          )}
        </div>
      </div>
    </>
  );
}