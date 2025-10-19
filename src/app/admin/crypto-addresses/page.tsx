'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Edit, Trash2, Wallet, Image as ImageIcon, TestTube, CheckCircle, XCircle, ExternalLink, Search, AlertCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { AdminTabs } from '@/components/admin/admin-tabs';
import { WebSocketMonitorCard } from '@/components/admin/websocket-monitor-card';

interface CryptoAddress {
  id: number;
  cryptocurrency: string;
  address: string;
  label: string | null;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function CryptoAddressesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [addresses, setAddresses] = useState<CryptoAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CryptoAddress | null>(null);
  const [formData, setFormData] = useState({
    cryptocurrency: '',
    address: '',
    label: '',
    logoUrl: '',
    isActive: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [debugTxId, setDebugTxId] = useState('');
  const [debugResult, setDebugResult] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [testTxId, setTestTxId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Simple auth redirect - no complex logic
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
    if (!authLoading && user && user.role !== 'admin') {
      router.replace('/marketplace');
    }
  }, [authLoading, user, router]);

  // Separate effect for loading addresses
  useEffect(() => {
    if (!authLoading && user && user.role === 'admin') {
      loadAddresses();
    }
  }, [authLoading, user]);

  const loadAddresses = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/crypto-addresses');
      if (res.ok) {
        const data = await res.json();
        setAddresses(data);
      }
    } catch (error) {
      console.error('Failed to load addresses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (address?: CryptoAddress) => {
    if (address) {
      setEditingAddress(address);
      setFormData({
        cryptocurrency: address.cryptocurrency,
        address: address.address,
        label: address.label || '',
        logoUrl: address.logoUrl || '',
        isActive: address.isActive,
      });
    } else {
      setEditingAddress(null);
      setFormData({
        cryptocurrency: '',
        address: '',
        label: '',
        logoUrl: '',
        isActive: true,
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.cryptocurrency || !formData.address) {
      toast.error('Cryptocurrency and address are required');
      return;
    }

    setIsSaving(true);
    try {
      let res;
      if (editingAddress) {
        res = await fetch(`/api/admin/crypto-addresses?id=${editingAddress.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: formData.address,
            label: formData.label || null,
            logoUrl: formData.logoUrl || null,
            isActive: formData.isActive,
          }),
        });
      } else {
        res = await fetch('/api/admin/crypto-addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            logoUrl: formData.logoUrl || null,
          }),
        });
      }

      if (res.ok) {
        toast.success(editingAddress ? 'Address updated' : 'Address saved');
        setShowDialog(false);
        loadAddresses();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save address');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this crypto address?')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/crypto-addresses?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Address deleted');
        loadAddresses();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to delete address');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete address');
    }
  };

  const handleTestTransaction = async () => {
    if (!testTxId) {
      toast.error('Please enter a transaction ID');
      return;
    }

    if (addresses.length === 0) {
      toast.error('Please add at least one crypto address first');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Updated to use broad verify-tx approach
      const res = await fetch('/api/crypto/verify-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txid: testTxId.trim(),
          currency: 'BTC'
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const matchedAddr = addresses.find(a => a.address === data.verification.matchedAddress);
        
        setTestResult({
          valid: true,
          address: data.verification.matchedAddress,
          cryptocurrency: data.verification.currency,
          logoUrl: matchedAddr?.logoUrl,
          data: {
            amount: data.verification.amountFloat,
            confirmations: data.verification.confirmations,
          },
        });
        toast.success('✅ Valid Transaction ID!');
      } else {
        const testedAddresses = data.testedAddresses || addresses.map(a => 
          `${a.cryptocurrency.toUpperCase()}: Transaction was not sent to address ${a.address}`
        );
        
        setTestResult({
          valid: false,
          results: addresses.map(a => ({
            address: a.address,
            cryptocurrency: a.cryptocurrency,
            logoUrl: a.logoUrl,
            success: false,
            data: { error: 'No match' }
          })),
          testedAddresses,
        });
        toast.error('❌ Invalid Transaction ID');
      }
    } catch (error) {
      console.error('Testing error:', error);
      toast.error('Failed to test transaction');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDebugTransaction = async () => {
    if (!debugTxId.trim()) {
      toast.error('Please enter a transaction ID');
      return;
    }

    setDebugLoading(true);
    setDebugResult(null);

    try {
      const response = await fetch('/api/crypto/debug-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txid: debugTxId.trim() })
      });

      const data = await response.json();
      setDebugResult(data);

      if (!response.ok) {
        toast.error(data.error || 'Failed to debug transaction');
      } else {
        toast.success('Transaction details fetched successfully');
      }
    } catch (error) {
      console.error('Debug error:', error);
      toast.error('Failed to debug transaction');
    } finally {
      setDebugLoading(false);
    }
  };

  // Show loading only while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render if not authorized
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      <AdminTabs />

      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Crypto Wallet Addresses</h1>
            <p className="text-muted-foreground mt-2">
              Manage cryptocurrency wallet addresses for customer deposits
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Address
          </Button>
        </div>

        <WebSocketMonitorCard />

        {/* Transaction Debug Tool */}
        <Card>
          <CardHeader>
            <CardTitle>🔍 Debug Transaction</CardTitle>
            <CardDescription>
              See exactly where a transaction sent funds to debug verification issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter Bitcoin transaction ID (txid)"
                value={debugTxId}
                onChange={(e) => setDebugTxId(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                onClick={handleDebugTransaction}
                disabled={debugLoading}
              >
                {debugLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Debugging...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Debug
                  </>
                )}
              </Button>
            </div>

            {debugResult && (
              <div className="border rounded-lg p-4 bg-muted/50">
                {debugResult.success ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium mb-1">Transaction ID</div>
                      <div className="font-mono text-xs break-all">{debugResult.txid}</div>
                    </div>

                    <div>
                      <div className="text-sm font-medium mb-2">Status</div>
                      <div className="flex items-center gap-2">
                        {debugResult.status.confirmed ? (
                          <Badge variant="default">
                            ✓ Confirmed ({debugResult.status.confirmations} confirmations)
                          </Badge>
                        ) : (
                          <Badge variant="secondary">⏳ Unconfirmed</Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium mb-2">
                        Output Addresses ({debugResult.totalOutputs})
                      </div>
                      <div className="space-y-2">
                        {debugResult.outputs.map((output: any, idx: number) => (
                          <div key={idx} className="border rounded p-3 bg-background">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-mono text-xs break-all mb-1">
                                  {output.address}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {output.scriptType}
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <div className="font-medium">{output.amountBTC} BTC</div>
                                <div className="text-xs text-muted-foreground">
                                  {output.amountSats.toLocaleString()} sats
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Verification Tip</AlertTitle>
                      <AlertDescription>
                        {debugResult.note}
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                      {debugResult.error}
                      {debugResult.note && (
                        <div className="mt-2 text-sm">{debugResult.note}</div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* TXID Testing Section */}
        <Card className="mb-6 border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <TestTube className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Test Transaction ID</CardTitle>
                <CardDescription>
                  Test if a transaction ID has sent money to any of your set addresses
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Enter transaction ID (e.g., abc123...)"
                  value={testTxId}
                  onChange={(e) => setTestTxId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTestTransaction();
                    }
                  }}
                />
              </div>
              <Button onClick={handleTestTransaction} disabled={isTesting || !testTxId}>
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="mr-2 h-4 w-4" />
                    Test
                  </>
                )}
              </Button>
            </div>

            {testResult && (
              <div className="mt-4">
                {testResult.valid ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                          ✅ Valid Transaction ID
                        </h3>
                        <div className="space-y-2 text-sm">
                          {testResult.logoUrl && (
                            <div className="flex items-center gap-2">
                              <img 
                                src={testResult.logoUrl} 
                                alt={testResult.cryptocurrency}
                                className="w-5 h-5 rounded-full"
                              />
                              <span className="font-medium">{testResult.cryptocurrency.toUpperCase()}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Address:</span>{' '}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {testResult.address}
                            </code>
                          </div>
                          {testResult.data.amount && (
                            <div>
                              <span className="text-muted-foreground">Amount:</span>{' '}
                              <span className="font-medium">{testResult.data.amount} BTC</span>
                            </div>
                          )}
                          {testResult.data.confirmations !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Confirmations:</span>{' '}
                              <Badge variant={testResult.data.confirmations >= 2 ? 'default' : 'secondary'}>
                                {testResult.data.confirmations}
                              </Badge>
                            </div>
                          )}
                          <a
                            href={`https://mempool.space/tx/${testTxId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            View on Blockchain Explorer
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-6 w-6 text-red-500 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                          ❌ Invalid Transaction ID
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          This transaction ID was not sent to any of your configured wallet addresses, or the transaction could not be found on the blockchain.
                        </p>
                        {testResult.testedAddresses && testResult.testedAddresses.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-muted-foreground mb-2">
                              Tested against {testResult.testedAddresses.length} address(es):
                            </p>
                            <div className="space-y-1">
                              {testResult.testedAddresses.slice(0, 5).map((addrText: string, idx: number) => (
                                <div key={idx} className="text-xs text-muted-foreground">
                                  {addrText}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-muted-foreground">Loading addresses...</p>
              </CardContent>
            </Card>
          ) : addresses.length > 0 ? (
            addresses.map((address) => (
              <Card key={address.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {address.logoUrl ? (
                        <img src={address.logoUrl} alt={address.cryptocurrency} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <Wallet className="w-5 h-5 text-primary" />
                      )}
                      <div>
                        <CardTitle className="text-lg">
                          {address.cryptocurrency.toUpperCase()}
                        </CardTitle>
                        {address.label && (
                          <CardDescription>{address.label}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={address.isActive ? 'default' : 'secondary'}>
                        {address.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDialog(address)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(address.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <code className="block bg-muted px-3 py-2 rounded text-sm break-all">
                      {address.address}
                    </code>
                  </div>
                  {address.logoUrl && (
                    <div className="mt-4">
                      <Label>Logo URL</Label>
                      <p className="text-sm text-muted-foreground break-all">{address.logoUrl}</p>
                    </div>
                  )}
                  <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">Created:</span>{' '}
                      {new Date(address.createdAt).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="font-medium">Updated:</span>{' '}
                      {new Date(address.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No crypto addresses configured yet. Add one to get started!
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? 'Edit Crypto Address' : 'Add Crypto Address'}
            </DialogTitle>
            <DialogDescription>
              {editingAddress
                ? 'Update the cryptocurrency wallet address'
                : 'Add a new cryptocurrency wallet address for deposits'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cryptocurrency">Cryptocurrency *</Label>
              <Input
                id="cryptocurrency"
                placeholder="bitcoin, ethereum, dogecoin, etc."
                value={formData.cryptocurrency}
                onChange={(e) =>
                  setFormData({ ...formData, cryptocurrency: e.target.value.toLowerCase() })
                }
                disabled={!!editingAddress}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Wallet Address *</Label>
              <Input
                id="address"
                placeholder="bc1qk08xsen..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label (Optional)</Label>
              <Input
                id="label"
                placeholder="e.g., Bitcoin Wallet"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl" className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Logo URL (Optional)
              </Label>
              <Input
                id="logoUrl"
                type="url"
                placeholder="https://example.com/bitcoin-logo.svg"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              />
              {formData.logoUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img 
                    src={formData.logoUrl} 
                    alt="Logo preview" 
                    className="w-8 h-8 rounded-full object-cover border border-border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Preview</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}