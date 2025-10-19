'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Edit, Trash2, TrendingUp, TrendingDown, Tag, Package, Globe, Eye, Calculator, Layers, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface Markup {
  id: number;
  name: string;
  type: 'site_wide' | 'category' | 'product';
  targetId: string | null;
  markupType: 'percentage' | 'fixed_amount';
  markupValue: number;
  isActive: boolean;
  priority: number;
  startDate: string | null;
  endDate: string | null;
  compoundStrategy: 'replace' | 'add' | 'multiply';
  createdAt: string;
  updatedAt: string;
}

interface MarkupTier {
  id?: number;
  markupId?: number;
  minQuantity: number;
  maxQuantity: number | null;
  markupValue: number;
  createdAt?: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  mainCategory: string;
  imageUrl: string | null;
}

interface MarkupPreview {
  productId: number;
  productName: string;
  category: string;
  basePrice: number;
  finalPrice: number;
  markup: number;
  profitMargin: number;
  roi: number;
  appliedMarkups: {
    name: string;
    type: string;
    markupType: string;
    markupValue: number;
  }[];
}

export default function AdminMarkupsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingMarkups, setIsLoadingMarkups] = useState(true);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingMarkup, setEditingMarkup] = useState<Markup | null>(null);
  const [markupPreviews, setMarkupPreviews] = useState<MarkupPreview[]>([]);
  const [previewCategory, setPreviewCategory] = useState<string>('all');
  const [previewLimit, setPreviewLimit] = useState<number>(10);
  const [markupTiers, setMarkupTiers] = useState<Record<number, MarkupTier[]>>({});
  const [editingTiers, setEditingTiers] = useState<MarkupTier[]>([]);
  const [showTierDialog, setShowTierDialog] = useState(false);
  const [selectedMarkupForTiers, setSelectedMarkupForTiers] = useState<Markup | null>(null);

  useEffect(() => {
    if (!isLoading && user?.role !== 'admin') {
      router.push('/marketplace');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchMarkups();
      fetchProducts();
    }
  }, [user]);

  const fetchMarkups = async () => {
    setIsLoadingMarkups(true);
    try {
      const response = await fetch('/api/admin/markups?limit=100');
      if (response.ok) {
        const data = await response.json();
        setMarkups(data);
      } else {
        toast.error('Failed to fetch markups');
      }
    } catch (error) {
      console.error('Failed to fetch markups:', error);
      toast.error('Failed to fetch markups');
    } finally {
      setIsLoadingMarkups(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products?limit=1000');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const fetchMarkupTiers = async (markupId: number) => {
    try {
      const response = await fetch(`/api/admin/markup-tiers?markupId=${markupId}`);
      if (response.ok) {
        const data = await response.json();
        setMarkupTiers(prev => ({ ...prev, [markupId]: data }));
      }
    } catch (error) {
      console.error(`Failed to fetch tiers for markup ${markupId}:`, error);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' && markups.length > 0) {
      // Fetch tiers for all markups
      markups.forEach(markup => fetchMarkupTiers(markup.id));
    }
  }, [markups, user]);

  const generatePreview = async () => {
    setIsLoadingPreview(true);
    try {
      const filteredProducts = previewCategory === 'all' 
        ? products.slice(0, previewLimit)
        : products.filter(p => p.mainCategory === previewCategory).slice(0, previewLimit);

      const previews = await Promise.all(
        filteredProducts.map(async (product) => {
          try {
            const response = await fetch(
              `/api/admin/calculate-markup-price?productId=${product.id}&categoryName=${product.mainCategory}&basePrice=${product.price}`
            );
            
            if (response.ok) {
              const data = await response.json();
              const markup = data.finalPrice - data.basePrice;
              const profitMargin = ((markup / data.finalPrice) * 100);
              const roi = ((markup / data.basePrice) * 100);
              
              return {
                productId: product.id,
                productName: product.name,
                category: product.mainCategory,
                basePrice: data.basePrice,
                finalPrice: data.finalPrice,
                markup,
                profitMargin,
                roi,
                appliedMarkups: data.appliedMarkups || []
              };
            }
          } catch (error) {
            console.error(`Failed to calculate markup for product ${product.id}:`, error);
          }
          return null;
        })
      );

      setMarkupPreviews(previews.filter(p => p !== null) as MarkupPreview[]);
    } catch (error) {
      console.error('Failed to generate preview:', error);
      toast.error('Failed to generate preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleOpenDialog = (markup?: Markup) => {
    if (markup) {
      setEditingMarkup(markup);
      setFormData({
        name: markup.name,
        type: markup.type,
        targetId: markup.targetId || '',
        markupType: markup.markupType,
        markupValue: markup.markupValue,
        priority: markup.priority,
        startDate: markup.startDate || '',
        endDate: markup.endDate || '',
        compoundStrategy: markup.compoundStrategy || 'replace',
      });
    } else {
      setEditingMarkup(null);
      setFormData({
        name: '',
        type: 'category',
        targetId: '',
        markupType: 'percentage',
        markupValue: 0,
        priority: 0,
        startDate: '',
        endDate: '',
        compoundStrategy: 'replace',
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingMarkup(null);
  };

  const handleOpenTierDialog = (markup: Markup) => {
    setSelectedMarkupForTiers(markup);
    const existingTiers = markupTiers[markup.id] || [];
    setEditingTiers(existingTiers.length > 0 ? [...existingTiers] : [
      { minQuantity: 1, maxQuantity: 10, markupValue: markup.markupValue }
    ]);
    setShowTierDialog(true);
  };

  const addTierRow = () => {
    const lastTier = editingTiers[editingTiers.length - 1];
    const newMinQty = lastTier ? (lastTier.maxQuantity || lastTier.minQuantity) + 1 : 1;
    
    setEditingTiers([...editingTiers, {
      minQuantity: newMinQty,
      maxQuantity: null,
      markupValue: selectedMarkupForTiers?.markupValue || 0
    }]);
  };

  const removeTierRow = (index: number) => {
    setEditingTiers(editingTiers.filter((_, i) => i !== index));
  };

  const updateTierRow = (index: number, field: keyof MarkupTier, value: any) => {
    const updated = [...editingTiers];
    updated[index] = { ...updated[index], [field]: value };
    setEditingTiers(updated);
  };

  const saveTiers = async () => {
    if (!selectedMarkupForTiers) return;

    try {
      // Delete existing tiers
      const existingTiers = markupTiers[selectedMarkupForTiers.id] || [];
      await Promise.all(
        existingTiers.map(tier => 
          fetch(`/api/admin/markup-tiers?id=${tier.id}`, { method: 'DELETE' })
        )
      );

      // Create new tiers
      await Promise.all(
        editingTiers.map(tier =>
          fetch('/api/admin/markup-tiers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              markupId: selectedMarkupForTiers.id,
              minQuantity: tier.minQuantity,
              maxQuantity: tier.maxQuantity,
              markupValue: tier.markupValue
            })
          })
        )
      );

      toast.success('Pricing tiers saved successfully');
      await fetchMarkupTiers(selectedMarkupForTiers.id);
      setShowTierDialog(false);
    } catch (error) {
      console.error('Failed to save tiers:', error);
      toast.error('Failed to save pricing tiers');
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    type: 'category' as 'site_wide' | 'category' | 'product',
    targetId: '',
    markupType: 'percentage' as 'percentage' | 'fixed_amount',
    markupValue: 0,
    priority: 0,
    startDate: '',
    endDate: '',
    compoundStrategy: 'replace' as 'replace' | 'add' | 'multiply',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        targetId: formData.type === 'site_wide' ? null : formData.targetId,
        markupType: formData.markupType,
        markupValue: formData.markupValue,
        priority: formData.priority,
        isActive: true,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        compoundStrategy: formData.compoundStrategy,
      };

      let response;
      if (editingMarkup) {
        response = await fetch(`/api/admin/markups?id=${editingMarkup.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/admin/markups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        toast.success(editingMarkup ? 'Markup updated successfully' : 'Markup created successfully');
        handleCloseDialog();
        fetchMarkups();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save markup');
      }
    } catch (error) {
      console.error('Failed to save markup:', error);
      toast.error('Failed to save markup');
    }
  };

  const handleToggleActive = async (markup: Markup) => {
    try {
      const response = await fetch(`/api/admin/markups?id=${markup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !markup.isActive }),
      });

      if (response.ok) {
        toast.success(markup.isActive ? 'Markup deactivated' : 'Markup activated');
        fetchMarkups();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to toggle markup');
      }
    } catch (error) {
      console.error('Failed to toggle markup:', error);
      toast.error('Failed to toggle markup');
    }
  };

  const handleDelete = async (markup: Markup) => {
    if (!confirm(`Are you sure you want to delete "${markup.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/markups?id=${markup.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Markup deleted successfully');
        fetchMarkups();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete markup');
      }
    } catch (error) {
      console.error('Failed to delete markup:', error);
      toast.error('Failed to delete markup');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'site_wide':
        return <Globe className="h-4 w-4" />;
      case 'category':
        return <Tag className="h-4 w-4" />;
      case 'product':
        return <Package className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'site_wide':
        return 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30';
      case 'category':
        return 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'product':
        return 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30';
      default:
        return '';
    }
  };

  const categories = Array.from(new Set(products.map(p => p.mainCategory)));

  if (isLoading || user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Markup Management</h1>
              <p className="text-muted-foreground mt-1">
                Configure flexible pricing markups with live preview and profit analytics
              </p>
            </div>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Markup
          </Button>
        </div>

        <Tabs defaultValue="markups" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="markups" className="gap-2">
              <Tag className="h-4 w-4" />
              Markups
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Preview & Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="markups" className="space-y-6">
            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-purple-500/10">
                      <Globe className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Site-Wide</p>
                      <p className="text-2xl font-bold">
                        {markups.filter(m => m.type === 'site_wide' && m.isActive).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-blue-500/10">
                      <Tag className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Category</p>
                      <p className="text-2xl font-bold">
                        {markups.filter(m => m.type === 'category' && m.isActive).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-green-500/10">
                      <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Product</p>
                      <p className="text-2xl font-bold">
                        {markups.filter(m => m.type === 'product' && m.isActive).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Markups List */}
            <Card>
              <CardHeader>
                <CardTitle>All Markups</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingMarkups ? (
                  <div className="text-center py-12">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                    <p className="mt-4 text-muted-foreground">Loading markups...</p>
                  </div>
                ) : markups.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No markups yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create your first markup to start managing pricing
                    </p>
                    <Button onClick={() => handleOpenDialog()} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create Markup
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {markups.map((markup) => {
                      const tiers = markupTiers[markup.id] || [];
                      const hasTiers = tiers.length > 0;
                      
                      return (
                        <div
                          key={markup.id}
                          className="flex flex-col gap-4 p-4 rounded-lg border border-border/50 bg-card/50 backdrop-blur"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <h3 className="font-semibold text-lg">{markup.name}</h3>
                                <Badge variant="outline" className={`gap-1 ${getTypeBadgeColor(markup.type)}`}>
                                  {getTypeIcon(markup.type)}
                                  {markup.type === 'site_wide' ? 'Site-Wide' : markup.type.charAt(0).toUpperCase() + markup.type.slice(1)}
                                </Badge>
                                {!markup.isActive && (
                                  <Badge variant="secondary">Inactive</Badge>
                                )}
                                <Badge variant="outline" className="gap-1">
                                  Priority: {markup.priority}
                                </Badge>
                                {hasTiers && (
                                  <Badge variant="outline" className="gap-1 bg-amber-500/20 text-amber-600 border-amber-500/30">
                                    <Layers className="h-3 w-3" />
                                    {tiers.length} Tiers
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                {markup.targetId && (
                                  <span className="flex items-center gap-1">
                                    <Tag className="h-3 w-3" />
                                    Target: {markup.targetId}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  {markup.markupValue >= 0 ? (
                                    <TrendingUp className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 text-red-600" />
                                  )}
                                  {markup.markupType === 'percentage' 
                                    ? `${markup.markupValue > 0 ? '+' : ''}${markup.markupValue}%`
                                    : `${markup.markupValue > 0 ? '+' : ''}$${markup.markupValue.toFixed(2)}`
                                  }
                                </span>
                                {(markup.startDate || markup.endDate) && (
                                  <span className="text-xs">
                                    {markup.startDate && `From ${new Date(markup.startDate).toLocaleDateString()}`}
                                    {markup.startDate && markup.endDate && ' - '}
                                    {markup.endDate && `To ${new Date(markup.endDate).toLocaleDateString()}`}
                                  </span>
                                )}
                                <span className="text-xs capitalize">
                                  Strategy: {markup.compoundStrategy}
                                </span>
                              </div>
                              
                              {hasTiers && (
                                <div className="mt-2 p-2 bg-muted/30 rounded text-xs space-y-1">
                                  <p className="font-medium">Quantity Tiers:</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {tiers.map((tier, idx) => (
                                      <span key={idx} className="inline-flex items-center gap-1 bg-background/50 px-2 py-1 rounded">
                                        {tier.minQuantity}+{tier.maxQuantity ? `-${tier.maxQuantity}` : ''}: 
                                        <span className="font-semibold text-primary">
                                          {markup.markupType === 'percentage' 
                                            ? `${tier.markupValue}%` 
                                            : `$${tier.markupValue.toFixed(2)}`
                                          }
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenTierDialog(markup)}
                                className="gap-1"
                              >
                                <Layers className="h-4 w-4" />
                                {hasTiers ? 'Edit' : 'Add'} Tiers
                              </Button>
                              <Button
                                variant={markup.isActive ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleToggleActive(markup)}
                              >
                                {markup.isActive ? 'Active' : 'Inactive'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDialog(markup)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(markup)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Markup Preview & Profit Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Category Filter</Label>
                    <Select value={previewCategory} onValueChange={setPreviewCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Product Limit</Label>
                    <Select value={previewLimit.toString()} onValueChange={(v) => setPreviewLimit(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 Products</SelectItem>
                        <SelectItem value="25">25 Products</SelectItem>
                        <SelectItem value="50">50 Products</SelectItem>
                        <SelectItem value="100">100 Products</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button onClick={generatePreview} disabled={isLoadingPreview} className="w-full gap-2">
                      <Eye className="h-4 w-4" />
                      {isLoadingPreview ? 'Generating...' : 'Generate Preview'}
                    </Button>
                  </div>
                </div>

                {markupPreviews.length > 0 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
                        <CardContent className="pt-6">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Avg Profit Margin</p>
                            <p className="text-2xl font-bold text-green-600">
                              {(markupPreviews.reduce((sum, p) => sum + p.profitMargin, 0) / markupPreviews.length).toFixed(2)}%
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
                        <CardContent className="pt-6">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Avg ROI</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {(markupPreviews.reduce((sum, p) => sum + p.roi, 0) / markupPreviews.length).toFixed(2)}%
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
                        <CardContent className="pt-6">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Total Markup Value</p>
                            <p className="text-2xl font-bold text-purple-600">
                              ${markupPreviews.reduce((sum, p) => sum + p.markup, 0).toFixed(2)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-500/20">
                        <CardContent className="pt-6">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Products Analyzed</p>
                            <p className="text-2xl font-bold text-amber-600">
                              {markupPreviews.length}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="text-left p-3 font-medium">Product</th>
                            <th className="text-left p-3 font-medium">Category</th>
                            <th className="text-right p-3 font-medium">Base Price</th>
                            <th className="text-right p-3 font-medium">Final Price</th>
                            <th className="text-right p-3 font-medium">Markup</th>
                            <th className="text-right p-3 font-medium">Profit %</th>
                            <th className="text-right p-3 font-medium">ROI %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {markupPreviews.map((preview) => (
                            <tr key={preview.productId} className="border-b hover:bg-muted/30">
                              <td className="p-3 max-w-xs truncate font-medium">{preview.productName}</td>
                              <td className="p-3">
                                <Badge variant="outline" className="text-xs">{preview.category}</Badge>
                              </td>
                              <td className="p-3 text-right text-muted-foreground">
                                ${preview.basePrice.toFixed(2)}
                              </td>
                              <td className="p-3 text-right font-semibold">
                                ${preview.finalPrice.toFixed(2)}
                              </td>
                              <td className="p-3 text-right">
                                <span className={preview.markup >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {preview.markup >= 0 ? '+' : ''}${preview.markup.toFixed(2)}
                                </span>
                              </td>
                              <td className="p-3 text-right font-medium text-green-600">
                                {preview.profitMargin.toFixed(2)}%
                              </td>
                              <td className="p-3 text-right font-medium text-blue-600">
                                {preview.roi.toFixed(2)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!isLoadingPreview && markupPreviews.length === 0 && (
                  <div className="text-center py-12">
                    <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Preview Generated</h3>
                    <p className="text-sm text-muted-foreground">
                      Click "Generate Preview" to see how markups affect product pricing
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create/Edit Markup Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMarkup ? 'Edit Markup' : 'Create New Markup'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Markup Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Holiday Sale, Premium Markup"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Markup Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: any) => setFormData({ ...formData, type: value, targetId: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="site_wide">Site-Wide (All Products)</SelectItem>
                      <SelectItem value="category">Category Specific</SelectItem>
                      <SelectItem value="product">Product Specific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type !== 'site_wide' && (
                  <div className="space-y-2">
                    <Label htmlFor="targetId">
                      {formData.type === 'category' ? 'Category Name' : 'Product ID'} *
                    </Label>
                    <Input
                      id="targetId"
                      value={formData.targetId}
                      onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
                      placeholder={formData.type === 'category' ? 'e.g., Cartridges' : 'e.g., 12345'}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="markupType">Value Type *</Label>
                  <Select
                    value={formData.markupType}
                    onValueChange={(value: any) => setFormData({ ...formData, markupType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed_amount">Fixed Amount ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="markupValue">
                    {formData.markupType === 'percentage' ? 'Percentage (%)' : 'Amount ($)'} *
                  </Label>
                  <Input
                    id="markupValue"
                    type="number"
                    step={formData.markupType === 'percentage' ? '0.1' : '0.01'}
                    value={formData.markupValue}
                    onChange={(e) => setFormData({ ...formData, markupValue: parseFloat(e.target.value) })}
                    placeholder={formData.markupType === 'percentage' ? 'e.g., 10 or -20' : 'e.g., 5.00 or -10.00'}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Default/base value - can be overridden by quantity tiers
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date (Optional)</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date (Optional)</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="compoundStrategy">Compound Strategy</Label>
                  <Select
                    value={formData.compoundStrategy}
                    onValueChange={(value: any) => setFormData({ ...formData, compoundStrategy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="replace">Replace (Reset to base)</SelectItem>
                      <SelectItem value="add">Add (Cumulative)</SelectItem>
                      <SelectItem value="multiply">Multiply (Compound)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How this markup combines with others
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    placeholder="e.g., 10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher priority = applied first
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingMarkup ? 'Update Markup' : 'Create Markup'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Tier Management Dialog */}
        <Dialog open={showTierDialog} onOpenChange={setShowTierDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Manage Quantity-Based Pricing Tiers
                {selectedMarkupForTiers && (
                  <p className="text-sm font-normal text-muted-foreground mt-1">
                    {selectedMarkupForTiers.name}
                  </p>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Define different markup values based on purchase quantity. Customers buying in higher quantities will see the tier-appropriate pricing.
              </p>

              {editingTiers.map((tier, index) => (
                <div key={index} className="flex items-end gap-2 p-3 border rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Min Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        value={tier.minQuantity}
                        onChange={(e) => updateTierRow(index, 'minQuantity', parseInt(e.target.value))}
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max Qty</Label>
                      <Input
                        type="number"
                        value={tier.maxQuantity || ''}
                        onChange={(e) => updateTierRow(index, 'maxQuantity', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="∞"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Value ({selectedMarkupForTiers?.markupType === 'percentage' ? '%' : '$'})
                      </Label>
                      <Input
                        type="number"
                        step={selectedMarkupForTiers?.markupType === 'percentage' ? '0.1' : '0.01'}
                        value={tier.markupValue}
                        onChange={(e) => updateTierRow(index, 'markupValue', parseFloat(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeTierRow(index)}
                    disabled={editingTiers.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addTierRow}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tier
              </Button>

              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <p className="font-medium">Example Preview:</p>
                {editingTiers.map((tier, idx) => (
                  <p key={idx} className="text-muted-foreground">
                    {tier.minQuantity}+ {tier.maxQuantity ? `to ${tier.maxQuantity}` : ''} units: 
                    <span className="ml-1 font-semibold text-primary">
                      {selectedMarkupForTiers?.markupType === 'percentage' 
                        ? `${tier.markupValue}%` 
                        : `$${tier.markupValue.toFixed(2)}`
                      }
                    </span>
                  </p>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowTierDialog(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveTiers}>
                Save Tiers
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}