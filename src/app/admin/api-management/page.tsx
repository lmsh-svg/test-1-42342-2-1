'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { AdminTabs } from '@/components/admin/admin-tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Package, Settings } from 'lucide-react';
import { ProductJSONSync } from './product-json-sync';
import { useInactivityLogout } from '@/hooks/use-inactivity-logout';
import { InactivityWarning } from '@/components/auth/inactivity-warning';
import Link from 'next/link';

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
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { showWarning, secondsRemaining, dismissWarning } = useInactivityLogout(!!user);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchLogs();
    }
  }, [user]);

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
    } finally {
      setIsLoading(false);
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
              <h1 className="text-4xl font-bold">Product Import</h1>
              <p className="text-muted-foreground mt-2">
                Import products from your Product API JSON. Paste your full API response below to sync products.
              </p>
            </div>
            <Link href="/admin/product-corrections">
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Manage Corrections
              </Button>
            </Link>
          </div>
        </div>

        {/* Main Product Import Component */}
        <ProductJSONSync 
          onSyncComplete={() => {
            fetchLogs();
          }}
        />

        {/* Recent Import Logs */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Import History</CardTitle>
                <CardDescription>Recent product imports and their status</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={fetchLogs}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No imports yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Import products using the form above to see history here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="border-l-4 pl-4 py-2 rounded-r" style={{
                    borderColor: log.status === 'success' ? 'hsl(var(--primary))' : log.status === 'error' ? 'hsl(var(--destructive))' : 'hsl(var(--muted))'
                  }}>
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <p className="font-medium text-sm flex-1">{log.message}</p>
                      <Badge variant={log.status === 'success' ? 'default' : log.status === 'error' ? 'destructive' : 'outline'}>
                        {log.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                      <span>•</span>
                      <span>{log.action}</span>
                      {log.productsProcessed !== null && (
                        <>
                          <span>•</span>
                          <span>{log.productsProcessed} processed</span>
                        </>
                      )}
                      {log.productsCreated !== null && log.productsCreated > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {log.productsCreated} created
                          </span>
                        </>
                      )}
                      {log.productsUpdated !== null && log.productsUpdated > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {log.productsUpdated} updated
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <InactivityWarning
        open={showWarning}
        secondsRemaining={secondsRemaining}
        onDismiss={dismissWarning}
      />
    </div>
  );
}