'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, CheckCircle2, AlertCircle, Loader2, Package, 
  FileJson, Settings, Edit2, Save, X 
} from 'lucide-react';
import { toast } from 'sonner';
import { parseProductAPI, ParsedProduct } from '@/lib/product-api-parser-v2';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductAPIImportProps {
  onSyncComplete?: () => void;
}

interface ProductCorrection {
  sourceId: string;
  correctedCategory?: string;
  correctedName?: string;
}

export function ProductAPIImportV2({ onSyncComplete }: ProductAPIImportProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [imageProxyDomain, setImageProxyDomain] = useState('https://chadsflooring.bz');
  const [defaultImageSize, setDefaultImageSize] = useState(450);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResults, setParseResults] = useState<ParsedProduct[] | null>(null);
  const [corrections, setCorrections] = useState<Record<string, ProductCorrection>>({});
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
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
    variantsCreated: number;
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
    setCorrections({});

    try {
      const parsed = JSON.parse(jsonInput);
      
      const parsedProducts = parseProductAPI(parsed, imageProxyDomain, defaultImageSize);
      
      if (parsedProducts.length === 0) {
        throw new Error('No products found in JSON. Check the API structure.');
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

  const handleCorrectProduct = (sourceId: string, field: 'category' | 'name', value: string) => {
    setCorrections(prev => ({
      ...prev,
      [sourceId]: {
        ...prev[sourceId],
        sourceId,
        ...(field === 'category' ? { correctedCategory: value } : { correctedName: value })
      }
    }));
  };

  const handleSaveCorrections = async () => {
    if (Object.keys(corrections).length === 0) {
      toast.error('No corrections to save');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/product-corrections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ corrections: Object.values(corrections) }),
      });

      if (!response.ok) {
        throw new Error('Failed to save corrections');
      }

      toast.success(`Saved ${Object.keys(corrections).length} corrections`);
      setEditingProductId(null);
    } catch (err) {
      toast.error('Failed to save corrections');
    }
  };

  const getDisplayCategory = (product: ParsedProduct): string => {
    const correction = corrections[product.sourceId];
    return correction?.correctedCategory || product.mainCategory;
  };

  const getDisplayName = (product: ParsedProduct): string => {
    const correction = corrections[product.sourceId];
    return correction?.correctedName || product.name;
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
      // Apply corrections to parsed results
      const productsToSync = parseResults.map(product => {
        const correction = corrections[product.sourceId];
        if (correction) {
          return {
            ...product,
            mainCategory: correction.correctedCategory || product.mainCategory,
            name: correction.correctedName || product.name,
          };
        }
        return product;
      });

      let batchIndex = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalTiers = 0;
      let totalImages = 0;
      let totalVariants = 0;
      let hasMore = true;

      const token = localStorage.getItem('auth_token');

      // Process in batches
      while (hasMore) {
        const response = await fetch('/api/admin/api-configs/sync-from-json-v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            products: productsToSync,
            batchIndex,
            imageProxyDomain,
          }),
        });

        const contentType = response.headers.get('Content-Type') || '';
        let data: any;

        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          console.error('Non-JSON response:', text.substring(0, 500));
          throw new Error('Server error: Request timed out');
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
      setCorrections({});
      
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
      const category = getDisplayCategory(product);
      stats[category] = (stats[category] || 0) + 1;
    });
    
    return stats;
  };

  const categoryStats = getCategoryStats();
  const availableCategories = Object.keys(categoryStats).sort();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Product Import from API</CardTitle>
          <CardDescription>
            Configure and import products from your Product API JSON
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* IMAGE PROXY CONFIGURATION */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <h3 className="font-semibold text-sm">Image Configuration</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Image Proxy Domain</label>
                <Input
                  placeholder="https://chadsflooring.bz"
                  value={imageProxyDomain}
                  onChange={(e) => setImageProxyDomain(e.target.value)}
                  disabled={isProcessing}
                />
                <p className="text-xs text-muted-foreground">
                  Clearnet proxy domain for image URLs
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Image Size</label>
                <Select
                  value={defaultImageSize.toString()}
                  onValueChange={(val) => setDefaultImageSize(parseInt(val))}
                  disabled={isProcessing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="950">950px</SelectItem>
                    <SelectItem value="750">750px</SelectItem>
                    <SelectItem value="450">450px (Recommended)</SelectItem>
                    <SelectItem value="400">400px</SelectItem>
                    <SelectItem value="300">300px</SelectItem>
                    <SelectItem value="250">250px</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Image size for product cards
                </p>
              </div>
            </div>
          </div>

          {/* FILE UPLOAD */}
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

            {parseResults && Object.keys(corrections).length > 0 && (
              <Button
                onClick={handleSaveCorrections}
                disabled={isProcessing}
                variant="secondary"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Corrections
              </Button>
            )}

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
                  <div>Variants: <strong>{syncResults.variantsCreated}</strong></div>
                  <div>Tiers: <strong>{syncResults.tiersCreated}</strong></div>
                  <div>Images: <strong>{syncResults.imagesCreated}</strong></div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {parseResults && (
        <Card>
          <CardHeader>
            <CardTitle>Preview & Corrections ({parseResults.length} products)</CardTitle>
            <CardDescription>
              Review categories and make corrections before syncing
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

            {/* Product List with Edit */}
            <div className="space-y-2">
              <h3 className="font-semibold">Products (showing first 30):</h3>
              <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
                {parseResults.slice(0, 30).map((product, index) => {
                  const isEditing = editingProductId === product.sourceId;
                  const hasCorrections = !!corrections[product.sourceId];
                  
                  return (
                    <div
                      key={index}
                      className={`border rounded-lg p-3 space-y-2 ${hasCorrections ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'} transition-colors`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Product Name */}
                          {isEditing ? (
                            <Input
                              value={corrections[product.sourceId]?.correctedName || product.name}
                              onChange={(e) => handleCorrectProduct(product.sourceId, 'name', e.target.value)}
                              className="font-semibold"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <p className="font-semibold text-sm">{getDisplayName(product)}</p>
                            </div>
                          )}

                          {/* Category */}
                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <Select
                                value={corrections[product.sourceId]?.correctedCategory || product.mainCategory}
                                onValueChange={(val) => handleCorrectProduct(product.sourceId, 'category', val)}
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={hasCorrections ? "default" : "outline"}>
                                {getDisplayCategory(product)}
                              </Badge>
                            )}
                            {product.brand && <span className="text-xs text-muted-foreground">Brand: {product.brand}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-primary">${product.price.toFixed(2)}</div>
                            {product.variants.length > 0 && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                {product.variants.length} variants
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={isEditing ? "default" : "ghost"}
                            onClick={() => setEditingProductId(isEditing ? null : product.sourceId)}
                          >
                            {isEditing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Variants */}
                      {product.variants.length > 0 && (
                        <div className="pl-6 text-xs space-y-1">
                          <p className="font-medium text-muted-foreground">
                            Variants ({product.variants.length}):
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {product.variants.slice(0, 8).map((variant, vIndex) => (
                              <Badge key={vIndex} variant="outline" className="text-xs">
                                {variant.variantName}
                                {variant.priceModifier > 0 && ` (+$${variant.priceModifier.toFixed(2)})`}
                              </Badge>
                            ))}
                            {product.variants.length > 8 && (
                              <Badge variant="outline" className="text-xs">
                                +{product.variants.length - 8} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {parseResults.length > 30 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    ... and {parseResults.length - 30} more products
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
