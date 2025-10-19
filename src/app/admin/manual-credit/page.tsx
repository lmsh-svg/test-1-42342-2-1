'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Coins, ArrowLeft, Loader2, DollarSign, Bitcoin } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string | null;
  credits: number;
}

interface ManualCredit {
  id: string;
  userId: string;
  adminId: string;
  amount: number;
  creditType: 'crypto_transaction' | 'local_cash';
  transactionId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdAt: string;
  user: {
    email: string;
    name: string | null;
  };
  admin: {
    email: string;
  };
}

export default function ManualCreditPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState<User[]>([]);
  const [history, setHistory] = useState<ManualCredit[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    userId: '',
    amount: '',
    creditType: 'crypto_transaction' as 'crypto_transaction' | 'local_cash',
    transactionId: '',
    referenceNumber: '',
    notes: '',
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'admin') {
        router.push('/marketplace');
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
      fetchHistory();
    }
  }, [user]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('bearer_token')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/admin/manual-credit', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('bearer_token')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.credits || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.userId) {
      toast.error('Please select a user');
      return;
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (formData.creditType === 'crypto_transaction' && !formData.transactionId) {
      toast.error('Please enter a transaction ID for crypto transactions');
      return;
    }
    
    if (formData.creditType === 'local_cash' && !formData.referenceNumber) {
      toast.error('Please enter a reference number for local cash transactions');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/manual-credit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('bearer_token')}`,
        },
        body: JSON.stringify({
          userId: formData.userId,
          amount: parseFloat(formData.amount),
          creditType: formData.creditType,
          transactionId: formData.creditType === 'crypto_transaction' ? formData.transactionId : undefined,
          referenceNumber: formData.creditType === 'local_cash' ? formData.referenceNumber : undefined,
          notes: formData.notes || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Credits added successfully');
        setFormData({
          userId: '',
          amount: '',
          creditType: 'crypto_transaction',
          transactionId: '',
          referenceNumber: '',
          notes: '',
        });
        fetchHistory();
        fetchUsers(); // Refresh to show updated credits
      } else {
        toast.error(data.error || 'Failed to add credits');
      }
    } catch (error) {
      toast.error('An error occurred');
      console.error('Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Manual Credit Management</h1>
            <p className="text-muted-foreground">
              Manually credit user accounts with secure transaction tracking
            </p>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Credit Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Add Credits
              </CardTitle>
              <CardDescription>
                Credit a user account with verified transaction tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="user">Select User</Label>
                  <Select
                    value={formData.userId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, userId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingUsers ? (
                        <div className="p-4 text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        </div>
                      ) : (
                        users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.email} - ${u.credits.toFixed(2)} credits
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="creditType">Credit Type</Label>
                  <Select
                    value={formData.creditType}
                    onValueChange={(value: 'crypto_transaction' | 'local_cash') =>
                      setFormData({ 
                        ...formData, 
                        creditType: value,
                        transactionId: '',
                        referenceNumber: '',
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crypto_transaction">
                        <div className="flex items-center gap-2">
                          <Bitcoin className="h-4 w-4" />
                          Crypto Transaction
                        </div>
                      </SelectItem>
                      <SelectItem value="local_cash">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Local Cash
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.creditType === 'crypto_transaction' ? (
                  <div className="space-y-2">
                    <Label htmlFor="transactionId">Transaction ID</Label>
                    <Input
                      id="transactionId"
                      placeholder="Enter blockchain transaction ID"
                      value={formData.transactionId}
                      onChange={(e) =>
                        setFormData({ ...formData, transactionId: e.target.value })
                      }
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be a unique transaction ID not used before
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="referenceNumber">Reference Number</Label>
                    <Input
                      id="referenceNumber"
                      placeholder="Enter unique reference number"
                      value={formData.referenceNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, referenceNumber: e.target.value })
                      }
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Unique reference for local cash payment tracking
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Reason for manual credit (e.g., wrong address, local cash payment, etc.)"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Coins className="mr-2 h-4 w-4" />
                      Add Credits
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                History of manual credit additions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No manual credits yet
                </p>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {history.slice(0, 10).map((credit) => (
                    <div
                      key={credit.id}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">
                            {credit.user.name || credit.user.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {credit.user.email}
                          </p>
                        </div>
                        <Badge variant="outline" className="font-mono">
                          +${credit.amount.toFixed(2)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {credit.creditType === 'crypto_transaction' ? (
                          <Bitcoin className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {credit.creditType === 'crypto_transaction'
                            ? 'Crypto Transaction'
                            : 'Local Cash'}
                        </span>
                      </div>

                      {credit.transactionId && (
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          TX: {credit.transactionId}
                        </p>
                      )}
                      
                      {credit.referenceNumber && (
                        <p className="text-xs text-muted-foreground font-mono">
                          Ref: {credit.referenceNumber}
                        </p>
                      )}
                      
                      {credit.notes && (
                        <p className="text-xs text-muted-foreground">
                          {credit.notes}
                        </p>
                      )}
                      
                      <p className="text-xs text-muted-foreground">
                        {new Date(credit.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Full History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Complete History</CardTitle>
            <CardDescription>
              All manual credit transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Admin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          No manual credits yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((credit) => (
                        <TableRow key={credit.id}>
                          <TableCell className="text-sm">
                            {new Date(credit.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">
                                {credit.user.name || 'No name'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {credit.user.email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {credit.creditType === 'crypto_transaction' ? (
                                <span className="flex items-center gap-1">
                                  <Bitcoin className="h-3 w-3" />
                                  Crypto
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  Cash
                                </span>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">
                            ${credit.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs font-mono max-w-[200px] truncate">
                            {credit.transactionId || credit.referenceNumber}
                          </TableCell>
                          <TableCell className="text-sm">
                            {credit.admin.email}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}