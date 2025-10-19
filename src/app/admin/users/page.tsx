'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowLeft, UserPlus, Trash2, RefreshCw, Copy, Check, MapPin } from 'lucide-react';

interface User {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
  hasLocalAccess: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'customer',
  });

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    } else if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user, authLoading, router]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('/api/users?limit=1000', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSecurePassword = () => {
    // Generate cryptographically secure random password
    const length = 24;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    // Use crypto.getRandomValues for cryptographic security
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);
    
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[randomValues[i] % charset.length];
    }
    
    setUserForm({ ...userForm, password });
    setCopiedPassword(false);
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(userForm.password);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch (error) {
      console.error('Failed to copy password:', error);
    }
  };

  const handleCreateUser = async () => {
    if (!userForm.username.trim() || !userForm.password.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: userForm.username.toLowerCase().trim(),
          passwordHash: userForm.password,
          role: userForm.role,
          isActive: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsDialogOpen(false);
        fetchUsers();
        setUserForm({ username: '', password: '', role: 'customer' });
      } else {
        alert(data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('An error occurred while creating the user');
    }
  };

  const handleToggleActive = async (userId: number, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      await fetch(`/api/users?id=${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      fetchUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  const handleToggleLocalAccess = async (userId: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`/api/admin/users/${userId}/local-access?id=${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchUsers();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to toggle local access');
      }
    } catch (error) {
      console.error('Error toggling local access:', error);
      alert('An error occurred while toggling local access');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('⚠️ PERMANENT DELETION WARNING\n\nThis will COMPLETELY DELETE this user and ALL related data including:\n• All reviews and review images\n• All orders and order items\n• All support tickets and messages\n• All tracking information\n• Reward tier data\n\nThis action CANNOT be undone!\n\nAre you absolutely sure you want to proceed?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ User successfully deleted!\n\nDeleted records:\n• Reviews: ${data.deletedRecords.productReviews}\n• Orders: ${data.deletedRecords.orders}\n• Order Items: ${data.deletedRecords.orderItems}\n• Support Tickets: ${data.deletedRecords.supportTickets}\n• Ticket Messages: ${data.deletedRecords.ticketMessages}\n• Review Images: ${data.deletedRecords.reviewImages}\n• Tracking Info: ${data.deletedRecords.trackingInfo}\n• Reward Tiers: ${data.deletedRecords.userRewardTiers}`);
        fetchUsers();
      } else {
        const data = await response.json();
        alert(`Failed to delete user: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('An error occurred while deleting the user');
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">User Management</h1>
          <Button onClick={() => setIsDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => (
            <Card key={u.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">@{u.username}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">ID: {u.id}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge variant={u.isActive ? 'default' : 'secondary'}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {u.hasLocalAccess && (
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="h-3 w-3" />
                        Local
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Role:</span>
                    <span className="font-medium capitalize">{u.role}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Joined:</span>
                    <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Local Access:</span>
                    <span className="font-medium">{u.hasLocalAccess ? 'Yes' : 'No'}</span>
                  </div>
                </div>

                {u.role !== 'admin' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(u.id, u.isActive)}
                        className="flex-1"
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteUser(u.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant={u.hasLocalAccess ? 'default' : 'outline'}
                      onClick={() => handleToggleLocalAccess(u.id)}
                      className="w-full gap-2"
                    >
                      <MapPin className="h-4 w-4" />
                      {u.hasLocalAccess ? 'Revoke Local Access' : 'Grant Local Access'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                type="text"
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                placeholder="username"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground mt-1">
                3-20 characters, lowercase letters, numbers, underscore, or hyphen
              </p>
            </div>
            
            <div>
              <Label htmlFor="password">Password *</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type="text"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Enter or generate password"
                  autoComplete="new-password"
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={generateSecurePassword}
                  title="Generate secure password"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyPassword}
                  disabled={!userForm.password}
                  title="Copy password"
                >
                  {copiedPassword ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Click <RefreshCw className="inline h-3 w-3" /> to generate a cryptographically secure 24-character password
              </p>
            </div>
            
            <div>
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                placeholder="customer"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default: customer (use 'admin' for admin privileges)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser}>
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}