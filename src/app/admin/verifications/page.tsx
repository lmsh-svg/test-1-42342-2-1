'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, CheckCircle, Clock, XCircle, Filter, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface Verification {
  id: number;
  txid: string;
  currency: string;
  matchedAddress: string;
  amountSats: number;
  amountFloat: number;
  confirmed: boolean;
  confirmedAt: string | null;
  credited: boolean;
  creditedAt: string | null;
  firstSeen: string;
  lastChecked: string;
  meta: string | null;
  createdAt: string;
  updatedAt: string;
  userId: number | null;
  retryCount: number;
  errorMessage: string | null;
}

export default function AdminVerificationsPage() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState<number | null>(null);
  
  // Filters
  const [filterCurrency, setFilterCurrency] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [limit, setLimit] = useState(50);

  const loadVerifications = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      if (filterCurrency) params.set('currency', filterCurrency);
      if (filterStatus) params.set('status', filterStatus);

      const response = await fetch(`/api/crypto/verifications?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch verifications');
      
      const data = await response.json();
      setVerifications(data);
    } catch (error) {
      console.error('Load error:', error);
      toast.error('Failed to load verifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async (id: number) => {
    setIsRetrying(id);
    try {
      const response = await fetch(`/api/crypto/verifications/${id}/retry`, {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message || 'Verification retried successfully');
        await loadVerifications();
      } else {
        toast.error(data.error || 'Retry failed');
      }
    } catch (error) {
      console.error('Retry error:', error);
      toast.error('Failed to retry verification');
    } finally {
      setIsRetrying(null);
    }
  };

  useEffect(() => {
    loadVerifications();
  }, [filterCurrency, filterStatus, limit]);

  const getStatusBadge = (verification: Verification) => {
    if (verification.credited) {
      return <Badge className="bg-green-500">Credited</Badge>;
    }
    if (verification.confirmed) {
      return <Badge className="bg-blue-500">Confirmed</Badge>;
    }
    if (verification.errorMessage) {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const getStatusIcon = (verification: Verification) => {
    if (verification.credited) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (verification.confirmed) {
      return <Clock className="h-4 w-4 text-blue-500" />;
    }
    if (verification.errorMessage) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const getExplorerUrl = (verification: Verification) => {
    const { txid, currency } = verification;
    
    switch (currency.toUpperCase()) {
      case 'BTC':
        return `https://mempool.space/tx/${txid}`;
      case 'ETH':
        return `https://etherscan.io/tx/${txid}`;
      case 'DOGE':
        return `https://dogechain.info/tx/${txid}`;
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Crypto Deposit Verifications</h1>
        <p className="text-muted-foreground">
          Monitor and manage cryptocurrency deposit verifications
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <select
                value={filterCurrency}
                onChange={(e) => setFilterCurrency(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="BTC">Bitcoin (BTC)</option>
                <option value="ETH">Ethereum (ETH)</option>
                <option value="DOGE">Dogecoin (DOGE)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="credited">Credited</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Limit</Label>
              <Input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Math.min(100, parseInt(e.target.value) || 50)))}
                min="1"
                max="100"
              />
            </div>

            <div className="flex items-end">
              <Button onClick={loadVerifications} variant="outline" className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verifications List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : verifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No verifications found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {verifications.map((verification) => (
            <Card key={verification.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  {/* Left side - Main info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(verification)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">
                            {verification.currency}
                          </span>
                          {getStatusBadge(verification)}
                          {verification.userId && (
                            <Badge variant="outline">User #{verification.userId}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          ID: {verification.id} • Retries: {verification.retryCount}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-24">TXID:</span>
                        <code className="flex-1 text-xs bg-muted px-2 py-1 rounded truncate">
                          {verification.txid}
                        </code>
                        {getExplorerUrl(verification) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(getExplorerUrl(verification)!, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-24">Address:</span>
                        <code className="flex-1 text-xs bg-muted px-2 py-1 rounded truncate">
                          {verification.matchedAddress}
                        </code>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-24">Amount:</span>
                        <span className="font-mono font-semibold">
                          {verification.amountFloat} {verification.currency}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({verification.amountSats.toLocaleString()} sats)
                        </span>
                      </div>
                    </div>

                    {verification.errorMessage && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded p-2">
                        <p className="text-xs text-destructive">
                          <strong>Error:</strong> {verification.errorMessage}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t">
                      <div>
                        <strong>First Seen:</strong> {formatDate(verification.firstSeen)}
                      </div>
                      <div>
                        <strong>Last Checked:</strong> {formatDate(verification.lastChecked)}
                      </div>
                      {verification.confirmedAt && (
                        <div>
                          <strong>Confirmed:</strong> {formatDate(verification.confirmedAt)}
                        </div>
                      )}
                      {verification.creditedAt && (
                        <div>
                          <strong>Credited:</strong> {formatDate(verification.creditedAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side - Actions */}
                  <div className="flex md:flex-col gap-2">
                    {!verification.credited && (
                      <Button
                        onClick={() => handleRetry(verification.id)}
                        disabled={isRetrying === verification.id}
                        variant="outline"
                        size="sm"
                      >
                        {isRetrying === verification.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{verifications.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-yellow-500">
                {verifications.filter(v => !v.confirmed && !v.errorMessage).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confirmed</p>
              <p className="text-2xl font-bold text-blue-500">
                {verifications.filter(v => v.confirmed && !v.credited).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Credited</p>
              <p className="text-2xl font-bold text-green-500">
                {verifications.filter(v => v.credited).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}