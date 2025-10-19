'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Package } from 'lucide-react';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Check age verification first
    const ageVerified = localStorage.getItem('age_verified');
    const ageBlocked = localStorage.getItem('age_blocked');
    const blockedUntil = localStorage.getItem('age_blocked_until');

    // If blocked, check if block is still active
    if (ageBlocked && blockedUntil) {
      const blockTime = parseInt(blockedUntil);
      if (Date.now() < blockTime) {
        router.push('/access-denied');
        return;
      } else {
        // Block expired
        localStorage.removeItem('age_blocked');
        localStorage.removeItem('age_blocked_until');
      }
    }

    // If not age verified, redirect to age verification
    if (ageVerified !== 'true') {
      router.push('/age-verification');
      return;
    }

    // Age verified, proceed with normal auth flow
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/marketplace');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Package className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}