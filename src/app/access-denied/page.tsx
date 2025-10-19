'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ShieldX } from 'lucide-react';

export default function AccessDeniedPage() {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    const updateTimeRemaining = () => {
      const blockedUntil = localStorage.getItem('age_blocked_until');
      if (blockedUntil) {
        const remaining = parseInt(blockedUntil) - Date.now();
        if (remaining > 0) {
          const hours = Math.floor(remaining / (1000 * 60 * 60));
          const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          setTimeRemaining(`${hours} hours and ${minutes} minutes`);
        } else {
          setTimeRemaining('');
          localStorage.removeItem('age_blocked');
          localStorage.removeItem('age_blocked_until');
          window.location.href = '/age-verification';
        }
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-lg p-8">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-destructive/10 rounded-full mx-auto">
            <ShieldX className="h-10 w-10 text-destructive" />
          </div>
          
          <div>
            <h1 className="text-3xl font-bold mb-3">Access Denied</h1>
            <p className="text-muted-foreground text-lg mb-4">
              We're sorry, but you must be 21 years or older to access this marketplace.
            </p>
            <p className="text-sm text-muted-foreground">
              This is a legal requirement for age-restricted products and services.
            </p>
          </div>

          {timeRemaining && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">
                You are temporarily blocked from accessing this site.
              </p>
              <p className="text-lg font-bold text-foreground mt-2">
                Time remaining: {timeRemaining}
              </p>
            </div>
          )}

          <div className="pt-6 space-y-2 text-xs text-muted-foreground">
            <p>If you believe this is an error, please contact our support team.</p>
            <p className="font-mono">support@marketplace.example.com</p>
          </div>
        </div>
      </Card>
    </div>
  );
}