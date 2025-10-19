'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Radio, RadioTower, WifiOff, Play, Square } from 'lucide-react';
import { toast } from 'sonner';

export function WebSocketMonitorCard() {
  const [status, setStatus] = useState<'not_initialized' | 'connecting' | 'connected' | 'closing' | 'closed'>('not_initialized');
  const [trackedAddresses, setTrackedAddresses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/crypto/websocket-monitor');
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setTrackedAddresses(data.trackedAddresses || []);
      }
    } catch (error) {
      console.error('Failed to check WebSocket status:', error);
    }
  };

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/crypto/websocket-monitor', {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Started monitoring ${data.count} addresses`);
        checkStatus();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to start monitoring');
      }
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      toast.error('Failed to start monitoring');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/crypto/websocket-monitor', {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Stopped monitoring');
        checkStatus();
      } else {
        toast.error('Failed to stop monitoring');
      }
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
      toast.error('Failed to stop monitoring');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-500"><Radio className="h-3 w-3 mr-1 animate-pulse" /> Connected</Badge>;
      case 'connecting':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Connecting</Badge>;
      case 'closing':
        return <Badge variant="secondary">Closing</Badge>;
      case 'closed':
        return <Badge variant="secondary"><WifiOff className="h-3 w-3 mr-1" /> Disconnected</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <RadioTower className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Real-Time Monitoring</CardTitle>
              <CardDescription>
                WebSocket connection to mempool.space for live transaction tracking
              </CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Tracked Addresses</div>
            <div className="text-2xl font-bold">{trackedAddresses.length}</div>
          </div>
          <div className="flex gap-2">
            {status === 'connected' ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStop}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleStart}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Monitoring
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {trackedAddresses.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="font-medium">Monitoring addresses:</div>
            {trackedAddresses.slice(0, 3).map((addr, idx) => (
              <div key={idx} className="font-mono truncate">
                {addr}
              </div>
            ))}
            {trackedAddresses.length > 3 && (
              <div>+ {trackedAddresses.length - 3} more...</div>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground border-t pt-3">
          <strong>How it works:</strong> This WebSocket connection monitors your configured Bitcoin 
          addresses in real-time. When a transaction is sent to any of your addresses, it will be 
          automatically detected and recorded in the verifications table.
        </div>
      </CardContent>
    </Card>
  );
}