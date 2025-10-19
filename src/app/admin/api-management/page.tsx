'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { AdminTabs } from '@/components/admin/admin-tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Upload, Link as LinkIcon, Eye, RefreshCw, Trash2, Settings, FileJson, FileCode, Package, ImageOff, Combine } from 'lucide-react';
import { SyncProgressDialog } from '@/components/admin/sync-progress-dialog';
import { useInactivityLogout } from '@/hooks/use-inactivity-logout';
import { InactivityWarning } from '@/components/auth/inactivity-warning';

interface ApiConfig {
  id: number;
  name: string;
  type: 'json' | 'html';
  sourceType: 'url' | 'file';
  sourceUrl: string | null;
  sourceContent: string | null;
  isActive: boolean;
  isTestMode: boolean;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number | null;
  lastSyncedAt: string | null;
  loadImages: boolean;
  enableDuplicateMerging: boolean;
  categoryMappingRules: string | null;
  createdAt: string;
}

interface ApiLog {
  id: number;
  configId: number;
  action: string;
  status: string;
  message: string;
  details: string | null;
  productsProcessed: number | null;
  productsCreated: number | null;
  productsUpdated: number | null;
  createdAt: string;
}

export default function AdminApiManagementPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<number | null>(null);
  
  // NEW: Sync progress state
  const [syncProgress, setSyncProgress] = useState<{
    open: boolean;
    configId: number | null;
    configName: string;
  }>({
    open: false,
    configId: null,
    configName: '',
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'json' as 'json' | 'html',
    sourceType: 'url' as 'url' | 'file',
    sourceUrl: '',
    sourceContent: '',
    isTestMode: true,
    autoSyncEnabled: false,
    syncIntervalMinutes: 60,
    loadImages: true,
    enableDuplicateMerging: true,
    categoryMappingRules: '',
  });

  // NEW: Inactivity logout hook
  const { showWarning, secondsRemaining, dismissWarning } = useInactivityLogout(!!user);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchConfigs();
      fetchLogs();
    }
  }, [user]);

  const fetchConfigs = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/api-configs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConfigs(data);
      }
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/api-logs?limit=20', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFormData({ ...formData, sourceContent: content });
      toast.success('File loaded successfully');
    };
    reader.readAsText(file);
  };

  const handleCreateConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error('Please enter a configuration name');
      return;
    }

    if (formData.sourceType === 'url' && !formData.sourceUrl) {
      toast.error('Please enter a source URL');
      return;
    }

    if (formData.sourceType === 'file' && !formData.sourceContent) {
      toast.error('Please upload a file');
      return;
    }

    // Validate category mapping rules if provided
    if (formData.categoryMappingRules.trim()) {
      try {
        JSON.parse(formData.categoryMappingRules);
      } catch {
        toast.error('Category mapping rules must be valid JSON');
        return;
      }
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/api-configs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          categoryMappingRules: formData.categoryMappingRules.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create configuration');
      }

      toast.success('Configuration created successfully');
      setShowAddForm(false);
      setFormData({
        name: '',
        type: 'json',
        sourceType: 'url',
        sourceUrl: '',
        sourceContent: '',
        isTestMode: true,
        autoSyncEnabled: false,
        syncIntervalMinutes: 60,
        loadImages: true,
        enableDuplicateMerging: true,
        categoryMappingRules: '',
      });
      fetchConfigs();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUpdateAdvancedSettings = async (configId: number, updates: Partial<ApiConfig>) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/admin/api-configs?id=${configId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update configuration');
      }

      toast.success('Settings updated successfully');
      fetchConfigs();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handlePreview = async (configId: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      toast.info('Loading preview...');
      
      const response = await fetch(`/api/admin/api-configs/${configId}/preview`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load preview');
      }

      const data = await response.json();
      setPreviewData(data);
      setShowPreview(true);
      toast.success('Preview loaded successfully');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSync = async (configId: number, isTest: boolean, configName: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      // Open progress dialog
      setSyncProgress({
        open: true,
        configId,
        configName,
      });

      // Start sync
      const response = await fetch(`/api/admin/api-configs/${configId}/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Sync failed');
      }

      const result = await response.json();
      toast.success(result.message);
      fetchConfigs();
      fetchLogs();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteConfig = async (configId: number) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/admin/api-configs?id=${configId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete configuration');

      toast.success('Configuration deleted');
      fetchConfigs();
    } catch (error: any) {
      toast.error(error.message);
    }
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

  return (
    <div className="min-h-screen bg-background">
      <AdminTabs />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold">API Management</h1>
              <p className="text-muted-foreground mt-2">Configure and sync product data from external sources</p>
            </div>
            {!showAddForm && (
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Configuration
              </Button>
            )}
          </div>
        </div>

        {/* Add Configuration Form */}
        {showAddForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>New API Configuration</CardTitle>
              <CardDescription>Add a new data source for product imports</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateConfig} className="space-y-4">
                <div>
                  <Label htmlFor="name">Configuration Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Main Product Feed"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Data Format *</Label>
                    <Select value={formData.type} onValueChange={(v: 'json' | 'html') => setFormData({ ...formData, type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="html">HTML</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="sourceType">Source Type *</Label>
                    <Select value={formData.sourceType} onValueChange={(v: 'url' | 'file') => setFormData({ ...formData, sourceType: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="url">URL</SelectItem>
                        <SelectItem value="file">File Upload</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.sourceType === 'url' ? (
                  <div>
                    <Label htmlFor="sourceUrl">Source URL *</Label>
                    <Input
                      id="sourceUrl"
                      type="url"
                      value={formData.sourceUrl}
                      onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                      placeholder="https://example.com/products.json"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="file">Upload File *</Label>
                    <Input
                      id="file"
                      type="file"
                      accept={formData.type === 'json' ? '.json' : '.html,.htm'}
                      onChange={handleFileUpload}
                      required
                    />
                    {formData.sourceContent && (
                      <p className="text-sm text-muted-foreground mt-2">
                        File loaded ({(formData.sourceContent.length / 1024).toFixed(2)} KB)
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between py-2 border-t">
                  <div>
                    <Label htmlFor="isTestMode">Test Mode</Label>
                    <p className="text-sm text-muted-foreground">Preview imports without affecting live products</p>
                  </div>
                  <Switch
                    id="isTestMode"
                    checked={formData.isTestMode}
                    onCheckedChange={(checked) => setFormData({ ...formData, isTestMode: checked })}
                  />
                </div>

                {/* NEW: Advanced Settings */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Advanced Settings
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <Label htmlFor="loadImages" className="flex items-center gap-2">
                          <ImageOff className="h-4 w-4" />
                          Load Images
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Enable image loading from this source (disable for HTML to use JSON images only)
                        </p>
                      </div>
                      <Switch
                        id="loadImages"
                        checked={formData.loadImages}
                        onCheckedChange={(checked) => setFormData({ ...formData, loadImages: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div>
                        <Label htmlFor="enableDuplicateMerging" className="flex items-center gap-2">
                          <Combine className="h-4 w-4" />
                          Duplicate Merging
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically merge duplicate products across different sources
                        </p>
                      </div>
                      <Switch
                        id="enableDuplicateMerging"
                        checked={formData.enableDuplicateMerging}
                        onCheckedChange={(checked) => setFormData({ ...formData, enableDuplicateMerging: checked })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="categoryMappingRules">Category Mapping Rules (JSON)</Label>
                      <Textarea
                        id="categoryMappingRules"
                        value={formData.categoryMappingRules}
                        onChange={(e) => setFormData({ ...formData, categoryMappingRules: e.target.value })}
                        placeholder='{"Cartridges": 1, "Disposables": 2, "Flower": 3}'
                        rows={3}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Define custom category sorting order (optional)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Create Configuration
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Configurations List */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Configurations</CardTitle>
            <CardDescription>Manage your API data sources</CardDescription>
          </CardHeader>
          <CardContent>
            {configs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No configurations yet</p>
            ) : (
              <div className="space-y-4">
                {configs.map((config) => (
                  <div key={config.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{config.name}</h3>
                          {config.type === 'json' ? (
                            <FileJson className="h-4 w-4 text-blue-500" />
                          ) : (
                            <FileCode className="h-4 w-4 text-orange-500" />
                          )}
                          {config.sourceType === 'url' ? (
                            <LinkIcon className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Upload className="h-4 w-4 text-muted-foreground" />
                          )}
                          {!config.loadImages && (
                            <Badge variant="outline" className="text-xs">
                              <ImageOff className="h-3 w-3 mr-1" />
                              No Images
                            </Badge>
                          )}
                          {config.enableDuplicateMerging && (
                            <Badge variant="outline" className="text-xs">
                              <Combine className="h-3 w-3 mr-1" />
                              Merge
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {config.sourceType === 'url' ? config.sourceUrl : 'File upload'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {config.isTestMode && <Badge variant="outline">Test Mode</Badge>}
                        {config.isActive && <Badge variant="default">Active</Badge>}
                      </div>
                    </div>

                    {config.lastSyncedAt && (
                      <p className="text-xs text-muted-foreground mb-3">
                        Last synced: {new Date(config.lastSyncedAt).toLocaleString()}
                      </p>
                    )}

                    {/* Advanced Settings Panel */}
                    {showAdvancedSettings === config.id && (
                      <div className="mb-3 p-3 bg-muted rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Load Images</Label>
                          <Switch
                            checked={config.loadImages}
                            onCheckedChange={(checked) => 
                              handleUpdateAdvancedSettings(config.id, { loadImages: checked })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Enable Duplicate Merging</Label>
                          <Switch
                            checked={config.enableDuplicateMerging}
                            onCheckedChange={(checked) => 
                              handleUpdateAdvancedSettings(config.id, { enableDuplicateMerging: checked })
                            }
                          />
                        </div>
                        {config.categoryMappingRules && (
                          <div>
                            <Label className="text-xs">Category Mapping Rules</Label>
                            <pre className="text-xs bg-background p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(JSON.parse(config.categoryMappingRules), null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setShowAdvancedSettings(
                          showAdvancedSettings === config.id ? null : config.id
                        )}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        {showAdvancedSettings === config.id ? 'Hide' : 'Settings'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handlePreview(config.id)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button size="sm" onClick={() => handleSync(config.id, config.isTestMode, config.name)}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        {config.isTestMode ? 'Test Sync' : 'Sync Now'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={async () => {
                          const token = localStorage.getItem('auth_token');
                          const res = await fetch(`/api/admin/api-configs/${config.id}/activate`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                          });
                          if (res.ok) {
                            toast.success(config.isActive ? 'Config deactivated' : 'Config activated');
                            fetchConfigs();
                          }
                        }}
                      >
                        {config.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteConfig(config.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Logs</CardTitle>
                <CardDescription>Sync history and status</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={fetchLogs}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No logs yet</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="border-l-4 pl-4 py-2" style={{
                    borderColor: log.status === 'success' ? 'green' : log.status === 'error' ? 'red' : 'orange'
                  }}>
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-sm">{log.message}</p>
                      <Badge variant={log.status === 'success' ? 'default' : log.status === 'error' ? 'destructive' : 'outline'}>
                        {log.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()} • {log.action}
                      {log.productsProcessed !== null && ` • ${log.productsProcessed} processed`}
                      {log.productsCreated !== null && ` • ${log.productsCreated} created`}
                      {log.productsUpdated !== null && ` • ${log.productsUpdated} updated`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview Modal */}
        {showPreview && previewData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPreview(false)}>
            <Card className="max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle>Preview Results</CardTitle>
                <CardDescription>
                  {previewData.summary.totalProducts} products found • 
                  {previewData.summary.toBeCreated} to create • 
                  {previewData.summary.toBeUpdated} to update
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[60vh]">
                <div className="space-y-3">
                  {previewData.sampleProducts.map((product: any, idx: number) => (
                    <div key={idx} className="border rounded p-3">
                      <div className="flex items-start gap-3">
                        {product.imageUrl && (
                          <img src={product.imageUrl} alt={product.name} className="w-16 h-16 object-cover rounded" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="font-medium">{product.name}</h4>
                            <Badge variant={product.action === 'create' ? 'default' : 'outline'}>
                              {product.action}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">{product.description}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>${product.price}</span>
                            <span>•</span>
                            <span>{product.mainCategory}</span>
                            {product.brand && <><span>•</span><span>{product.brand}</span></>}
                            <span>•</span>
                            <span>Stock: {product.stockQuantity}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => setShowPreview(false)}>Close</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* NEW: Sync Progress Dialog */}
      <SyncProgressDialog
        open={syncProgress.open}
        configId={syncProgress.configId}
        configName={syncProgress.configName}
        onClose={() => {
          setSyncProgress({ open: false, configId: null, configName: '' });
          fetchConfigs();
          fetchLogs();
        }}
      />

      {/* NEW: Inactivity Warning */}
      <InactivityWarning
        open={showWarning}
        secondsRemaining={secondsRemaining}
        onDismiss={dismissWarning}
      />
    </div>
  );
}