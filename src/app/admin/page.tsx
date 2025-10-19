'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { AdminTabs } from '@/components/admin/admin-tabs';
import { Loader2, Wallet, Users, Package, Coins, TicketCheck, Store, Settings, Database, DollarSign, ShoppingCart, Clock, TrendingUp, AlertTriangle, Activity, Eye, Archive, CheckCircle, CreditCard, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AdminStats {
  totalRevenue: number;
  completedOrders: number;
  totalUsers: number;
  pendingOrders: number;
  totalOrders: number;
  totalProducts?: number;
  inStockProducts?: number;
  outOfStockProducts?: number;
  lowStockProducts?: number;
}

interface RecentOrder {
  id: number;
  userId: number;
  status: string;
  totalAmount: number;
  createdAt: string;
}

interface LowStockProduct {
  id: number;
  name: string;
  stockQuantity: number;
  totalVariantsStock: number;
  price: number;
}

export default function AdminDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);

  useEffect(() => {
    if (!isLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/marketplace');
      } else {
        fetchAllData();
      }
    }
  }, [user, isLoading, router]);

  const fetchAllData = async () => {
    try {
      setIsLoadingStats(true);
      
      // Fetch stats
      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch recent orders (only 3 for minimal display)
      const ordersRes = await fetch('/api/orders?limit=3');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setRecentOrders(ordersData);
      }

      // Fetch all products to calculate statistics
      const productsRes = await fetch('/api/products?limit=10000');
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        
        // Calculate product statistics
        const totalProducts = productsData.length;
        const inStock = productsData.filter((p: any) => {
          const totalStock = p.stockQuantity + (p.totalVariantsStock || 0);
          return totalStock > 0;
        }).length;
        const outOfStock = totalProducts - inStock;
        
        // Find low stock products (stock between 1-10)
        const lowStock = productsData
          .filter((p: any) => {
            const totalStock = p.stockQuantity + (p.totalVariantsStock || 0);
            return totalStock > 0 && totalStock <= 10;
          })
          .sort((a: any, b: any) => {
            const stockA = a.stockQuantity + (a.totalVariantsStock || 0);
            const stockB = b.stockQuantity + (b.totalVariantsStock || 0);
            return stockA - stockB;
          })
          .slice(0, 3); // Only show 3 items
        
        setLowStockProducts(lowStock);
        
        // Update stats with product counts
        setStats(prev => prev ? {
          ...prev,
          totalProducts,
          inStockProducts: inStock,
          outOfStockProducts: outOfStock,
          lowStockProducts: lowStock.length
        } : null);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
      processing: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
      shipped: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
      delivered: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
      completed: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
      cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') return null;

  const adminSections = [
    { title: 'Marketplace', icon: Store, href: '/marketplace', color: 'text-cyan-500' },
    { title: 'Products', icon: Database, href: '/admin/products', color: 'text-yellow-500' },
    { title: 'Orders', icon: Package, href: '/admin/orders', color: 'text-purple-500' },
    { title: 'Users', icon: Users, href: '/admin/users', color: 'text-blue-500' },
    { title: 'Deposits', icon: Coins, href: '/admin/deposits', color: 'text-green-500' },
    { title: 'Manual Credit', icon: CreditCard, href: '/admin/manual-credit', color: 'text-indigo-500' },
    { title: 'Crypto Addresses', icon: Wallet, href: '/admin/crypto-addresses', color: 'text-orange-500' },
    { title: 'Verifications', icon: CheckCircle, href: '/admin/verifications', color: 'text-emerald-500' },
    { title: 'Support Tickets', icon: TicketCheck, href: '/admin/tickets', color: 'text-pink-500' },
    { title: 'Markups', icon: Percent, href: '/admin/markups', color: 'text-teal-500' },
    { title: 'API Management', icon: Settings, href: '/admin/api-management', color: 'text-gray-500' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AdminTabs />
      <div className="p-6">
        <div className="container mx-auto max-w-7xl">
          <div className="border-b border-border pb-4 mb-6">
            <h1 className="text-2xl font-bold">Admin Control Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">System maintenance, monitoring, and management</p>
          </div>

          {/* Enhanced Stats Overview */}
          {isLoadingStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="h-4 bg-muted rounded w-24"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-muted rounded w-32"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : stats ? (
            <>
              {/* Primary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <Card className="border-green-500/20 bg-green-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      Total Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ${stats.totalRevenue.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.completedOrders} completed orders
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20 bg-purple-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-purple-500" />
                      Total Orders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {stats.totalOrders}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.pendingOrders} pending
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-blue-500/20 bg-blue-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      Total Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {stats.totalUsers}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Registered accounts
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-yellow-500/20 bg-yellow-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4 text-yellow-500" />
                      Total Products
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {stats.totalProducts || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Listed on marketplace
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Product Inventory Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="border-emerald-500/20 bg-emerald-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      In Stock
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {stats.inStockProducts || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Available for purchase
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-orange-500/20 bg-orange-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Low Stock
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {stats.lowStockProducts || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      10 or fewer items
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-red-500/20 bg-red-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Archive className="h-4 w-4 text-red-500" />
                      Out of Stock
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {stats.outOfStockProducts || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Need restocking
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}

          {/* Compact Activity Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Recent Orders - Compact */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Recent Orders
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => router.push('/admin/orders')} className="h-8 text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentOrders.length > 0 ? (
                    recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-2 border border-border rounded-md hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-medium text-sm">#{order.id}</span>
                          <Badge className={`${getStatusColor(order.status)} text-xs py-0 h-5`}>{order.status}</Badge>
                        </div>
                        <div className="text-right ml-2">
                          <p className="font-bold text-sm">${order.totalAmount.toFixed(2)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-3">No recent orders</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Low Stock Alerts - Compact (2-3 items) */}
            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Low Stock Alert
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => router.push('/admin/products')} className="h-8 text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lowStockProducts.length > 0 ? (
                    lowStockProducts.map((product) => {
                      const totalStock = product.stockQuantity + (product.totalVariantsStock || 0);
                      return (
                        <div key={product.id} className="flex items-center justify-between p-2 border border-border rounded-md hover:bg-muted/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-1">{product.name}</p>
                            <p className="text-xs text-muted-foreground">${product.price.toFixed(2)}</p>
                          </div>
                          <Badge variant="outline" className="bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20 ml-2 text-xs py-0 h-5 shrink-0">
                            {totalStock} left
                          </Badge>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-3">No low stock items</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {adminSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.href}
                      onClick={() => router.push(section.href)}
                      className="flex flex-col items-center gap-2 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors text-center"
                    >
                      <Icon className={`h-6 w-6 ${section.color}`} />
                      <span className="text-sm font-medium">{section.title}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}