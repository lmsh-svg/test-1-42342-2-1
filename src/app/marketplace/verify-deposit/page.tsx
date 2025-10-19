'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface VerificationResult {
  success: boolean;
  verification?: {
    id: number;
    txid: string;
    currency: string;
    matchedAddress: string;
    amountFloat: number;
    confirmed: boolean;
    confirmations: number;
    firstSeen: string;
    lastChecked: string;
  };
  message?: string;
  error?: string;
  code?: string;
}

export default function VerifyDepositPage() {
  const [txid, setTxid] = useState('');
  const [currency, setCurrency] = useState('BTC');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const handleVerify = async () => {
    if (!txid.trim()) {
      toast.error('Please enter a transaction ID');
      return;
    }

    setIsVerifying(true);
    setResult(null);

    try {
      const response = await fetch('/api/crypto/verify-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txid: txid.trim(), currency })
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        if (data.verification?.confirmed) {
          toast.success('Transaction verified and confirmed!');
        } else {
          toast.info('Transaction found, waiting for confirmations');
        }
      } else {
        toast.error(data.error || 'Verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to verify transaction');
      setResult({
        success: false,
        error: 'Network error. Please try again.',
        code: 'NETWORK_ERROR'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusIcon = () => {
    if (!result) return null;

    if (result.success && result.verification?.confirmed) {
      return <CheckCircle className="h-6 w-6 text-green-500" />;
    }
    if (result.success && !result.verification?.confirmed) {
      return <Clock className="h-6 w-6 text-yellow-500" />;
    }
    return <XCircle className="h-6 w-6 text-red-500" />;
  };

  const getStatusColor = () => {
    if (!result) return '';

    if (result.success && result.verification?.confirmed) {
      return 'border-green-500/50 bg-green-500/10';
    }
    if (result.success && !result.verification?.confirmed) {
      return 'border-yellow-500/50 bg-yellow-500/10';
    }
    return 'border-red-500/50 bg-red-500/10';
  };

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Verify Crypto Deposit</CardTitle>
          <CardDescription>
            Enter your transaction ID to verify your cryptocurrency deposit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Currency Selection */}
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="BTC">Bitcoin (BTC)</option>
              <option value="ETH">Ethereum (ETH)</option>
              <option value="DOGE">Dogecoin (DOGE)</option>
            </select>
          </div>

          {/* Transaction ID Input */}
          <div className="space-y-2">
            <Label htmlFor="txid">Transaction ID (TXID)</Label>
            <Input
              id="txid"
              type="text"
              placeholder="Enter transaction ID (64 hex characters)"
              value={txid}
              onChange={(e) => setTxid(e.target.value)}
              className="font-mono text-sm"
              disabled={isVerifying}
            />
            <p className="text-xs text-muted-foreground">
              {currency === 'BTC' && 'Bitcoin TXIDs are 64 hexadecimal characters'}
              {currency === 'ETH' && 'Ethereum TXIDs start with 0x followed by 64 hex characters'}
              {currency === 'DOGE' && 'Dogecoin TXIDs are 64 hexadecimal characters'}
            </p>
          </div>

          {/* Verify Button */}
          <Button
            onClick={handleVerify}
            disabled={isVerifying || !txid.trim()}
            className="w-full"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Deposit'
            )}
          </Button>

          {/* Result Display */}
          {result && (
            <Card className={`border-2 ${getStatusColor()}`}>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  {getStatusIcon()}
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold">
                      {result.success
                        ? result.verification?.confirmed
                          ? 'Transaction Confirmed'
                          : 'Transaction Pending'
                        : 'Verification Failed'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {result.message || result.error}
                    </p>
                  </div>
                </div>

                {result.success && result.verification && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-mono font-semibold">
                        {result.verification.amountFloat} {result.verification.currency}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Address:</span>
                      <span className="font-mono text-xs truncate max-w-[200px]">
                        {result.verification.matchedAddress}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Confirmations:</span>
                      <span className={result.verification.confirmed ? 'text-green-500' : 'text-yellow-500'}>
                        {result.verification.confirmations} / 2
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      <span className={result.verification.confirmed ? 'text-green-500' : 'text-yellow-500'}>
                        {result.verification.confirmed ? 'Confirmed' : 'Awaiting confirmation'}
                      </span>
                    </div>
                  </div>
                )}

                {!result.success && result.code && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Error Code: {result.code}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Information */}
          <Alert>
            <AlertDescription className="text-sm">
              <strong>Note:</strong> Transactions require at least 2 confirmations before
              they can be credited to your account. This process typically takes 10-20 minutes
              for Bitcoin. The system will automatically check pending transactions periodically.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}