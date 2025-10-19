'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Navbar from '@/components/marketplace/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Wallet, Copy, QrCode, ArrowDownToLine, Clock, CheckCircle2, XCircle, RefreshCw, AlertCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';
import { Checkbox } from '@/components/ui/checkbox';

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

interface CooldownStatus {
  hasCooldown: boolean;
  cooldownEndsAt: string | null;
  remainingMinutes: number | null;
}

export default function DepositsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [credits, setCredits] = useState<number>(0);
  const [cryptoAddresses, setCryptoAddresses] = useState<CryptoAddress[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [selectedCrypto, setSelectedCrypto] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showTxIdDialog, setShowTxIdDialog] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [currentDeposit, setCurrentDeposit] = useState<Deposit | null>(null);
  const [transactionId, setTransactionId] = useState<string>('');
  const [isSubmittingTxId, setIsSubmittingTxId] = useState(false);
  const [isCheckingConfirmations, setIsCheckingConfirmations] = useState<number | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [cooldownStatus, setCooldownStatus] = useState<CooldownStatus>({
    hasCooldown: false,
    cooldownEndsAt: null,
    remainingMinutes: null
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Auto-refresh deposits every 30 seconds for pending deposits with transaction IDs
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const hasPendingWithTxId = deposits.some(
        d => d.status === 'pending' && d.transactionId
      );
      if (hasPendingWithTxId) {
        loadData();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [user, deposits]);

  const loadData = async () => {
    if (!user) return;

    setIsLoadingData(true);
    try {
      // Load credit balance
      const creditsRes = await fetch(`/api/user/credits?userId=${user.id}`);
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        setCredits(creditsData.credits || 0);
      }

      // Load cooldown status
      const cooldownRes = await fetch(`/api/user/cooldown-status?userId=${user.id}`);
      if (cooldownRes.ok) {
        const cooldownData = await cooldownRes.json();
        setCooldownStatus(cooldownData);
      }

      // Load active crypto addresses
      const cryptoRes = await fetch('/api/admin/crypto-addresses?isActive=true');
      if (cryptoRes.ok) {
        const cryptoData = await cryptoRes.json();
        setCryptoAddresses(cryptoData);
      }

      // Load user's deposits
      const depositsRes = await fetch(`/api/deposits?userId=${user.id}&limit=50`);
      if (depositsRes.ok) {
        const depositsData = await depositsRes.json();
        setDeposits(depositsData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load deposit data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleOpenTermsDialog = () => {
    if (!selectedCrypto) {
      toast.error('Please select cryptocurrency');
      return;
    }

    if (cooldownStatus.hasCooldown) {
      toast.error(`You must wait ${cooldownStatus.remainingMinutes} more minutes before creating a new deposit`);
      return;
    }

    setShowTermsDialog(true);
  };

  const handleCreateDeposit = async () => {
    if (!user || !selectedCrypto || !agreedToTerms) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          cryptocurrency: selectedCrypto,
          agreedToTerms: true,
        }),
      });

      if (res.ok) {
        const newDeposit = await res.json();
        setCurrentDeposit(newDeposit);
        setShowTermsDialog(false);
        setShowQRDialog(true);
        setAgreedToTerms(false);
        toast.success('Deposit created! Send crypto and submit your transaction ID');
        loadData();
      } else {
        const error = await res.json();
        if (error.code === 'COOLDOWN_ACTIVE') {
          toast.error(`Cooldown active: ${error.remainingMinutes} minutes remaining`);
          setCooldownStatus({
            hasCooldown: true,
            cooldownEndsAt: error.cooldownEndsAt,
            remainingMinutes: error.remainingMinutes
          });
        } else {
          toast.error(error.error || 'Failed to create deposit');
        }
      }
    } catch (error) {
      console.error('Failed to create deposit:', error);
      toast.error('Failed to create deposit');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmitTransactionId = async () => {
    if (!currentDeposit || !transactionId.trim()) {
      toast.error('Please enter a transaction ID');
      return;
    }

    setIsSubmittingTxId(true);
    try {
      // First, update the deposit with the transaction ID
      const updateRes = await fetch(`/api/deposits?id=${currentDeposit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: transactionId.trim(),
        }),
      });

      if (!updateRes.ok) {
        const error = await updateRes.json();
        toast.error(error.error || 'Failed to update deposit');
        return;
      }

      // Then, verify the transaction
      const verifyRes = await fetch('/api/deposits/verify-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depositId: currentDeposit.id,
          transactionId: transactionId.trim(),
        }),
      });

      const verifyData = await verifyRes.json();

      if (verifyData.success) {
        toast.success(`Transaction verified! ${verifyData.confirmations} confirmations. Deposit approved!`);
        setShowTxIdDialog(false);
        setTransactionId('');
        loadData();
      } else if (verifyData.confirmations >= 0) {
        toast.success(`Transaction found! Waiting for confirmations (${verifyData.confirmations}/2)`);
        setShowTxIdDialog(false);
        setTransactionId('');
        loadData();
      } else {
        toast.error(verifyData.error || 'Failed to verify transaction');
      }
    } catch (error) {
      console.error('Failed to submit transaction:', error);
      toast.error('Failed to submit transaction ID');
    } finally {
      setIsSubmittingTxId(false);
    }
  };

  const handleCheckConfirmations = async (depositId: number) => {
    setIsCheckingConfirmations(depositId);
    try {
      const res = await fetch(`/api/deposits/check-confirmations?depositId=${depositId}`);
      const data = await res.json();

      if (res.ok) {
        if (data.status === 'completed') {
          toast.success('Deposit verified and approved!');
        } else {
          toast.success(`Confirmations: ${data.confirmations}/2`);
        }
        loadData();
      } else {
        toast.error(data.error || 'Failed to check confirmations');
      }
    } catch (error) {
      console.error('Failed to check confirmations:', error);
      toast.error('Failed to check confirmations');
    } finally {
      setIsCheckingConfirmations(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const getQRCodeValue = (crypto: string, address: string) => {
    return `${crypto.toLowerCase()}:${address}`;
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

  if (authLoading || isLoadingData) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <div className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {/* Credit Balance Card */}
        <Card className="mb-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Your Credit Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">{credits.toFixed(2)} Credits</div>
            <p className="text-sm text-muted-foreground mt-2">1 USD = 1 Credit</p>
          </CardContent>
        </Card>

        {/* Cooldown Warning */}
        {cooldownStatus.hasCooldown && (
          <Card className="mb-8 border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-600">Deposit Cooldown Active</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You must wait <span className="font-semibold">{cooldownStatus.remainingMinutes} minutes</span> before creating a new deposit after cancelling one.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Cooldown ends at: {cooldownStatus.cooldownEndsAt && new Date(cooldownStatus.cooldownEndsAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="deposit" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="deposit">New Deposit</TabsTrigger>
            <TabsTrigger value="history">Deposit History</TabsTrigger>
          </TabsList>

          {/* New Deposit Tab */}
          <TabsContent value="deposit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Make a Deposit</CardTitle>
                <CardDescription>
                  Send cryptocurrency to the generated address - amount is automatically detected
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cryptocurrency">Cryptocurrency</Label>
                  <Select value={selectedCrypto} onValueChange={setSelectedCrypto} disabled={cooldownStatus.hasCooldown}>
                    <SelectTrigger id="cryptocurrency">
                      <SelectValue placeholder="Select cryptocurrency" />
                    </SelectTrigger>
                    <SelectContent>
                      {cryptoAddresses.map((crypto) => (
                        <SelectItem key={crypto.id} value={crypto.cryptocurrency}>
                          <div className="flex items-center gap-2">
                            {crypto.logoUrl ? (
                              <img src={crypto.logoUrl} alt={crypto.cryptocurrency} className="w-4 h-4 rounded-full" />
                            ) : (
                              <Wallet className="w-4 h-4" />
                            )}
                            <span>{crypto.cryptocurrency.toUpperCase()} - {crypto.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Important Notice */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <p className="font-semibold text-blue-600 mb-2">💡 Automatic Amount Detection:</p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• <strong>No need to enter an amount</strong> - just select your cryptocurrency</li>
                    <li>• Send any amount you want to the generated address</li>
                    <li>• System automatically detects the exact amount from the blockchain</li>
                    <li>• You'll be credited for the USD value at the time of transaction</li>
                    <li>• Submit your transaction ID after payment for instant verification</li>
                  </ul>
                </div>

                <Button
                  onClick={handleOpenTermsDialog}
                  disabled={isCreating || !selectedCrypto || cooldownStatus.hasCooldown}
                  className="w-full"
                >
                  {cooldownStatus.hasCooldown ? (
                    <>
                      <Clock className="mr-2 h-4 w-4" />
                      Cooldown Active ({cooldownStatus.remainingMinutes}m remaining)
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="mr-2 h-4 w-4" />
                      Create Deposit
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deposit History Tab */}
          <TabsContent value="history" className="space-y-4">
            {deposits.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No deposits yet. Create your first deposit to get started!
                </CardContent>
              </Card>
            ) : (
              deposits.map((deposit) => (
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
                        <CardTitle className="text-lg">
                          {deposit.cryptocurrency.toUpperCase()} Deposit
                        </CardTitle>
                      </div>
                      {getStatusBadge(deposit.status, deposit.confirmations, deposit.verificationError)}
                    </div>
                    <CardDescription>
                      {new Date(deposit.createdAt).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="font-semibold">${deposit.amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Credits</p>
                        <p className="font-semibold">{deposit.credits.toFixed(2)}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Wallet Address</p>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                          {deposit.walletAddress}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(deposit.walletAddress)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCurrentDeposit(deposit);
                            setShowQRDialog(true);
                          }}
                        >
                          <QrCode className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {deposit.transactionId && (
                      <div>
                        <p className="text-sm text-muted-foreground">Transaction ID</p>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                            {deposit.transactionId}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(deposit.transactionId!)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {deposit.verificationError && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                        <p className="text-sm text-red-600">{deposit.verificationError}</p>
                      </div>
                    )}

                    {deposit.status === 'pending' && !deposit.transactionId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setCurrentDeposit(deposit);
                          setShowTxIdDialog(true);
                        }}
                      >
                        Submit Transaction ID
                      </Button>
                    )}

                    {deposit.status === 'pending' && deposit.transactionId && deposit.confirmations < 2 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleCheckConfirmations(deposit.id)}
                        disabled={isCheckingConfirmations === deposit.id}
                      >
                        {isCheckingConfirmations === deposit.id ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-3 w-3" />
                            Check Confirmations
                          </>
                        )}
                      </Button>
                    )}

                    {deposit.verifiedAt && (
                      <div className="text-xs text-muted-foreground">
                        Verified: {new Date(deposit.verifiedAt).toLocaleString()}
                      </div>
                    )}

                    {deposit.notes && (
                      <div>
                        <p className="text-sm text-muted-foreground">Admin Notes</p>
                        <p className="text-sm">{deposit.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Terms & Conditions Dialog */}
      <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Terms & Conditions</DialogTitle>
            <DialogDescription>
              Please read and agree to the terms before creating a deposit
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-3 text-sm">
              <h4 className="font-semibold">Deposit Terms:</h4>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>All deposits are final and non-refundable once processed</li>
                <li>Send any amount to the provided wallet address</li>
                <li>Credits will be added after 2 blockchain confirmations</li>
                <li>Minimum deposit amount is $1.00 USD equivalent</li>
                <li>1 USD = 1 Credit conversion rate</li>
                <li>You must submit a valid transaction ID after making payment</li>
                <li>Transaction verification is automatic via blockchain explorer</li>
                <li>Amount is automatically detected from the blockchain transaction</li>
                <li>You'll be credited for the USD value at the time of transaction</li>
                <li>Deposits sent to incorrect addresses cannot be recovered</li>
                <li>Each transaction ID can only be used once</li>
                <li>If you cancel a deposit, you cannot create a new one for 1 hour</li>
                <li>Successful deposits allow immediate subsequent deposits</li>
              </ul>
              
              <h4 className="font-semibold mt-4">Cooldown Policy:</h4>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>Cancelled Deposits:</strong> 1 hour cooldown before next deposit</li>
                <li><strong>Successful Deposits:</strong> No cooldown, deposit again immediately</li>
                <li><strong>Failed/Unsuccessful Deposits:</strong> 1 hour cooldown period applies</li>
              </ul>

              <h4 className="font-semibold mt-4">Your Responsibilities:</h4>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Verify the wallet address before sending payment</li>
                <li>Keep your transaction ID for reference</li>
                <li>Contact support if you experience issues</li>
                <li>Ensure you're using the correct cryptocurrency network</li>
              </ul>
            </div>

            <div className="flex items-start space-x-2 bg-primary/5 p-3 rounded-lg border border-primary/20">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              />
              <label
                htmlFor="terms"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                I have read and agree to the terms and conditions, including the cooldown policy
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTermsDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateDeposit}
              disabled={isCreating || !agreedToTerms}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Agree & Create Deposit'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code to Pay</DialogTitle>
            <DialogDescription>
              Scan this QR code with your {currentDeposit?.cryptocurrency.toUpperCase()} wallet
            </DialogDescription>
          </DialogHeader>
          {currentDeposit && (
            <div className="space-y-4">
              <div className="flex justify-center bg-white p-4 rounded-lg">
                <QRCodeCanvas
                  value={getQRCodeValue(currentDeposit.cryptocurrency, currentDeposit.walletAddress)}
                  size={256}
                  level="H"
                />
              </div>
              <div className="space-y-2">
                <Label>Wallet Address</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={currentDeposit.walletAddress}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(currentDeposit.walletAddress)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-sm">
                <p className="font-semibold text-green-600 mb-2">💰 Flexible Payment:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Send any amount of {currentDeposit.cryptocurrency.toUpperCase()} to the address above</li>
                  <li>System will auto-detect the exact amount from blockchain</li>
                  <li>You'll be credited based on USD value at transaction time</li>
                  <li>No minimum or maximum amount restrictions</li>
                </ul>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm">
                <p className="font-semibold text-blue-600 mb-2">📋 Next Steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Send crypto to the address above</li>
                  <li>Submit your transaction ID below</li>
                  <li>Wait for 2+ blockchain confirmations</li>
                  <li>Credits auto-added based on actual USD value</li>
                </ol>
              </div>
              {!currentDeposit.transactionId && (
                <Button
                  onClick={() => {
                    setShowQRDialog(false);
                    setShowTxIdDialog(true);
                  }}
                  className="w-full"
                >
                  Submit Transaction ID
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction ID Dialog */}
      <Dialog open={showTxIdDialog} onOpenChange={setShowTxIdDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Transaction ID</DialogTitle>
            <DialogDescription>
              Enter the transaction ID from your {currentDeposit?.cryptocurrency.toUpperCase()} wallet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="txid">Transaction ID (TXID)</Label>
              <Input
                id="txid"
                placeholder="Enter your transaction ID"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                You can find this in your wallet after sending the payment
              </p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm">
              <p className="font-semibold text-yellow-600 mb-1">Important:</p>
              <p className="text-muted-foreground">
                Make sure you've sent the payment before submitting the transaction ID.
                The system will automatically verify your transaction on the blockchain.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTxIdDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitTransactionId}
              disabled={isSubmittingTxId || !transactionId.trim()}
            >
              {isSubmittingTxId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Submit & Verify'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}