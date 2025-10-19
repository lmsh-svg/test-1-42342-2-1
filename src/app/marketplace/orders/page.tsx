'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Package, Truck, CheckCircle, XCircle, Star, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '@/components/marketplace/navbar';

interface Order {
  id: number;
  status: string;
  totalAmount: number;
  shippingAddress: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  priceAtPurchase: number;
  createdAt: string;
}

interface Product {
  id: number;
  name: string;
  imageUrl: string | null;
  brand: string | null;
}

interface TrackingInfo {
  orderId: number;
  trackingNumber: string;
  carrier: string;
  status: string;
  estimatedDelivery: string;
  notes: string;
}

interface OrderWithItems extends Order {
  items: (OrderItem & { product: Product })[];
}

export default function OrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [tracking, setTracking] = useState<{ [key: number]: TrackingInfo }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ productId: number; productName: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchOrders();
    }
  }, [user, authLoading, router]);

  const fetchOrders = async (showRefreshToast = false) => {
    if (showRefreshToast) setRefreshing(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      
      // Add cache-busting query parameter to force fresh data
      const timestamp = Date.now();
      const response = await fetch(`/api/orders?userId=${user?.id}&limit=100&_=${timestamp}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store', // Prevent caching
      });

      if (response.ok) {
        const ordersData = await response.json();
        
        // Fetch order items and products for each order
        const ordersWithItems = await Promise.all(
          ordersData.map(async (order: Order) => {
            const itemsRes = await fetch(`/api/order-items?orderId=${order.id}&_=${timestamp}`, {
              headers: { 'Authorization': `Bearer ${token}` },
              cache: 'no-store',
            });
            
            if (itemsRes.ok) {
              const items = await itemsRes.json();
              
              // Fetch product details for each item
              const itemsWithProducts = await Promise.all(
                items.map(async (item: OrderItem) => {
                  const productRes = await fetch(`/api/products?id=${item.productId}&_=${timestamp}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    cache: 'no-store',
                  });
                  
                  if (productRes.ok) {
                    const product = await productRes.json();
                    return { ...item, product };
                  }
                  return { ...item, product: { id: item.productId, name: 'Unknown Product', imageUrl: null, brand: null } };
                })
              );
              
              return { ...order, items: itemsWithProducts };
            }
            
            return { ...order, items: [] };
          })
        );
        
        setOrders(ordersWithItems);
        
        // Fetch tracking info for each order
        for (const order of ordersData) {
          fetchTracking(order.id, timestamp);
        }
        
        if (showRefreshToast) {
          toast.success('Orders refreshed');
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      if (showRefreshToast) {
        toast.error('Failed to refresh orders');
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTracking = async (orderId: number, timestamp?: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      const url = timestamp 
        ? `/api/tracking-info?orderId=${orderId}&_=${timestamp}`
        : `/api/tracking-info?orderId=${orderId}`;
        
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setTracking(prev => ({ ...prev, [orderId]: data[0] }));
        }
      }
    } catch (error) {
      console.error('Error fetching tracking:', error);
    }
  };

  const handleOpenReviewDialog = (productId: number, productName: string) => {
    setSelectedProduct({ productId, productName });
    setReviewRating(5);
    setReviewComment('');
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedProduct || !user) return;
    
    setSubmittingReview(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/products/${selectedProduct.productId}/reviews`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          rating: reviewRating,
          comment: reviewComment,
          isVerifiedPurchase: true,
        }),
      });

      if (response.ok) {
        toast.success('Review submitted successfully!');
        setReviewDialogOpen(false);
        setSelectedProduct(null);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: any } = {
      pending: { variant: 'secondary', icon: Package },
      processing: { variant: 'default', icon: Package },
      shipped: { variant: 'default', icon: Truck },
      delivered: { variant: 'default', icon: CheckCircle },
      cancelled: { variant: 'destructive', icon: XCircle },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (authLoading || isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Package className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading orders...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">My Orders</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground mb-4">No orders yet</p>
                <Button onClick={() => router.push('/marketplace')}>
                  Start Shopping
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>Order #{order.id}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Placed on {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium mb-1">Total Amount</p>
                        <p className="text-2xl font-bold">${order.totalAmount.toFixed(2)}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium mb-1">Shipping Address</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                          {order.shippingAddress}
                        </p>
                      </div>
                    </div>

                    {/* Order Items */}
                    {order.items.length > 0 && (
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium mb-3">Items in this order</p>
                        <div className="space-y-3">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                              <div className="w-16 h-16 bg-background rounded overflow-hidden flex-shrink-0">
                                {item.product.imageUrl ? (
                                  <img 
                                    src={item.product.imageUrl} 
                                    alt={item.product.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{item.product.name}</p>
                                {item.product.brand && (
                                  <p className="text-sm text-muted-foreground">{item.product.brand}</p>
                                )}
                                <p className="text-sm text-muted-foreground">
                                  Qty: {item.quantity} × ${item.priceAtPurchase.toFixed(2)}
                                </p>
                              </div>
                              {order.status === 'delivered' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenReviewDialog(item.productId, item.product.name)}
                                  className="flex-shrink-0"
                                >
                                  <Star className="h-4 w-4 mr-1" />
                                  Review
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {tracking[order.id] && (
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium mb-2">Tracking Information</p>
                        <div className="bg-muted rounded-md p-3 space-y-2">
                          {tracking[order.id].trackingNumber && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Tracking Number:</span>
                              <span className="font-mono font-semibold">
                                {tracking[order.id].trackingNumber}
                              </span>
                            </div>
                          )}
                          {tracking[order.id].carrier && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Carrier:</span>
                              <span className="font-semibold">{tracking[order.id].carrier}</span>
                            </div>
                          )}
                          {tracking[order.id].estimatedDelivery && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Estimated Delivery:</span>
                              <span className="font-semibold">
                                {new Date(tracking[order.id].estimatedDelivery).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {tracking[order.id].notes && (
                            <div className="text-sm mt-2 pt-2 border-t border-border">
                              <p className="text-muted-foreground">{tracking[order.id].notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Review Dialog */}
          <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Write a Review</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {selectedProduct && (
                  <p className="text-sm text-muted-foreground">
                    Reviewing: <span className="font-medium text-foreground">{selectedProduct.productName}</span>
                  </p>
                )}
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`h-8 w-8 transition-colors ${
                            star <= reviewRating
                              ? 'fill-yellow-500 text-yellow-500'
                              : 'text-muted-foreground'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Your Review</label>
                  <Textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience with this product..."
                    rows={4}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setReviewDialogOpen(false)}
                    disabled={submittingReview}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitReview}
                    disabled={submittingReview || !reviewComment.trim()}
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
}