'use client';

import { useState, useEffect } from 'react';
import { Star, ThumbsUp, Shield, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Review {
  id: number;
  rating: number;
  title: string;
  comment: string | null;
  isVerified: boolean;
  helpfulCount: number;
  createdAt: string;
  user: {
    username: string;
  };
  rewardTier: {
    tierName: string;
    totalReviews: number;
    rewardPoints: number;
  };
  images: Array<{
    id: number;
    imageUrl: string;
    createdAt: string;
  }>;
}

interface ProductReviewsProps {
  productId: number;
}

export function ProductReviews({ productId }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    fetchReviews();
  }, [productId, selectedRating, sortBy]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: '50',
        sortBy,
        order: 'desc'
      });
      
      if (selectedRating) {
        params.append('rating', selectedRating.toString());
      }

      const response = await fetch(`/api/products/${productId}/reviews?${params}`);
      if (!response.ok) throw new Error('Failed to fetch reviews');
      
      const data = await response.json();
      setReviews(data.reviews);
      setAverageRating(data.averageRating);
      setTotalReviews(data.totalReviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkHelpful = async (reviewId: number) => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/helpful`, {
        method: 'POST',
      });
      
      if (response.ok) {
        fetchReviews();
      }
    } catch (error) {
      console.error('Error marking review as helpful:', error);
    }
  };

  const getTierColor = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'platinum': return 'bg-blue-500';
      case 'gold': return 'bg-yellow-500';
      case 'silver': return 'bg-gray-400';
      default: return 'bg-orange-600';
    }
  };

  const getTierTextColor = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'platinum': return 'text-blue-600 dark:text-blue-400';
      case 'gold': return 'text-yellow-600 dark:text-yellow-400';
      case 'silver': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-orange-600 dark:text-orange-400';
    }
  };

  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => {
    const count = reviews.filter(r => r.rating === rating).length;
    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
    return { rating, count, percentage };
  });

  if (loading) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">Loading reviews...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rating Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">{averageRating.toFixed(1)}</div>
            <div className="flex items-center justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-5 w-5 ${
                    star <= Math.round(averageRating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            {ratingDistribution.map(({ rating, count, percentage }) => (
              <div key={rating} className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedRating(selectedRating === rating ? null : rating)}
                  className={`text-sm w-16 text-left hover:underline ${
                    selectedRating === rating ? 'font-bold' : ''
                  }`}
                >
                  {rating} star
                </button>
                <Progress value={percentage} className="flex-1 h-2" />
                <span className="text-sm text-muted-foreground w-12 text-right">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="date">Most Recent</option>
          <option value="helpful">Most Helpful</option>
          <option value="rating">Highest Rating</option>
        </select>
        
        {selectedRating && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedRating(null)}
          >
            Clear Filter
          </Button>
        )}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {selectedRating
                ? `No ${selectedRating}-star reviews yet`
                : 'No reviews yet. Be the first to review this product!'}
            </p>
          </Card>
        ) : (
          reviews.map((review) => (
            <Card key={review.id} className="p-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= review.rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    {review.isVerified && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Verified Purchase
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Title */}
                <h4 className="font-semibold text-lg">{review.title}</h4>

                {/* Comment */}
                {review.comment && (
                  <p className="text-muted-foreground">{review.comment}</p>
                )}

                {/* Images */}
                {review.images.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {review.images.map((image) => (
                      <div
                        key={image.id}
                        className="w-20 h-20 rounded-md overflow-hidden border"
                      >
                        <img
                          src={image.imageUrl}
                          alt="Review"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {review.user.username}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getTierTextColor(review.rewardTier.tierName)}`}
                      >
                        {review.rewardTier.tierName}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {review.rewardTier.totalReviews} reviews · {review.rewardTier.rewardPoints} pts
                    </span>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkHelpful(review.id)}
                    className="flex items-center gap-2"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    Helpful ({review.helpfulCount})
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}