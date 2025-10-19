'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Trash2, ShoppingCart, Package, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stockQuantity: number;
}

interface Variant {
  id: number;
  productId: number;
  variantName: string;
  variantType: string;
  stockQuantity: number;
  priceModifier: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  variants?: Variant[];
  cartKey: string;
}

const STANDARD_SHIPPING = 22.99;
const PRIORITY_SHIPPING = 35.99;

export default function CartPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'priority'>('standard');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [userCredits, setUserCredits] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadCartItems();
      loadUserCredits();
    }
  }, [user]);

  const loadUserCredits = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/user/profile?userId=${user?.id}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserCredits(data.credits || 0);
      }
    } catch (error) {
      console.error('Error loading user credits:', error);
    }
  };

  const loadCartItems = async () => {
    console.log('[CART DEBUG] ========== START LOADING CART ==========');
    
    try {
      // Step 1: Get cart from localStorage
      const savedCart = localStorage.getItem('cart');
      console.log('[CART DEBUG] Raw localStorage data:', savedCart);
      
      if (!savedCart || savedCart === 'null' || savedCart === 'undefined') {
        console.log('[CART DEBUG] No valid cart data found');
        setIsLoading(false);
        setCartItems([]);
        return;
      }

      // Step 2: Parse cart JSON
      let cart: Record<string, number>;
      try {
        cart = JSON.parse(savedCart);
        console.log('[CART DEBUG] Parsed cart object:', cart);
        
        // Validate cart structure
        if (typeof cart !== 'object' || cart === null || Array.isArray(cart)) {
          console.error('[CART DEBUG] Invalid cart structure, expected object');
          throw new Error('Invalid cart structure');
        }
      } catch (parseError) {
        console.error('[CART DEBUG] ❌ JSON parse error:', parseError);
        localStorage.removeItem('cart');
        toast.error('Cart data was corrupted and has been cleared');
        setIsLoading(false);
        setCartItems([]);
        return;
      }

      const cartKeys = Object.keys(cart);
      console.log('[CART DEBUG] Found', cartKeys.length, 'items in cart:', cartKeys);
      
      if (cartKeys.length === 0) {
        console.log('[CART DEBUG] Cart is empty');
        setIsLoading(false);
        setCartItems([]);
        return;
      }

      // Step 3: Extract product IDs safely
      const productIds = new Set<number>();
      const variantMap = new Map<string, number[]>();
      
      for (const key of cartKeys) {
        try {
          if (key.includes('-variants-')) {
            const parts = key.split('-variants-');
            const productId = parseInt(parts[0]);
            
            if (!isNaN(productId) && productId > 0) {
              productIds.add(productId);
              
              if (parts[1]) {
                const variantIds = parts[1].split('-')
                  .map(id => parseInt(id))
                  .filter(id => !isNaN(id) && id > 0);
                variantMap.set(key, variantIds);
                console.log('[CART DEBUG] Parsed variant key:', key, '-> Product:', productId, 'Variants:', variantIds);
              }
            } else {
              console.warn('[CART DEBUG] Invalid product ID in variant key:', key);
            }
          } else {
            const productId = parseInt(key);
            if (!isNaN(productId) && productId > 0) {
              productIds.add(productId);
              console.log('[CART DEBUG] Parsed simple product key:', key, '-> Product:', productId);
            } else {
              console.warn('[CART DEBUG] Invalid simple product key:', key);
            }
          }
        } catch (keyParseError) {
          console.error('[CART DEBUG] Error parsing cart key:', key, keyParseError);
        }
      }
      
      console.log('[CART DEBUG] Extracted product IDs:', Array.from(productIds));

      if (productIds.size === 0) {
        console.warn('[CART DEBUG] No valid product IDs found in cart');
        localStorage.removeItem('cart');
        setIsLoading(false);
        setCartItems([]);
        return;
      }

      // Step 4: Fetch products with timeout and retry
      const token = localStorage.getItem('auth_token');
      const products: Product[] = [];
      const failedProductIds: number[] = [];

      for (const productId of Array.from(productIds)) {
        console.log('[CART DEBUG] Fetching product ID:', productId);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const productResponse = await fetch(`/api/products?id=${productId}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          console.log('[CART DEBUG] Product', productId, 'response status:', productResponse.status);

          if (productResponse.ok) {
            const product = await productResponse.json();
            
            if (product && product.id && typeof product.id === 'number') {
              products.push(product);
              console.log('[CART DEBUG] ✅ Product', productId, 'loaded successfully');
            } else {
              console.warn('[CART DEBUG] ⚠️ Product', productId, 'returned invalid data');
              failedProductIds.push(productId);
            }
          } else {
            console.warn('[CART DEBUG] ⚠️ Product', productId, 'fetch failed with status:', productResponse.status);
            failedProductIds.push(productId);
          }
        } catch (fetchError) {
          console.error('[CART DEBUG] ❌ Exception fetching product', productId, ':', fetchError);
          failedProductIds.push(productId);
        }
      }
      
      console.log('[CART DEBUG] Successfully loaded', products.length, 'products');
      console.log('[CART DEBUG] Failed to load', failedProductIds.length, 'products:', failedProductIds);

      // Step 5: Build cart items safely
      const items: CartItem[] = [];
      
      for (const cartKey of cartKeys) {
        try {
          const quantity = cart[cartKey];
          
          if (typeof quantity !== 'number' || quantity <= 0 || !Number.isFinite(quantity)) {
            console.warn('[CART DEBUG] Invalid quantity for cart key:', cartKey, quantity);
            continue;
          }
          
          if (cartKey.includes('-variants-')) {
            const [productIdStr] = cartKey.split('-variants-');
            const productId = parseInt(productIdStr);
            const product = products.find(p => p.id === productId);
            
            if (!product) {
              console.warn('[CART DEBUG] Product', productId, 'not found for variant key:', cartKey);
              continue;
            }
            
            const variantIds = variantMap.get(cartKey) || [];
            
            try {
              const variantsResponse = await fetch(`/api/products/${productId}/variants`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
              });
              
              if (variantsResponse.ok) {
                const allVariants = await variantsResponse.json();
                const selectedVariants = allVariants.filter((v: Variant) => 
                  variantIds.includes(v.id)
                );
                
                items.push({
                  product,
                  quantity,
                  variants: selectedVariants,
                  cartKey
                });
                console.log('[CART DEBUG] ✅ Added variant item:', cartKey);
              } else {
                items.push({
                  product,
                  quantity,
                  cartKey
                });
                console.log('[CART DEBUG] ⚠️ Added item without variants (fetch failed):', cartKey);
              }
            } catch (variantError) {
              console.error('[CART DEBUG] Error fetching variants:', variantError);
              items.push({
                product,
                quantity,
                cartKey
              });
            }
          } else {
            const productId = parseInt(cartKey);
            const product = products.find(p => p.id === productId);
            
            if (!product) {
              console.warn('[CART DEBUG] Product', productId, 'not found for simple key:', cartKey);
              continue;
            }
            
            items.push({
              product,
              quantity,
              cartKey
            });
            console.log('[CART DEBUG] ✅ Added simple item:', cartKey);
          }
        } catch (itemError) {
          console.error('[CART DEBUG] Error building cart item for key:', cartKey, itemError);
        }
      }

      console.log('[CART DEBUG] Built', items.length, 'cart items');

      // Step 6: Clean up localStorage if needed
      if (failedProductIds.length > 0 || items.length < cartKeys.length) {
        console.log('[CART DEBUG] Cleaning up localStorage...');
        const cleanedCart: Record<string, number> = {};
        
        for (const item of items) {
          cleanedCart[item.cartKey] = item.quantity;
        }
        
        localStorage.setItem('cart', JSON.stringify(cleanedCart));
        console.log('[CART DEBUG] Cleaned cart saved:', cleanedCart);
        
        const removedCount = cartKeys.length - items.length;
        if (removedCount > 0) {
          toast.warning(`${removedCount} unavailable item${removedCount > 1 ? 's' : ''} removed from cart`);
        }
      }

      setCartItems(items);
      console.log('[CART DEBUG] ========== CART LOADED SUCCESSFULLY ==========');
      
    } catch (error) {
      console.error('[CART DEBUG] ❌❌❌ FATAL ERROR IN CART LOADING ❌❌❌');
      console.error('[CART DEBUG] Error:', error);
      console.error('[CART DEBUG] Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      // Show user-friendly error with recovery option
      setError('Unable to load cart. This may be due to a network issue or corrupted data.');
      toast.error(
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Cart loading failed</p>
          <p className="text-sm">There was a problem loading your cart. You can try clearing it to start fresh.</p>
        </div>,
        {
          duration: 10000,
          action: {
            label: 'Clear Cart',
            onClick: () => {
              localStorage.removeItem('cart');
              window.location.reload();
            }
          }
        }
      );
    } finally {
      setIsLoading(false);
      console.log('[CART DEBUG] Loading complete, isLoading set to false');
    }
  };

  const updateQuantity = (cartKey: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(cartKey);
      return;
    }

    try {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        const cart = JSON.parse(savedCart);
        cart[cartKey] = newQuantity;
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Update state immediately for instant UI feedback
        setCartItems(prev => prev.map(item => 
          item.cartKey === cartKey ? { ...item, quantity: newQuantity } : item
        ));
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('Failed to update quantity');
    }
  };

  const removeItem = (cartKey: string) => {
    try {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        const cart = JSON.parse(savedCart);
        delete cart[cartKey];
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Update state immediately for instant UI feedback
        setCartItems(prev => prev.filter(item => item.cartKey !== cartKey));
        
        toast.success('Item removed from cart');
      }
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    }
  };

  const getItemPrice = (item: CartItem): number => {
    let price = item.product.price;
    if (item.variants) {
      price += item.variants.reduce((sum, v) => sum + v.priceModifier, 0);
    }
    return price;
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + (getItemPrice(item) * item.quantity), 0);
  };

  const getShippingCost = () => {
    return shippingMethod === 'priority' ? PRIORITY_SHIPPING : STANDARD_SHIPPING;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + getShippingCost();
  };

  const handleCheckout = async () => {
    if (!shippingAddress.trim()) {
      setError('Please enter a shipping address');
      toast.error('Please enter a shipping address');
      return;
    }

    const total = calculateTotal();
    
    // Check if user has sufficient credits
    if (userCredits < total) {
      const shortfall = total - userCredits;
      setError(`Insufficient funds. You need $${shortfall.toFixed(2)} more to complete this order.`);
      toast.error(`Insufficient funds! You need $${shortfall.toFixed(2)} more. Please add credits to your account.`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      const subtotal = calculateSubtotal();
      const shippingCost = getShippingCost();
      const totalAmount = calculateTotal();

      // Create order
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user?.id,
          totalAmount,
          shippingAddress: shippingAddress.trim(),
          notes: `${notes.trim() || ''}\n\nShipping: ${shippingMethod === 'priority' ? 'USPS Priority Mail' : 'USPS Standard Shipping'} ($${shippingCost.toFixed(2)})`.trim(),
          status: 'pending',
        }),
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }

      const order = await orderResponse.json();

      // Create order items
      for (const item of cartItems) {
        await fetch('/api/order-items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderId: order.id,
            productId: item.product.id,
            quantity: item.quantity,
            priceAtPurchase: getItemPrice(item),
          }),
        });
      }

      // Clear cart
      localStorage.removeItem('cart');
      
      toast.success('Order placed successfully!');
      router.push('/marketplace/orders');
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Failed to place order. Please try again.');
      toast.error('Failed to place order. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading cart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => router.push('/marketplace')}
          className="mb-4 sm:mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Marketplace
        </Button>

        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8">Shopping Cart</h1>

        {cartItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground mb-4">Your cart is empty</p>
              <Button onClick={() => router.push('/marketplace')}>
                Continue Shopping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <Card key={item.cartKey}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex gap-3 sm:gap-4">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                        {item.product.imageUrl ? (
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="object-cover w-full h-full rounded-md"
                          />
                        ) : (
                          <Package className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{item.product.name}</h3>
                        {item.variants && item.variants.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {item.variants.map((variant) => (
                              <p key={variant.id} className="text-xs sm:text-sm text-muted-foreground">
                                {variant.variantType}: {variant.variantName}
                                {variant.priceModifier !== 0 && (
                                  <span className="ml-1">
                                    ({variant.priceModifier > 0 ? '+' : ''}${variant.priceModifier.toFixed(2)})
                                  </span>
                                )}
                              </p>
                            ))}
                          </div>
                        )}
                        <p className="text-base sm:text-lg font-bold mt-2">${getItemPrice(item).toFixed(2)}</p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.cartKey)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.cartKey, item.quantity - 1)}
                          >
                            -
                          </Button>
                          <span className="w-6 sm:w-8 text-center text-sm sm:text-base">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}
                          >
                            +
                          </Button>
                        </div>

                        <p className="text-sm font-semibold">
                          ${(getItemPrice(item) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Checkout Form */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Checkout</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="shipping">Shipping Address *</Label>
                    <Textarea
                      id="shipping"
                      placeholder="Enter your shipping address"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shippingMethod">Shipping Method</Label>
                    <Select value={shippingMethod} onValueChange={(value: 'standard' | 'priority') => setShippingMethod(value)}>
                      <SelectTrigger id="shippingMethod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">USPS Standard Shipping</span>
                            <span className="text-sm text-muted-foreground">${STANDARD_SHIPPING.toFixed(2)} - 2-5 business days</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="priority">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">USPS Priority Mail</span>
                            <span className="text-sm text-muted-foreground">${PRIORITY_SHIPPING.toFixed(2)} - 1-3 business days</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Order Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any special instructions?"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${calculateSubtotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping ({shippingMethod === 'priority' ? 'Priority' : 'Standard'})</span>
                      <span>${getShippingCost().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total</span>
                      <span>${calculateTotal().toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Your Credits</span>
                      <span className={userCredits >= calculateTotal() ? 'text-green-600 font-medium' : 'text-destructive font-medium'}>
                        ${userCredits.toFixed(2)}
                      </span>
                    </div>
                    
                    {userCredits < calculateTotal() && (
                      <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-destructive">
                          <p className="font-semibold">Insufficient Funds</p>
                          <p>You need ${(calculateTotal() - userCredits).toFixed(2)} more to complete this order.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={handleCheckout}
                    disabled={isSubmitting || userCredits < calculateTotal()}
                    className="w-full"
                  >
                    {isSubmitting ? 'Placing Order...' : 'Place Order'}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}