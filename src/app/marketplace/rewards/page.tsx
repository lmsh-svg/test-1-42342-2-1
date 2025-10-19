'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import Navbar from '@/components/marketplace/navbar';
import { Award, TrendingUp, DollarSign, Loader2, Trophy, Star } from 'lucide-react';
import { toast } from 'sonner';

interface RewardData {
  userId: number;
  totalSpent: number;
  cashbackBalance: number;
  currentTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  cashbackRate: number;
  tierThresholds: {
    bronze: { min: number; max: number; cashbackRate: number };
    silver: { min: number; max: number; cashbackRate: number };
    gold: { min: number; max: number; cashbackRate: number };
    platinum: { min: number; cashbackRate: number };
  };
  nextTier: string | null;
  amountUntilNextTier: number;
  tierDescription: string;
}

const TIER_CONFIG = {
  bronze: {
    name: 'Bronze',
    color: 'bg-gradient-to-r from-amber-600 to-amber-800',
    icon: '🥉',
    textColor: 'text-amber-600',
  },
  silver: {
    name: 'Silver',
    color: 'bg-gradient-to-r from-slate-400 to-slate-600',
    icon: '🥈',
    textColor: 'text-slate-400',
  },
  gold: {
    name: 'Gold',
    color: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
    icon: '🥇',
    textColor: 'text-yellow-500',
  },
  platinum: {
    name: 'Platinum',
    color: 'bg-gradient-to-r from-purple-400 to-purple-600',
    icon: '💎',
    textColor: 'text-purple-400',
  },
};

export default function RewardsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  
  const [rewardData, setRewardData] = useState<RewardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchRewardData();
    }
  }, [user, authLoading]);

  const fetchRewardData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/user/rewards?userId=${user?.id}`);
      
      if (res.ok) {
        const data = await res.json();
        setRewardData(data);
      } else {
        toast.error('Failed to load reward data');
      }
    } catch (error) {
      console.error('Failed to fetch reward data:', error);
      toast.error('Failed to load reward data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateProgress = () => {
    if (!rewardData) return 0;
    
    const { totalSpent, currentTier, nextTier, tierThresholds } = rewardData;
    
    if (!nextTier) return 100; // Platinum tier
    
    const currentMin = tierThresholds[currentTier as keyof typeof tierThresholds].min;
    const nextMin = tierThresholds[nextTier as keyof typeof tierThresholds].min;
    const range = nextMin - currentMin;
    const progress = totalSpent - currentMin;
    
    return Math.min(100, (progress / range) * 100);
  };

  if (authLoading || isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (!rewardData) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
          <p className="text-muted-foreground">Failed to load reward data</p>
        </div>
      </>
    );
  }

  const tierConfig = TIER_CONFIG[rewardData.currentTier];
  const progress = calculateProgress();

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
              <Award className="h-10 w-10 text-primary" />
              Rewards Program
            </h1>
            <p className="text-muted-foreground">Track your tier progress and earn cashback on purchases</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Current Tier Card */}
            <Card className="border-border/50 bg-card/50 backdrop-blur col-span-1 md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Current Tier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-6">
                  <div className={`text-6xl ${tierConfig.textColor}`}>
                    {tierConfig.icon}
                  </div>
                  <div>
                    <h2 className={`text-3xl font-bold ${tierConfig.textColor}`}>
                      {tierConfig.name}
                    </h2>
                    <p className="text-muted-foreground">{rewardData.tierDescription}</p>
                    <Badge variant="secondary" className="mt-2">
                      {rewardData.cashbackRate}% Cashback
                    </Badge>
                  </div>
                </div>

                {rewardData.nextTier && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress to {TIER_CONFIG[rewardData.nextTier as keyof typeof TIER_CONFIG].name}</span>
                      <span className="font-medium">{progress.toFixed(1)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground">
                      Spend ${rewardData.amountUntilNextTier.toFixed(2)} more to unlock {rewardData.nextTier} tier
                    </p>
                  </div>
                )}

                {!rewardData.nextTier && (
                  <div className="text-center py-4">
                    <Star className="h-12 w-12 text-purple-400 mx-auto mb-2" />
                    <p className="text-lg font-semibold text-purple-400">Maximum Tier Achieved!</p>
                    <p className="text-sm text-muted-foreground">You're earning the highest cashback rate</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="space-y-6">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Total Spent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">${rewardData.totalSpent.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Lifetime purchases</p>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Cashback Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">${rewardData.cashbackBalance.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Available to use</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* All Tiers */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>Reward Tiers</CardTitle>
              <CardDescription>Unlock higher tiers by increasing your total spending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(TIER_CONFIG).map(([key, config]) => {
                  const tierKey = key as keyof typeof TIER_CONFIG;
                  const tierInfo = rewardData.tierThresholds[tierKey];
                  const isCurrentTier = rewardData.currentTier === tierKey;
                  const isUnlocked = rewardData.totalSpent >= tierInfo.min;

                  return (
                    <div
                      key={key}
                      className={`relative p-6 rounded-lg border-2 transition-all ${
                        isCurrentTier
                          ? 'border-primary bg-primary/5 scale-105'
                          : isUnlocked
                          ? 'border-border/50 bg-background/50'
                          : 'border-border/30 bg-background/30 opacity-60'
                      }`}
                    >
                      {isCurrentTier && (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Current</Badge>
                      )}
                      <div className="text-center space-y-2">
                        <div className={`text-4xl ${config.textColor}`}>{config.icon}</div>
                        <h3 className={`font-bold text-lg ${config.textColor}`}>{config.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {tierKey === 'platinum'
                            ? `$${tierInfo.min.toLocaleString()}+`
                            : `$${tierInfo.min.toLocaleString()} - $${tierInfo.max.toLocaleString()}`}
                        </p>
                        <Badge variant={isUnlocked ? 'default' : 'secondary'}>
                          {tierInfo.cashbackRate}% Cashback
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}