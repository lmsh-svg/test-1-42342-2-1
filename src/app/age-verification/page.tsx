'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

export default function AgeVerificationPage() {
  const router = useRouter();
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    // Check if already verified
    const verified = localStorage.getItem('age_verified');
    const blocked = localStorage.getItem('age_blocked');
    const blockedUntil = localStorage.getItem('age_blocked_until');

    if (blocked && blockedUntil) {
      const blockedTime = parseInt(blockedUntil);
      if (Date.now() < blockedTime) {
        router.push('/access-denied');
        return;
      } else {
        // Block expired, clear it
        localStorage.removeItem('age_blocked');
        localStorage.removeItem('age_blocked_until');
      }
    }

    if (verified === 'true') {
      setIsVerified(true);
      router.push('/login');
    }
  }, [router]);

  const handleVerify = (isOver21: boolean) => {
    if (isOver21) {
      localStorage.setItem('age_verified', 'true');
      setIsVerified(true);
      router.push('/login');
    } else {
      // Block for 24 hours
      const blockUntil = Date.now() + (24 * 60 * 60 * 1000);
      localStorage.setItem('age_blocked', 'true');
      localStorage.setItem('age_blocked_until', blockUntil.toString());
      router.push('/access-denied');
    }
  };

  if (isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-lg p-8">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mx-auto">
            <ShieldAlert className="h-10 w-10 text-primary" />
          </div>
          
          <div>
            <h1 className="text-3xl font-bold mb-3">Age Verification Required</h1>
            <p className="text-muted-foreground text-lg">
              You must be 21 years or older to access this marketplace.
            </p>
          </div>

          <div className="pt-6 space-y-3">
            <Button
              onClick={() => handleVerify(true)}
              className="w-full h-14 text-lg"
              size="lg"
            >
              I am 21 or older
            </Button>
            
            <Button
              onClick={() => handleVerify(false)}
              variant="outline"
              className="w-full h-14 text-lg"
              size="lg"
            >
              I am under 21
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-4">
            By clicking "I am 21 or older", you confirm that you meet the minimum age requirement.
          </p>
        </div>
      </Card>
    </div>
  );
}