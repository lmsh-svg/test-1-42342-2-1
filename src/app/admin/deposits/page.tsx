'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, XCircle, Clock, Eye, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface CryptoAddress {
  id: number;
  cryptocurrency: string;
  address: string;
  label: string;
  logoUrl: string | null;
  isActive: boolean;
}

interface Deposit {
  id: number;
  userId: number;
  amount: number;
  cryptocurrency: string;
  walletAddress: string;
  status: 'pending' | 'completed' | 'cancelled';
  transactionHash: string | null;
  transactionId: string | null;
  confirmations: number;
  verifiedAt: string | null;
  verificationError: string | null;
  credits: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminDepositsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [filteredDeposits, setFilteredDeposits] = useState<Deposit[]>([]);
  const [cryptoAddresses, setCryptoAddresses] = useState<CryptoAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [transactionHash, setTransactionHash] = useState('');
  const [notes, setNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCheckingConfirmations, setIsCheckingConfirmations] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/marketplace');
      } else {
        loadData();
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredDeposits(deposits);
    } else {
      setFilteredDeposits(deposits.filter((d) => d.status === statusFilter));
    }
  }, [statusFilter, deposits]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load deposits
      const depositsRes = await fetch('/api/deposits?limit=100');
      if (depositsRes.ok) {
        const data = await depositsRes.json();
        setDeposits(data);
        setFilteredDeposits(data);
      } else {
        toast.error('Failed to load deposits');
      }

      // Load crypto addresses for logos
      const cryptoRes = await fetch('/api/admin/crypto-addresses');
      if (cryptoRes.ok) {
        const cryptoData = await cryptoRes.json();
        setCryptoAddresses(cryptoData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (deposit: Deposit) => {
    setSelectedDeposit(deposit);
    setTransactionHash(deposit.transactionHash || '');
    setNotes(deposit.notes || '');
    setShowDialog(true);
  };

  const handleCheckConfirmations = async () => {
    if (!selectedDeposit || !selectedDeposit.transactionId) {
      toast.error('No transaction ID available');
      return;
    }

    setIsCheckingConfirmations(true);
    try {
      const res = await fetch(`/api/deposits/check-confirmations?depositId=${selectedDeposit.id}`);
      const data = await res.json();

      if (res.ok) {
        if (data.status === 'completed') {
          toast.success('Deposit verified and approved!');
          setShowDialog(false);
          loadData();
        } else {
          toast.success(`Confirmations: ${data.confirmations}/2`);
          // Refresh the selected deposit
          const refreshRes = await fetch(`/api/deposits?id=${selectedDeposit.id}`);
          if (refreshRes.ok) {
            const refreshedDeposit = await refreshRes.json();
            setSelectedDeposit(refreshedDeposit);
          }
        }
      } else {
        toast.error(data.error || 'Failed to check confirmations');
      }
    } catch (error) {
      console.error('Failed to check confirmations:', error);
      toast.error('Failed to check confirmations');
    } finally {
      setIsCheckingConfirmations(false);
    }
  };

  const handleUpdateStatus = async (status: 'completed' | 'cancelled') => {
    if (!selectedDeposit) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/deposits?id=${selectedDeposit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          transactionHash: transactionHash || null,
          notes: notes || null,
        }),
      });

      if (res.ok) {
        toast.success(`Deposit ${status === 'completed' ? 'approved' : 'cancelled'}`);
        setShowDialog(false);
        loadData();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update deposit');
      }
    } catch (error) {
      console.error('Failed to update:', error);
      toast.error('Failed to update deposit');
    } finally {
      setIsUpdating(false);
    }
  };

  const getCryptoLogo = (cryptocurrency: string) => {
    const crypto = cryptoAddresses.find(c => c.cryptocurrency === cryptocurrency);
    return crypto?.logoUrl || null;
  };

  const getStatusBadge = (status: string, confirmations?: number, verificationError?: string | null) => {
    switch (status) {
      case 'pending':
        if (verificationError && verificationError !== 'Waiting for confirmations') {
          return (
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
              <AlertCircle className="w-3 h-3 mr-1" />
              Error
            </Badge>
          );
        }
        if (confirmations !== undefined && confirmations > 0) {
          return (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
              <Clock className="w-3 h-3 mr-1" />
              {confirmations}/2 Confirmations
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const pendingCount = deposits.filter((d) => d.status === 'pending').length;
  const completedCount = deposits.filter((d) => d.status === 'completed').length;
  const cancelledCount = deposits.filter((d) => d.status === 'cancelled').length;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Manage Deposits</h1>
          <p className="text-muted-foreground mt-2">
            Review and approve customer cryptocurrency deposits
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Pending Deposits</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{pendingCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Completed Deposits</CardDescription>
              <CardTitle className="text-3xl text-green-600">{completedCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Cancelled Deposits</CardDescription>
              <CardTitle className="text-3xl text-red-600">{cancelledCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="space-y-6">
          <TabsList>
            <TabsTrigger value="all">All ({deposits.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({cancelledCount})</TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="space-y-4">
            {filteredDeposits.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No deposits found
                </CardContent>
              </Card>
            ) : (
              filteredDeposits.map((deposit) => (
                <Card key={deposit.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getCryptoLogo(deposit.cryptocurrency) && (
                          <img 
                            src={getCryptoLogo(deposit.cryptocurrency)!} 
                            alt={deposit.cryptocurrency} 
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <div>
                          <CardTitle className="text-lg">
                            Deposit #{deposit.id} - {deposit.cryptocurrency.toUpperCase()}
                          </CardTitle>
                          <CardDescription>
                            User ID: {deposit.userId} • {new Date(deposit.createdAt).toLocaleString()}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(deposit.status, deposit.confirmations, deposit.verificationError)}
                        <Button size="sm" variant="outline" onClick={() => handleOpenDialog(deposit)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Review
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="font-semibold">${deposit.amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Credits</p>
                        <p className="font-semibold">{deposit.credits.toFixed(2)}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Wallet Address</p>
                        <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                          {deposit.walletAddress}
                        </code>
                      </div>
                    </div>
                    {deposit.transactionId && (
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground">Transaction ID</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                            {deposit.transactionId}
                          </code>
                          <a 
                            href={`https://mempool.space/tx/${deposit.transactionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    )}
                    {deposit.verificationError && (
                      <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded p-2">
                        <p className="text-xs text-red-600">{deposit.verificationError}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Deposit #{selectedDeposit?.id}</DialogTitle>
            <DialogDescription>
              Review and update the deposit status
            </DialogDescription>
          </DialogHeader>
          {selectedDeposit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>User ID</Label>
                  <Input value={selectedDeposit.userId} readOnly />
                </div>
                <div>
                  <Label>Cryptocurrency</Label>
                  <div className="flex items-center gap-2">
                    <Input value={selectedDeposit.cryptocurrency.toUpperCase()} readOnly />
                    {getCryptoLogo(selectedDeposit.cryptocurrency) && (
                      <img 
                        src={getCryptoLogo(selectedDeposit.cryptocurrency)!} 
                        alt={selectedDeposit.cryptocurrency} 
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input value={`$${selectedDeposit.amount.toFixed(2)}`} readOnly />
                </div>
                <div>
                  <Label>Credits</Label>
                  <Input value={selectedDeposit.credits.toFixed(2)} readOnly />
                </div>
              </div>
              
              <div>
                <Label>Wallet Address</Label>
                <Input value={selectedDeposit.walletAddress} readOnly className="font-mono text-sm" />
              </div>

              {selectedDeposit.transactionId && (
                <div>
                  <Label className="flex items-center justify-between">
                    <span>Transaction ID</span>
                    <a 
                      href={`https://mempool.space/tx/${selectedDeposit.transactionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      View on Mempool <ExternalLink className="w-3 h-3" />
                    </a>
                  </Label>
                  <Input value={selectedDeposit.transactionId} readOnly className="font-mono text-sm" />
                  {selectedDeposit.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2"
                      onClick={handleCheckConfirmations}
                      disabled={isCheckingConfirmations}
                    >
                      {isCheckingConfirmations ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Checking Blockchain...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-3 w-3" />
                          Check Confirmations ({selectedDeposit.confirmations}/2)
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {selectedDeposit.verificationError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-sm font-semibold text-red-600 mb-1">Verification Error:</p>
                  <p className="text-sm text-red-600">{selectedDeposit.verificationError}</p>
                </div>
              )}

              {selectedDeposit.verifiedAt && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <p className="text-sm">
                    <span className="font-semibold text-green-600">Verified At:</span>{' '}
                    {new Date(selectedDeposit.verifiedAt).toLocaleString()}
                  </p>
                </div>
              )}

              <div>
                <Label>Transaction Hash (Optional)</Label>
                <Input
                  placeholder="Enter transaction hash if verified"
                  value={transactionHash}
                  onChange={(e) => setTransactionHash(e.target.value)}
                />
              </div>
              
              <div>
                <Label>Admin Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any notes about this deposit"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="bg-muted p-4 rounded-lg space-y-1">
                <p className="text-sm">
                  <span className="font-semibold">Created:</span>{' '}
                  {new Date(selectedDeposit.createdAt).toLocaleString()}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Last Updated:</span>{' '}
                  {new Date(selectedDeposit.updatedAt).toLocaleString()}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Current Status:</span>{' '}
                  {getStatusBadge(selectedDeposit.status, selectedDeposit.confirmations, selectedDeposit.verificationError)}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Close
            </Button>
            {selectedDeposit?.status === 'pending' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleUpdateStatus('cancelled')}
                  disabled={isUpdating}
                >
                  {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                  Cancel Deposit
                </Button>
                <Button onClick={() => handleUpdateStatus('completed')} disabled={isUpdating}>
                  {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Approve Deposit
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}