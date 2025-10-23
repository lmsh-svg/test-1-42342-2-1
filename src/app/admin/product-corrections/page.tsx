'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { AdminTabs } from '@/components/admin/admin-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Search, Edit2, Save, X, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useInactivityLogout } from '@/hooks/use-inactivity-logout';
import { InactivityWarning } from '@/components/auth/inactivity-warning';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Product {
  id: number;
  name: string;
  category: string;
  mainCategory: string;
  price: number;
  stockQuantity: number;
  inStock: boolean;
  hasCorrection: boolean;
  correctedCategory: string | null;
  correctedName: string | null;
  brand: string | null;
  sourceType: string;
  sourceId: string | null;
}

interface ProductCorrection {
  id: number;
  sourceProductId: string;
  correctedCategory: string | null;
  correctedName: string | null;
}

export default function ProductCorrectionsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editedCategory, setEditedCategory] = useState('');
  const [editedName, setEditedName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);

  const { showWarning, secondsRemaining, dismissWarning } = useInactivityLogout(!!user);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchProducts();
    }
  }, [user, searchQuery, categoryFilter]);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (searchQuery) params.append('search', searchQuery);
      if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter);

      const response = await fetch(`/api/admin/products/list?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Only show API-imported products (those with sourceId)
        const apiProducts = data.filter((p: Product) => p.sourceId !== null && p.sourceId !== '');
        setProducts(apiProducts);
      } else {
        toast.error('Failed to load products');
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (product: Product) => {
    setEditingProductId(product.id);
    setEditedCategory(product.correctedCategory || product.mainCategory);
    setEditedName(product.correctedName || product.name);
  };

  const cancelEditing = () => {
    setEditingProductId(null);
    setEditedCategory('');
    setEditedName('');
  };

  const saveCorrection = async (product: Product) => {
    if (!product.sourceId) {
      toast.error('This product has no source ID - cannot apply corrections');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');

      // Check if correction exists
      const existingCorrection = await fetch(
        `/api/admin/product-corrections?search=${product.sourceId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const existingData = await existingCorrection.json();
      const correction = existingData.find((c: ProductCorrection) => c.sourceProductId === product.sourceId);

      let response;
      if (correction) {
        // Update existing correction
        response = await fetch(`/api/admin/product-corrections?id=${correction.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            correctedCategory: editedCategory !== product.mainCategory ? editedCategory : null,
            correctedName: editedName !== product.name ? editedName : null,
          }),
        });
      } else {
        // Create new correction
        response = await fetch('/api/admin/product-corrections', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            sourceProductId: product.sourceId,
            correctedCategory: editedCategory !== product.mainCategory ? editedCategory : null,
            correctedName: editedName !== product.name ? editedName : null,
          }),
        });
      }

      if (response.ok) {
        toast.success('Correction saved! Will apply on next sync.');
        setEditingProductId(null);
        fetchProducts(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save correction');
      }
    } catch (error) {
      console.error('Failed to save correction:', error);
      toast.error('Failed to save correction');
    }
  };

  const confirmDeleteCorrection = (productId: number) => {
    setProductToDelete(productId);
    setDeleteDialogOpen(true);
  };

  const deleteCorrection = async () => {
    if (!productToDelete) return;

    try {
      const token = localStorage.getItem('auth_token');
      const product = products.find(p => p.id === productToDelete);
      if (!product || !product.sourceId) return;

      // Find the correction ID
      const existingCorrection = await fetch(
        `/api/admin/product-corrections?search=${product.sourceId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const existingData = await existingCorrection.json();
      const correction = existingData.find((c: ProductCorrection) => c.sourceProductId === product.sourceId);

      if (correction) {
        const response = await fetch(`/api/admin/product-corrections?id=${correction.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          toast.success('Correction removed successfully');
          fetchProducts(); // Refresh the list
        } else {
          toast.error('Failed to remove correction');
        }
      }
    } catch (error) {
      console.error('Failed to delete correction:', error);
      toast.error('Failed to remove correction');
    } finally {
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const uniqueCategories = Array.from(new Set(products.map(p => p.mainCategory))).sort();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminTabs />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/admin/api-management">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Import
                </Button>
              </Link>
              <div>
                <h1 className="text-4xl font-bold">Product Corrections</h1>
                <p className="text-muted-foreground mt-2">
                  Manually correct product categories and names. Changes persist across API syncs.
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search Products</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Filter by Category</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products List */}
        <Card>
          <CardHeader>
            <CardTitle>API-Imported Products ({products.length})</CardTitle>
            <CardDescription>
              Click Edit to correct category or name. Changes apply to future syncs. Only showing products imported from API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No API-imported products found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery || categoryFilter !== 'all' 
                    ? 'Try adjusting your filters'
                    : 'Import products first from the API Management page'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {products.map((product) => {
                  const isEditing = editingProductId === product.id;
                  
                  return (
                    <div
                      key={product.id}
                      className={`border rounded-lg p-4 space-y-3 transition-colors ${
                        product.hasCorrection 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          {/* Product Name */}
                          {isEditing ? (
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-muted-foreground">Product Name</label>
                              <Input
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="font-semibold"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <p className="font-semibold">
                                {product.correctedName || product.name}
                              </p>
                              {product.correctedName && (
                                <Badge variant="secondary" className="text-xs">Name Corrected</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                (ID: {product.sourceId})
                              </span>
                            </div>
                          )}

                          {/* Category */}
                          {isEditing ? (
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-muted-foreground">Category</label>
                              <Select value={editedCategory} onValueChange={setEditedCategory}>
                                <SelectTrigger className="w-[250px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {uniqueCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={product.hasCorrection ? "default" : "outline"}>
                                {product.correctedCategory || product.mainCategory}
                              </Badge>
                              {product.correctedCategory && (
                                <span className="text-xs text-muted-foreground">
                                  (was: {product.mainCategory})
                                </span>
                              )}
                              {product.brand && (
                                <span className="text-xs text-muted-foreground">• Brand: {product.brand}</span>
                              )}
                              {!product.inStock && (
                                <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right flex-shrink-0 mr-4">
                            <div className="font-bold text-primary">${product.price.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">
                              Stock: {product.stockQuantity}
                            </div>
                          </div>

                          {isEditing ? (
                            <>
                              <Button size="sm" onClick={() => saveCorrection(product)}>
                                <Save className="h-4 w-4 mr-1" />
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEditing}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => startEditing(product)}>
                                <Edit2 className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              {product.hasCorrection && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => confirmDeleteCorrection(product.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Correction</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the manual correction and revert to the original API values.
              The product will use the original category and name from the next sync.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteCorrection}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InactivityWarning
        open={showWarning}
        secondsRemaining={secondsRemaining}
        onDismiss={dismissWarning}
      />
    </div>
  );
}