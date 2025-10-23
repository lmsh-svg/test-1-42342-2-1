'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, CheckCircle2, AlertCircle, Loader2, Package, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { parseProducts, extractProductsFromAPI, type ParsedProduct } from '@/lib/product-api-parser';

interface ProductJSONSyncProps {
  apiConfigId?: number;
  onSyncComplete?: () => void;
}

export function ProductJSONSync({ apiConfigId, onSyncComplete }: ProductJSONSyncProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResults, setParseResults] = useState<ParsedProduct[] | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
  } | null>(null);
  const [syncResults, setSyncResults] = useState<{
    productsCreated: number;
    productsUpdated: number;
    tiersCreated: number;
    imagesCreated: number;
    variantsCreated?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Please upload a JSON file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
      toast.success(`Loaded ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleParseJSON = () => {
    setError(null);
    setParseResults(null);
    setSyncResults(null);

    try {
      const parsed = JSON.parse(jsonInput);
      
      const extractedData = extractProductsFromAPI(parsed);

      if (extractedData.length === 0) {
        throw new Error('No products found. Make sure your JSON has a "data" array with nested "products" arrays.');
      }

      const parsedProducts = parseProducts(extractedData);
      
      if (parsedProducts.length === 0) {
        throw new Error('Parsing failed - no valid products extracted.');
      }
      
      setParseResults(parsedProducts);
      
      const totalVariants = parsedProducts.reduce((sum, p) => sum + p.variants.length, 0);
      toast.success(
        `✅ Parsed ${parsedProducts.length} products with ${totalVariants} variants!`
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid JSON format';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleSyncToDatabase = async () => {
    if (!parseResults) {
      toast.error('Please parse the JSON first');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSyncProgress({ current: 0, total: parseResults.length, percentage: 0 });

    try {
      let batchIndex = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalTiers = 0;
      let totalImages = 0;
      let totalVariants = 0;
      let hasMore = true;

      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

      // Process in batches
      while (hasMore) {
        const requestBody: any = {
          products: parseResults,
          batchIndex,
        };

        if (apiConfigId) {
          requestBody.apiConfigId = apiConfigId;
        }

        const response = await fetch('/api/admin/api-configs/sync-from-json', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(requestBody),
        });

        const contentType = response.headers.get('Content-Type') || '';
        let data: any;

        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          console.error('Non-JSON response from server:', text.substring(0, 500));
          throw new Error('Server error: Request timed out. The batch processing system should prevent this. Please contact support.');
        }

        if (!response.ok) {
          throw new Error(data.error || 'Sync failed');
        }

        // Update totals
        totalCreated += data.productsCreated;
        totalUpdated += data.productsUpdated;
        totalTiers += data.tiersCreated;
        totalImages += data.imagesCreated;
        totalVariants += data.variantsCreated || 0;

        // Update progress
        if (data.progress) {
          setSyncProgress({
            current: data.progress.processed,
            total: data.progress.total,
            percentage: data.progress.percentage
          });
        }

        hasMore = data.hasMore;
        batchIndex = data.nextBatchIndex || batchIndex + 1;

        // Show batch completion
        toast.success(data.message);
      }

      // Final results
      setSyncResults({
        productsCreated: totalCreated,
        productsUpdated: totalUpdated,
        tiersCreated: totalTiers,
        imagesCreated: totalImages,
        variantsCreated: totalVariants,
      });

      toast.success(
        `🎉 Complete! ${totalCreated + totalUpdated} products synced ` +
        `(${totalVariants} variants, ${totalTiers} tiers)`
      );

      // Clear form
      setJsonInput('');
      setParseResults(null);
      setSyncProgress(null);
      
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMessage);
      toast.error(errorMessage);
      setSyncProgress(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const getCategoryStats = () => {
    if (!parseResults) return {};
    
    const stats: Record<string, number> = {};
    parseResults.forEach(product => {
      stats[product.mainCategory] = (stats[product.mainCategory] || 0) + 1;
    });
    
    return stats;
  };

  const categoryStats = getCategoryStats();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Product Import from JSON</CardTitle>
          <CardDescription>
            Upload your Product API JSON file or paste it below. The system will automatically:
          </CardDescription>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
            <li><strong>Process in batches</strong> (handles 1,000+ products without timeout)</li>
            <li><strong>Group variants by parent product</strong> (colors, flavors, strains)</li>
            <li><strong>Use API categories when provided</strong> (respects "cat" field)</li>
            <li><strong>Extract all pricing tiers</strong> (1+, 5+, 10+, etc.)</li>
          </ul>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* FILE UPLOAD BUTTON */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <FileJson className="h-4 w-4 mr-2" />
              Upload JSON File
            </Button>
            <span className="text-sm text-muted-foreground flex items-center">
              or paste JSON below
            </span>
          </div>

          <Textarea
            placeholder='Paste your full Product API JSON here...'
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="font-mono text-xs min-h-[300px]"
            disabled={isProcessing}
          />

          <div className="flex gap-2">
            <Button
              onClick={handleParseJSON}
              disabled={!jsonInput.trim() || isProcessing}
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-2" />
              Parse & Preview
            </Button>

            {parseResults && (
              <Button
                onClick={handleSyncToDatabase}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Sync to Database
                  </>
                )}
              </Button>
            )}
          </div>

          {/* PROGRESS BAR */}
          {syncProgress && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Syncing products...</span>
                    <span className="text-muted-foreground">
                      {syncProgress.current} / {syncProgress.total} ({syncProgress.percentage}%)
                    </span>
                  </div>
                  <Progress value={syncProgress.percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Processing in batches to avoid timeouts. Please wait...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {syncResults && !isProcessing && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">✅ Sync Complete!</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                  <div>Created: <strong>{syncResults.productsCreated}</strong></div>
                  <div>Updated: <strong>{syncResults.productsUpdated}</strong></div>
                  <div>Variants: <strong>{syncResults.variantsCreated || 0}</strong></div>
                  <div>Tiers: <strong>{syncResults.tiersCreated}</strong></div>
                  <div>Images: <strong>{syncResults.imagesCreated}</strong></div>
                </div>
                <div className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
                  ✅ Products are now live in the marketplace!
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {parseResults && (
        <Card>
          <CardHeader>
            <CardTitle>Parse Preview ({parseResults.length} products)</CardTitle>
            <CardDescription>
              {parseResults.reduce((sum, p) => sum + p.variants.length, 0)} total variants across all products
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category Statistics */}
            <div>
              <h3 className="font-semibold mb-2">Category Breakdown:</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(categoryStats).map(([category, count]) => (
                  <Badge key={category} variant="secondary">
                    {category}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Product List */}
            <div className="space-y-2">
              <h3 className="font-semibold">Products Preview (first 20):</h3>
              <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                {parseResults.slice(0, 20).map((product, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <p className="font-semibold text-sm truncate">{product.name}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {product.mainCategory}
                          </Badge>
                          {product.brand && (
                            <span className="text-xs">Brand: {product.brand}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-primary">
                          ${product.price.toFixed(2)}
                        </div>
                        {product.pricingTiers.length > 0 && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {product.pricingTiers.length} tiers
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Variants */}
                    {product.variants.length > 0 && (
                      <div className="pl-6 text-xs space-y-1">
                        <p className="font-medium text-muted-foreground">
                          Variants ({product.variants.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {product.variants.slice(0, 10).map((variant, vIndex) => (
                            <Badge key={vIndex} variant="outline" className="text-xs">
                              {variant.variantName}
                              {variant.priceModifier > 0 && ` (+$${variant.priceModifier.toFixed(2)})`}
                            </Badge>
                          ))}
                          {product.variants.length > 10 && (
                            <Badge variant="outline" className="text-xs">
                              +{product.variants.length - 10} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Pricing Tiers */}
                    {product.pricingTiers.length > 0 && (
                      <div className="pl-6 text-xs space-y-1">
                        <p className="font-medium text-muted-foreground">Pricing Tiers:</p>
                        <div className="flex flex-wrap gap-2">
                          {product.pricingTiers.map((tier, tierIndex) => (
                            <Badge key={tierIndex} variant="outline" className="text-xs">
                              {tier.quantityLabel} → ${tier.price.toFixed(2)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {parseResults.length > 20 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    ... and {parseResults.length - 20} more products
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}