'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
      
      // Extract products from your API structure
      const extractedData = extractProductsFromAPI(parsed);

      if (extractedData.length === 0) {
        throw new Error('No products found. Make sure your JSON has a "data" array with nested "products" arrays.');
      }

      // Parse products with proper categorization and variant grouping
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

    try {
      const requestBody: any = {
        products: parseResults,
      };

      // apiConfigId is optional - if not provided, products are marked as manual
      if (apiConfigId) {
        requestBody.apiConfigId = apiConfigId;
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

      const response = await fetch('/api/admin/api-configs/sync-from-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(requestBody),
      });

      // CRITICAL FIX: Handle non-JSON responses (HTML error pages, timeouts, etc.)
      const contentType = response.headers.get('Content-Type') || '';
      let data: any;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // Server returned HTML or plain text (error page, timeout, etc.)
        const text = await response.text();
        console.error('Non-JSON response from server:', text.substring(0, 500));
        throw new Error('Server error: Request timed out or returned invalid response. Please try with fewer products or check your API JSON format.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      setSyncResults(data);
      toast.success(
        `🎉 Success! ${data.productsCreated + data.productsUpdated} products synced ` +
        `(${data.variantsCreated || 0} variants, ${data.tiersCreated} tiers)`
      );

      // Clear form
      setJsonInput('');
      setParseResults(null);
      
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
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
          <CardTitle>Product Import from JSON</CardTitle>
          <CardDescription>
            Upload your Product API JSON file or paste it below. The system will automatically:
          </CardDescription>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
            <li><strong>Group variants by parent product</strong> (colors, flavors, strains)</li>
            <li><strong>Use API categories when provided</strong> (respects "cat" field)</li>
            <li><strong>Extract all pricing tiers</strong> (1+, 5+, 10+, etc.)</li>
            <li><strong>Works standalone</strong> (no API configuration needed)</li>
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
            placeholder='Paste your full Product API JSON here...

Your API format is supported:
{
  "lastUpdated": 1760931539308,
  "data": [
    {
      "name": "4th Gen 510 Thread Battery",
      "brand": "Dime",
      "cat": "Accessories",
      "products": [
        { "name": "Black", "id": 3025, "price": 16.99, "tiers": [...] },
        { "name": "Red", "id": 3024, "price": 16.99 },
        { "name": "White", "id": 3026, "price": 14.99 }
      ]
    }
  ]
}'
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
              <h3 className="font-semibold">Products Preview:</h3>
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
                              {variant.priceModifier > 0 && ` (+$${variant.priceModifier.toFixed(2)})`}
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