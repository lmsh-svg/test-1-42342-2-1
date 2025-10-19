'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Save, Trash2, Plus, Star, Package, User } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  mainCategory: string;
  subCategory: string | null;
  brand: string | null;
  volume: string | null;
  stockQuantity: number;
  isAvailable: boolean;
  isLocalOnly: boolean;
}

interface Review {
  id: number;
  userId: number;
  userName: string;
  rating: number;
  comment: string | null;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

const CATEGORIES = [
  'Cartridges', 'Disposables', 'Concentrates', 'Edibles',
  'Flower', 'Pre Rolls', 'Accessories', 'Topicals', 'BYOB', 'Other'
];

export default function AdminProductEditPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { user, isLoading: authLoading } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addReviewDialogOpen, setAddReviewDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    imageUrl: '',
    mainCategory: 'Other',
    subCategory: '',
    brand: '',
    volume: '',
    stockQuantity: '',
    isAvailable: true,
    isLocalOnly: false,
  });

  // Review form state
  const [reviewForm, setReviewForm] = useState({
    userId: '',
    rating: 5,
    comment: '',
    isVerifiedPurchase: false,
  });

  useEffect(() => {
    if (!authLoading && user?.role !== 'admin') {
      router.push('/marketplace');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchProduct();
      fetchReviews();
      fetchUsers();
    }
  }, [user, productId]);

  const fetchProduct = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/products?id=${productId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setProduct(data);
        setFormData({
          name: data.name,
          description: data.description || '',
          price: data.price.toString(),
          imageUrl: data.imageUrl || '',
          mainCategory: data.mainCategory,
          subCategory: data.subCategory || '',
          brand: data.brand || '',
          volume: data.volume || '',
          stockQuantity: data.stockQuantity.toString(),
          isAvailable: data.isAvailable,
          isLocalOnly: data.isLocalOnly,
        });
      } else {
        alert('Failed to fetch product');
        router.push('/admin/products');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      alert('Failed to fetch product');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/products/${productId}/reviews`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setReviews(data);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/users?limit=1000', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/products?id=${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          price: parseFloat(formData.price),
          imageUrl: formData.imageUrl || null,
          mainCategory: formData.mainCategory,
          subCategory: formData.subCategory || null,
          brand: formData.brand || null,
          volume: formData.volume || null,
          stockQuantity: parseInt(formData.stockQuantity),
          isAvailable: formData.isAvailable,
          isLocalOnly: formData.isLocalOnly,
        }),
      });

      if (response.ok) {
        alert('Product updated successfully!');
        fetchProduct();
      } else {
        const data = await response.json();
        alert(`Failed to update product: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Failed to update product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/products?id=${productId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (response.ok) {
        alert('Product deleted successfully!');
        router.push('/admin/products');
      } else {
        const data = await response.json();
        alert(`Failed to delete product: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleAddReview = async () => {
    if (!reviewForm.userId || !reviewForm.comment) {
      alert('Please select a user and enter a comment');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: parseInt(reviewForm.userId),
          rating: reviewForm.rating,
          comment: reviewForm.comment,
          isVerifiedPurchase: reviewForm.isVerifiedPurchase,
        }),
      });

      if (response.ok) {
        alert('Review added successfully!');
        setAddReviewDialogOpen(false);
        setReviewForm({
          userId: '',
          rating: 5,
          comment: '',
          isVerifiedPurchase: false,
        });
        fetchReviews();
      } else {
        const data = await response.json();
        alert(`Failed to add review: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding review:', error);
      alert('Failed to add review');
    }
  };

  const anonymizeName = (name: string): string => {
    if (!name || name.length === 0) return '?';
    if (name.length === 1) return name[0];
    return name.substring(0, 2) + '•'.repeat(Math.max(0, name.length - 2));
  };

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

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Product not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/products')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Edit Product</h1>
              <p className="text-muted-foreground">Product ID: {productId}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Product
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Details Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Product Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter product name"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter product description"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Price ($) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label htmlFor="stockQuantity">Stock Quantity *</Label>
                    <Input
                      id="stockQuantity"
                      type="number"
                      value={formData.stockQuantity}
                      onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input
                    id="imageUrl"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                  {formData.imageUrl && (
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="mt-2 h-32 w-32 object-cover rounded border"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mainCategory">Main Category *</Label>
                    <Select
                      value={formData.mainCategory}
                      onValueChange={(value) => setFormData({ ...formData, mainCategory: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="subCategory">Sub Category</Label>
                    <Input
                      id="subCategory"
                      value={formData.subCategory}
                      onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="brand">Brand</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <Label htmlFor="volume">Volume/Size</Label>
                    <Input
                      id="volume"
                      value={formData.volume}
                      onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                      placeholder="e.g., 1g, 2ml"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isAvailable}
                      onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Available for purchase</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isLocalOnly}
                      onChange={(e) => setFormData({ ...formData, isLocalOnly: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Local pickup only</span>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Reviews Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Reviews ({reviews.length})</CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setAddReviewDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Review
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {reviews.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No reviews yet. Add a review to get started.
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead>Comment</TableHead>
                          <TableHead>Verified</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reviews.map((review) => (
                          <TableRow key={review.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono">
                                  {anonymizeName(review.userName)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-4 w-4 ${
                                      i < review.rating
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {review.comment}
                            </TableCell>
                            <TableCell>
                              {review.isVerifiedPurchase && (
                                <Badge variant="secondary">Verified</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Product Preview */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Product Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.imageUrl ? (
                  <img
                    src={formData.imageUrl}
                    alt={formData.name}
                    className="w-full h-48 object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-48 bg-muted rounded flex items-center justify-center">
                    <Package className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold">{formData.name || 'Product Name'}</h3>
                  <p className="text-2xl font-bold text-primary mt-2">
                    ${formData.price || '0.00'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge>{formData.mainCategory}</Badge>
                  {formData.brand && <Badge variant="secondary">{formData.brand}</Badge>}
                  {formData.volume && <Badge variant="outline">{formData.volume}</Badge>}
                </div>

                <div className="pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stock:</span>
                    <span className="font-medium">{formData.stockQuantity || 0} units</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={formData.isAvailable ? 'default' : 'secondary'}>
                      {formData.isAvailable ? 'Available' : 'Unavailable'}
                    </Badge>
                  </div>
                  {formData.isLocalOnly && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pickup:</span>
                      <Badge variant="outline">Local Only</Badge>
                    </div>
                  )}
                </div>

                {formData.description && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {formData.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{product.name}"? This action cannot be undone.
              All associated reviews, variants, and images will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Review Dialog */}
      <Dialog open={addReviewDialogOpen} onOpenChange={setAddReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Manual Review</DialogTitle>
            <DialogDescription>
              Add a review on behalf of a user. The username will be automatically anonymized
              to show only the first 1-2 characters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="reviewUserId">Select User *</Label>
              <Select
                value={reviewForm.userId}
                onValueChange={(value) => setReviewForm({ ...reviewForm, userId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.name} ({u.email}) - Will show as: {anonymizeName(u.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="reviewRating">Rating *</Label>
              <Select
                value={reviewForm.rating.toString()}
                onValueChange={(value) => setReviewForm({ ...reviewForm, rating: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <SelectItem key={rating} value={rating.toString()}>
                      {rating} Star{rating !== 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="reviewComment">Comment *</Label>
              <Textarea
                id="reviewComment"
                value={reviewForm.comment}
                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                placeholder="Enter review comment..."
                rows={4}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reviewForm.isVerifiedPurchase}
                onChange={(e) =>
                  setReviewForm({ ...reviewForm, isVerifiedPurchase: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm">Mark as verified purchase</span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddReviewDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddReview}>Add Review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}