'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, CheckCircle2, AlertCircle, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { parseProducts, extractProductsFromAPI, type ParsedProduct } from '@/lib/product-api-parser';

interface ProductJSONSyncProps {
  apiConfigId: number;
  onSyncComplete?: () => void;
}

export function ProductJSONSync({ apiConfigId, onSyncComplete }: ProductJSONSyncProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResults, setParseResults] = useState<ParsedProduct[] | null>(null);
  const [syncResults, setSyncResults] = useState<{
    productsCreated: number;
    productsUpdated: number;
    tiersCreated: number;
    imagesCreated: number;
    variantsCreated?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParseJSON = () => {
    setError(null);
    setParseResults(null);
    setSyncResults(null);

    try {
      const parsed = JSON.parse(jsonInput);
      
      // Extract products with parent/variant structure
      const extractedData = extractProductsFromAPI(parsed);

      if (extractedData.length === 0) {
        throw new Error('No products found in JSON. Make sure your JSON contains either a "data" array with nested "products" arrays, or a flat "products" array.');
      }

      // Parse products with variant support
      const parsedProducts = parseProducts(extractedData);
      
      setParseResults(parsedProducts);
      
      const totalVariants = parsedProducts.reduce((sum, p) => sum + p.variants.length, 0);
      toast.success(
        `Successfully parsed ${parsedProducts.length} products with ${totalVariants} total variants from ${extractedData.length} raw entries`
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse JSON';
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

    try {
      const response = await fetch('/api/admin/api-configs/sync-from-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiConfigId,
          products: parseResults,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync products');
      }

      setSyncResults(data);
      toast.success(
        `Successfully synced ${data.productsCreated + data.productsUpdated} products! ` +
        `(${data.productsCreated} created, ${data.productsUpdated} updated, ` +
        `${data.variantsCreated || 0} variants, ${data.tiersCreated} tiers, ${data.imagesCreated} images)`
      );

      setJsonInput('');
      setParseResults(null);
      
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync products';
      setError(errorMessage);
      toast.error(errorMessage);
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
          <CardTitle>Sync Products from JSON</CardTitle>
          <CardDescription>
            Paste your Product API JSON below. The system will automatically:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Parse parent products with variants</strong> (colors, flavors, strains)</li>
              <li>Assign categories based on tags, description, and brand</li>
              <li>Parse pricing tiers (1+, 3+, 5+, etc.)</li>
              <li>Extract product images</li>
              <li>Store variants in productVariants table</li>
              <li>Sort products alphabetically</li>
            </ul>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder='Paste your Product API JSON here (full API response with data[], lastUpdated, etc.)...'
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="font-mono text-xs min-h-[300px]"
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

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {syncResults && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Sync Complete!</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                  <div>Created: <strong>{syncResults.productsCreated}</strong></div>
                  <div>Updated: <strong>{syncResults.productsUpdated}</strong></div>
                  <div>Variants: <strong>{syncResults.variantsCreated || 0}</strong></div>
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
            <CardTitle>Parse Preview</CardTitle>
            <CardDescription>
              {parseResults.length} products ready to sync
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category Statistics */}
            <div>
              <h3 className="font-semibold mb-2">Categories:</h3>
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
              <h3 className="font-semibold">Products:</h3>
              <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                {parseResults.map((product, index) => (
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
                          {product.volume && (
                            <span className="text-xs">Volume: {product.volume}</span>
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
                          {product.variants.map((variant, vIndex) => (
                            <Badge key={vIndex} variant="outline" className="text-xs">
                              {variant.variantName}
                              {variant.priceModifier !== 0 && ` (+$${variant.priceModifier.toFixed(2)})`}
                            </Badge>
                          ))}
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

                    {/* Images */}
                    {product.images.length > 0 && (
                      <div className="pl-6 text-xs">
                        <p className="text-muted-foreground">
                          {product.images.length} image{product.images.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}