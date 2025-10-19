'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { X, Package, Sparkles, Filter as FilterIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface FiltersPanelProps {
  selectedBrands: string[];
  onBrandsChange: (brands: string[]) => void;
  selectedVolumes: string[];
  onVolumesChange: (volumes: string[]) => void;
  showOutOfStock: boolean;
  onShowOutOfStockChange: (value: boolean) => void;
  showLocalOnly: boolean;
  onShowLocalOnlyChange: (value: boolean) => void;
  userHasLocalAccess: boolean;
  onClose?: () => void;
}

export default function FiltersPanel({
  selectedBrands,
  onBrandsChange,
  selectedVolumes,
  onVolumesChange,
  showOutOfStock,
  onShowOutOfStockChange,
  showLocalOnly,
  onShowLocalOnlyChange,
  userHasLocalAccess,
  onClose,
}: FiltersPanelProps) {
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableVolumes, setAvailableVolumes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFilters();
  }, []);

  const fetchFilters = async () => {
    try {
      const response = await fetch('/api/products/filters');
      const data = await response.json();
      setAvailableBrands(data.brands || []);
      setAvailableVolumes(data.volumes || []);
    } catch (error) {
      console.error('Failed to fetch filters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrandToggle = (brand: string) => {
    if (selectedBrands.includes(brand)) {
      onBrandsChange(selectedBrands.filter(b => b !== brand));
    } else {
      onBrandsChange([...selectedBrands, brand]);
    }
  };

  const handleVolumeToggle = (volume: string) => {
    if (selectedVolumes.includes(volume)) {
      onVolumesChange(selectedVolumes.filter(v => v !== volume));
    } else {
      onVolumesChange([...selectedVolumes, volume]);
    }
  };

  const clearAllFilters = () => {
    onBrandsChange([]);
    onVolumesChange([]);
    onShowOutOfStockChange(false);
    onShowLocalOnlyChange(false);
  };

  const activeFiltersCount = 
    selectedBrands.length +
    selectedVolumes.length +
    (showOutOfStock ? 1 : 0) +
    (showLocalOnly ? 1 : 0);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <FilterIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Filters</h2>
            {activeFiltersCount > 0 && (
              <p className="text-sm text-muted-foreground">{activeFiltersCount} active filter{activeFiltersCount !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-6">
        <div className="space-y-6 py-6">
          {/* Local Products Option */}
          {userHasLocalAccess && (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <Label className="text-base font-semibold text-foreground">Local Products</Label>
                </div>
                <Card className="p-4 bg-muted/50 border-border/50">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="show-local-only"
                      checked={showLocalOnly}
                      onCheckedChange={(checked) => onShowLocalOnlyChange(checked === true)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="show-local-only"
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        Show Local Products Only
                      </label>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Products available for local pickup
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
              <Separator />
            </>
          )}

          {/* Stock Availability */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <Label className="text-base font-semibold text-foreground">Stock Availability</Label>
            </div>
            <Card className="p-4 bg-muted/50 border-border/50">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="show-out-of-stock"
                  checked={showOutOfStock}
                  onCheckedChange={(checked) => onShowOutOfStockChange(checked === true)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <label
                    htmlFor="show-out-of-stock"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Include Out of Stock Items
                  </label>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    By default, only in-stock items are shown
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Separator />

          {/* Brand Filters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold text-foreground">
                Brands
              </Label>
              {selectedBrands.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onBrandsChange([])}
                  className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear ({selectedBrands.length})
                </Button>
              )}
            </div>
            {isLoading ? (
              <Card className="p-4 bg-muted/50 border-border/50">
                <div className="text-sm text-muted-foreground">Loading brands...</div>
              </Card>
            ) : availableBrands.length === 0 ? (
              <Card className="p-4 bg-muted/50 border-border/50">
                <div className="text-sm text-muted-foreground">No brands available</div>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {availableBrands.map((brand) => (
                  <Card
                    key={brand}
                    className={`p-3 cursor-pointer transition-all hover:shadow-sm ${
                      selectedBrands.includes(brand)
                        ? 'bg-primary/5 border-primary/50'
                        : 'bg-card/50 border-border/50 hover:border-border'
                    }`}
                    onClick={() => handleBrandToggle(brand)}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={`brand-${brand}`}
                        checked={selectedBrands.includes(brand)}
                        onCheckedChange={() => handleBrandToggle(brand)}
                      />
                      <label
                        htmlFor={`brand-${brand}`}
                        className="text-sm font-medium leading-none cursor-pointer flex-1"
                      >
                        {brand}
                      </label>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Volume Filters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold text-foreground">
                Volume
              </Label>
              {selectedVolumes.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onVolumesChange([])}
                  className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear ({selectedVolumes.length})
                </Button>
              )}
            </div>
            {isLoading ? (
              <Card className="p-4 bg-muted/50 border-border/50">
                <div className="text-sm text-muted-foreground">Loading volumes...</div>
              </Card>
            ) : availableVolumes.length === 0 ? (
              <Card className="p-4 bg-muted/50 border-border/50">
                <div className="text-sm text-muted-foreground">No volumes available</div>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                {availableVolumes.map((volume) => (
                  <Card
                    key={volume}
                    className={`p-3 cursor-pointer transition-all hover:shadow-sm ${
                      selectedVolumes.includes(volume)
                        ? 'bg-primary/5 border-primary/50'
                        : 'bg-card/50 border-border/50 hover:border-border'
                    }`}
                    onClick={() => handleVolumeToggle(volume)}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={`volume-${volume}`}
                        checked={selectedVolumes.includes(volume)}
                        onCheckedChange={() => handleVolumeToggle(volume)}
                      />
                      <label
                        htmlFor={`volume-${volume}`}
                        className="text-sm font-medium leading-none cursor-pointer flex-1"
                      >
                        {volume}
                      </label>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      {activeFiltersCount > 0 && (
        <div className="p-6 border-t bg-muted/30">
          <Button
            onClick={clearAllFilters}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Clear All Filters
          </Button>
        </div>
      )}
    </div>
  );
}