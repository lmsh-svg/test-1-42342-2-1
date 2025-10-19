'use client';

import { useState } from 'react';
import { Star, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface WriteReviewProps {
  productId: number;
  userId: number;
  onReviewSubmitted: () => void;
}

export function WriteReview({ productId, userId, onReviewSubmitted }: WriteReviewProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter a review title');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          rating,
          title: title.trim(),
          comment: comment.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'DUPLICATE_REVIEW') {
          toast.error('You have already reviewed this product');
        } else {
          toast.error(data.error || 'Failed to submit review');
        }
        return;
      }

      toast.success('Review submitted successfully! You earned 10 reward points.');
      setRating(0);
      setTitle('');
      setComment('');
      onReviewSubmitted();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-xl font-semibold mb-4">Write a Review</h3>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Rating */}
        <div className="space-y-2">
          <Label>Rating *</Label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`h-8 w-8 ${
                    star <= (hoverRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-sm text-muted-foreground">
                {rating} out of 5 stars
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Review Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sum up your experience in a few words"
            maxLength={200}
            required
          />
          <p className="text-xs text-muted-foreground">
            {title.length}/200 characters
          </p>
        </div>

        {/* Comment */}
        <div className="space-y-2">
          <Label htmlFor="comment">Review (Optional)</Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your thoughts about this product..."
            rows={5}
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground">
            {comment.length}/2000 characters
          </p>
        </div>

        {/* Rewards Info */}
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm font-medium mb-1">Earn Rewards!</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• 10 points for submitting a review</li>
            <li>• 5 bonus points for adding photos (coming soon)</li>
            <li>• Climb reward tiers: Bronze → Silver → Gold → Platinum</li>
          </ul>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={submitting || rating === 0 || !title.trim()}
          className="w-full"
        >
          {submitting ? 'Submitting...' : 'Submit Review'}
        </Button>
      </form>
    </Card>
  );
}