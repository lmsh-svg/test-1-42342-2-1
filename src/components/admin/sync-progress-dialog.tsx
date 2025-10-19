'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface SyncProgress {
  stage: 'fetching' | 'parsing' | 'processing' | 'complete' | 'error';
  totalProducts: number;
  processedProducts: number;
  createdProducts: number;
  updatedProducts: number;
  currentProduct?: {
    name: string;
    category: string;
    action: 'create' | 'update';
  };
  errors: string[];
  warnings: string[];
  message: string;
}

interface SyncProgressDialogProps {
  open: boolean;
  configId: number | null;
  configName: string;
  onClose: () => void;
}

export function SyncProgressDialog({ open, configId, configName, onClose }: SyncProgressDialogProps) {
  const [progress, setProgress] = useState<SyncProgress>({
    stage: 'fetching',
    totalProducts: 0,
    processedProducts: 0,
    createdProducts: 0,
    updatedProducts: 0,
    errors: [],
    warnings: [],
    message: 'Initializing sync...',
  });

  useEffect(() => {
    if (!open || !configId) return;

    const pollProgress = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/admin/api-configs/${configId}/sync-progress`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setProgress(data);
        }
      } catch (error) {
        console.error('Failed to fetch sync progress:', error);
      }
    };

    // Initial fetch
    pollProgress();

    // Poll every 500ms for updates
    const interval = setInterval(pollProgress, 500);

    return () => clearInterval(interval);
  }, [open, configId]);

  const progressPercentage = progress.totalProducts > 0 
    ? Math.round((progress.processedProducts / progress.totalProducts) * 100)
    : 0;

  const getStageIcon = () => {
    switch (progress.stage) {
      case 'complete':
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'error':
        return <XCircle className="h-6 w-6 text-red-500" />;
      default:
        return <Loader2 className="h-6 w-6 animate-spin text-blue-500" />;
    }
  };

  const getStageLabel = () => {
    switch (progress.stage) {
      case 'fetching':
        return 'Fetching data...';
      case 'parsing':
        return 'Parsing products...';
      case 'processing':
        return 'Processing products...';
      case 'complete':
        return 'Sync completed successfully!';
      case 'error':
        return 'Sync failed';
      default:
        return 'Processing...';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && progress.stage === 'complete' && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStageIcon()}
            Syncing: {configName}
          </DialogTitle>
          <DialogDescription>
            {getStageLabel()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {progress.processedProducts} / {progress.totalProducts} products
              </span>
              <span className="text-sm text-muted-foreground">
                {progressPercentage}%
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">
                {progress.createdProducts}
              </div>
              <div className="text-xs text-muted-foreground">Created</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">
                {progress.updatedProducts}
              </div>
              <div className="text-xs text-muted-foreground">Updated</div>
            </div>
          </div>

          {/* Current Product */}
          {progress.currentProduct && progress.stage === 'processing' && (
            <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-950">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Currently Processing:</span>
                <Badge variant={progress.currentProduct.action === 'create' ? 'default' : 'outline'}>
                  {progress.currentProduct.action}
                </Badge>
              </div>
              <p className="text-sm font-semibold">{progress.currentProduct.name}</p>
              <p className="text-xs text-muted-foreground">
                Category: {progress.currentProduct.category}
              </p>
            </div>
          )}

          {/* Status Message */}
          <div className="text-sm text-muted-foreground">
            {progress.message}
          </div>

          {/* Warnings */}
          {progress.warnings.length > 0 && (
            <div className="border border-orange-200 rounded-lg p-3 bg-orange-50 dark:bg-orange-950">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-600">
                  Warnings ({progress.warnings.length})
                </span>
              </div>
              <ScrollArea className="h-24">
                <div className="space-y-1">
                  {progress.warnings.map((warning, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground">
                      • {warning}
                    </p>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Errors */}
          {progress.errors.length > 0 && (
            <div className="border border-red-200 rounded-lg p-3 bg-red-50 dark:bg-red-950">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-semibold text-red-600">
                  Errors ({progress.errors.length})
                </span>
              </div>
              <ScrollArea className="h-24">
                <div className="space-y-1">
                  {progress.errors.map((error, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground">
                      • {error}
                    </p>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Actions */}
          {(progress.stage === 'complete' || progress.stage === 'error') && (
            <div className="flex justify-end">
              <Button onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}