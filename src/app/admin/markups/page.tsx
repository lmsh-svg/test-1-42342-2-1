'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Edit, Trash2, TrendingUp, TrendingDown, Tag, Package, Globe } from 'lucide-react';
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
  createdAt: string;
  updatedAt: string;
}

export default function AdminMarkupsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [isLoadingMarkups, setIsLoadingMarkups] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingMarkup, setEditingMarkup] = useState<Markup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'category' as 'site_wide' | 'category' | 'product',
    targetId: '',
    markupType: 'percentage' as 'percentage' | 'fixed_amount',
    markupValue: 0,
    priority: 0,
  });

  useEffect(() => {
    if (!isLoading && user?.role !== 'admin') {
      router.push('/marketplace');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchMarkups();
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
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingMarkup(null);
  };

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
                Configure flexible pricing markups for products, categories, or site-wide
              </p>
            </div>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Markup
          </Button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
                {markups.map((markup) => (
                  <div
                    key={markup.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-border/50 bg-card/50 backdrop-blur"
                  >
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
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
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
                    Use negative values for discounts (e.g., -20% or -$5)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">
                  Priority (Higher = Applied First)
                </Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  placeholder="e.g., 10"
                />
                <p className="text-xs text-muted-foreground">
                  Markups are applied in order of priority (highest first), then creation date
                </p>
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
      </div>
    </div>
  );
}