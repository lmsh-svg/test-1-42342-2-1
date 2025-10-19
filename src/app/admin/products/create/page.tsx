'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Upload, Package, Image as ImageIcon, Star } from 'lucide-react';

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

interface Variant {
  name: string;
  price: number;
  stockQuantity: number;
}

interface BulkPricing {
  minQuantity: number;
  price: number;
}

interface ProductImage {
  url: string;
  isPrimary: boolean;
  file?: File;
}

export default function AdminCreateProductPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    mainCategory: 'Cartridges',
    brand: '',
    volume: '',
    stockQuantity: '0',
    imageUrl: '',
    isLocalOnly: false,
  });

  const [variants, setVariants] = useState<Variant[]>([]);
  const [bulkPricing, setBulkPricing] = useState<BulkPricing[]>([]);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const addVariant = () => {
    setVariants([...variants, { name: '', price: 0, stockQuantity: 0 }]);
  };

  const updateVariant = (index: number, field: keyof Variant, value: string | number) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const addBulkPricing = () => {
    setBulkPricing([...bulkPricing, { minQuantity: 3, price: 0 }]);
  };

  const updateBulkPricing = (index: number, field: keyof BulkPricing, value: number) => {
    const updated = [...bulkPricing];
    updated[index] = { ...updated[index], [field]: value };
    setBulkPricing(updated);
  };

  const removeBulkPricing = (index: number) => {
    setBulkPricing(bulkPricing.filter((_, i) => i !== index));
  };

  const addImageUrl = () => {
    setProductImages([...productImages, { url: '', isPrimary: productImages.length === 0 }]);
  };

  const updateImageUrl = (index: number, url: string) => {
    const updated = [...productImages];
    updated[index] = { ...updated[index], url };
    setProductImages(updated);
  };

  const handleImageFileUpload = (index: number, file: File | null) => {
    if (!file) return;

    // Create object URL for preview
    const objectUrl = URL.createObjectURL(file);
    const updated = [...productImages];
    updated[index] = { ...updated[index], url: objectUrl, file };
    setProductImages(updated);
    toast.success('Image file loaded');
  };

  const setImageAsPrimary = (index: number) => {
    const updated = productImages.map((img, i) => ({
      ...img,
      isPrimary: i === index
    }));
    setProductImages(updated);
  };

  const removeImage = (index: number) => {
    const updated = productImages.filter((_, i) => i !== index);
    // If we removed the primary, make the first one primary
    if (updated.length > 0 && !updated.some(img => img.isPrimary)) {
      updated[0].isPrimary = true;
    }
    setProductImages(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast.error('Please enter a product name');
      return;
    }

    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Please enter a valid price greater than 0');
      return;
    }

    const stockNum = parseInt(formData.stockQuantity);
    if (isNaN(stockNum) || stockNum < 0) {
      toast.error('Please enter a valid stock quantity');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        router.push('/login');
        return;
      }

      // Determine primary image URL
      const primaryImage = productImages.find(img => img.isPrimary);
      const imageUrl = primaryImage?.url || formData.imageUrl.trim() || null;

      // Create the product
      const productPayload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: priceNum,
        mainCategory: formData.mainCategory,
        brand: formData.brand.trim() || null,
        volume: formData.volume.trim() || null,
        stockQuantity: stockNum,
        imageUrl: imageUrl,
        isLocalOnly: formData.isLocalOnly,
        isAvailable: true,
      };

      const productResponse = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productPayload),
      });

      if (!productResponse.ok) {
        const errorData = await productResponse.json();
        throw new Error(errorData.error || `Failed to create product (${productResponse.status})`);
      }

      const product = await productResponse.json();
      const productId = product.id;

      // Upload additional product images if any
      if (productImages.length > 0) {
        for (let i = 0; i < productImages.length; i++) {
          const image = productImages[i];
          if (image.url && image.url.trim()) {
            try {
              const imageResponse = await fetch('/api/admin/product-images', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  productId,
                  imageUrl: image.url.trim(),
                  isPrimary: image.isPrimary,
                  displayOrder: i,
                }),
              });

              if (!imageResponse.ok) {
                const errorData = await imageResponse.json();
                toast.warning(`Warning: Failed to add image ${i + 1}: ${errorData.error}`);
              }
            } catch (imageError) {
              console.error('Image upload error:', imageError);
              toast.warning(`Warning: Failed to add image ${i + 1}`);
            }
          }
        }
      }

      // Create variants if any
      if (variants.length > 0) {
        for (let i = 0; i < variants.length; i++) {
          const variant = variants[i];
          if (variant.name.trim()) {
            try {
              const variantResponse = await fetch(`/api/products/${productId}/variants`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  productId,
                  name: variant.name.trim(),
                  price: variant.price,
                  stockQuantity: variant.stockQuantity,
                }),
              });

              if (!variantResponse.ok) {
                const errorData = await variantResponse.json();
                toast.warning(`Warning: Failed to create variant "${variant.name}": ${errorData.error}`);
              }
            } catch (variantError) {
              console.error('Variant creation error:', variantError);
              toast.warning(`Warning: Failed to create variant "${variant.name}"`);
            }
          }
        }
      }

      // Create bulk pricing if any
      if (bulkPricing.length > 0) {
        for (let i = 0; i < bulkPricing.length; i++) {
          const pricing = bulkPricing[i];
          if (pricing.minQuantity > 0 && pricing.price > 0) {
            try {
              const pricingResponse = await fetch('/api/admin/bulk-pricing', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  productId,
                  minQuantity: pricing.minQuantity,
                  price: pricing.price,
                }),
              });

              if (!pricingResponse.ok) {
                const errorData = await pricingResponse.json();
                toast.warning(`Warning: Failed to create bulk pricing tier: ${errorData.error}`);
              }
            } catch (pricingError) {
              console.error('Bulk pricing creation error:', pricingError);
              toast.warning('Warning: Failed to create bulk pricing tier');
            }
          }
        }
      }

      toast.success('Product created successfully!');
      router.push('/admin');
    } catch (error: any) {
      console.error('Failed to create product:', error);
      toast.error(error.message || 'Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push('/admin')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-4xl font-bold">Create Product</h1>
          <p className="text-muted-foreground mt-2">Add a new product to your marketplace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Product details and pricing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter product name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Product description"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Base Price * ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="stockQuantity">Stock Quantity</Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    min="0"
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mainCategory">Category *</Label>
                  <Select value={formData.mainCategory} onValueChange={(v) => setFormData({ ...formData, mainCategory: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAIN_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Brand name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="volume">Volume/Size</Label>
                <Input
                  id="volume"
                  value={formData.volume}
                  onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                  placeholder="e.g., 1g, 0.5g, 100mg"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="isLocalOnly">Local Only Product</Label>
                  <p className="text-sm text-muted-foreground">Only visible to users with local access</p>
                </div>
                <Switch
                  id="isLocalOnly"
                  checked={formData.isLocalOnly}
                  onCheckedChange={(checked) => setFormData({ ...formData, isLocalOnly: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Product Images */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Product Images</CardTitle>
                  <CardDescription>Add multiple images (URL or file upload)</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addImageUrl}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Image
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {productImages.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No images added</p>
              ) : (
                <div className="space-y-4">
                  {productImages.map((image, index) => (
                    <div key={index} className="flex gap-4 items-start p-4 border rounded-lg">
                      {image.url && (
                        <div className="relative w-20 h-20 flex-shrink-0">
                          <img
                            src={image.url}
                            alt={`Product ${index + 1}`}
                            className="w-full h-full object-cover rounded"
                          />
                          {image.isPrimary && (
                            <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
                              <Star className="h-3 w-3" fill="currentColor" />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex-1 space-y-3">
                        <div>
                          <Label>Image URL</Label>
                          <Input
                            value={image.url}
                            onChange={(e) => updateImageUrl(index, e.target.value)}
                            placeholder="https://example.com/image.jpg"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`file-${index}`} className="cursor-pointer">
                            <div className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-accent">
                              <Upload className="h-4 w-4" />
                              <span className="text-sm">Or Upload File</span>
                            </div>
                          </Label>
                          <Input
                            id={`file-${index}`}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageFileUpload(index, e.target.files?.[0] || null)}
                            className="hidden"
                          />
                          {!image.isPrimary && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setImageAsPrimary(index)}
                            >
                              <Star className="h-4 w-4 mr-1" />
                              Set as Primary
                            </Button>
                          )}
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeImage(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Variants */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Product Variants</CardTitle>
                  <CardDescription>Add different options (flavors, strains, colors, etc.)</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Variant
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {variants.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No variants added</p>
              ) : (
                <div className="space-y-4">
                  {variants.map((variant, index) => (
                    <div key={index} className="flex gap-4 items-start p-4 border rounded-lg">
                      <div className="flex-1 grid grid-cols-3 gap-4">
                        <div>
                          <Label>Variant Name</Label>
                          <Input
                            value={variant.name}
                            onChange={(e) => updateVariant(index, 'name', e.target.value)}
                            placeholder="e.g., Blue Dream, Large"
                          />
                        </div>
                        <div>
                          <Label>Price ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={variant.price}
                            onChange={(e) => updateVariant(index, 'price', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label>Stock</Label>
                          <Input
                            type="number"
                            min="0"
                            value={variant.stockQuantity}
                            onChange={(e) => updateVariant(index, 'stockQuantity', parseInt(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(index)} className="mt-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bulk Pricing */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Bulk Pricing</CardTitle>
                  <CardDescription>Discounted prices for quantity purchases</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addBulkPricing}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Tier
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {bulkPricing.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No bulk pricing tiers added</p>
              ) : (
                <div className="space-y-4">
                  {bulkPricing.map((pricing, index) => (
                    <div key={index} className="flex gap-4 items-start p-4 border rounded-lg">
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div>
                          <Label>Minimum Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            value={pricing.minQuantity}
                            onChange={(e) => updateBulkPricing(index, 'minQuantity', parseInt(e.target.value) || 3)}
                            placeholder="3"
                          />
                        </div>
                        <div>
                          <Label>Price per Unit ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={pricing.price}
                            onChange={(e) => updateBulkPricing(index, 'price', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeBulkPricing(index)} className="mt-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={() => router.push('/admin')} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Product'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}