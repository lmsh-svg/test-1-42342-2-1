'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Shield, ShoppingCart, Home, Settings, Package, LogOut, Award, User, Users, TicketCheck, Store, Wallet, CheckCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import CryptoTicker from '@/components/marketplace/crypto-ticker';

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [credits, setCredits] = useState<number>(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchUserCredits();
    }
  }, [user?.id]);

  const fetchUserCredits = async () => {
    try {
      const response = await fetch(`/api/user/profile?userId=${user?.id}`);
      if (response.ok) {
        const userData = await response.json();
        setCredits(userData.credits || 0);
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    } finally {
      setIsLoadingCredits(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-foreground">Secure Marketplace</span>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-2">
            {/* Crypto Ticker - Next to Credits */}
            <CryptoTicker />

            {/* Credits Display - Clickable */}
            {!isLoadingCredits && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/marketplace/deposits')}
                className="gap-2 font-semibold"
              >
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Credits:</span>
                <span className="text-primary">${credits.toFixed(2)}</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/marketplace')}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/marketplace/browse')}
              className="gap-2"
            >
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Browse</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/marketplace/orders')}
              className="gap-2"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Orders</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/marketplace/cart')}
              className="gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Cart</span>
            </Button>

            {/* Settings/Admin Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {isAdmin ? (
                  <>
                    <DropdownMenuItem onClick={() => router.push('/admin')}>
                      <Shield className="h-4 w-4 mr-2" />
                      Admin Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/admin/orders')}>
                      <Package className="h-4 w-4 mr-2" />
                      Manage Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/admin/users')}>
                      <Users className="h-4 w-4 mr-2" />
                      Manage Users
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/admin/verifications')}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Crypto Verifications
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/marketplace/support')}>
                      <TicketCheck className="h-4 w-4 mr-2" />
                      Support Tickets
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => router.push('/marketplace/orders')}>
                      <Package className="h-4 w-4 mr-2" />
                      My Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/marketplace/rewards')}>
                      <Award className="h-4 w-4 mr-2" />
                      Rewards
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/marketplace/verify-deposit')}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Verify Deposit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/marketplace/settings')}>
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/marketplace/support')}>
                      <TicketCheck className="h-4 w-4 mr-2" />
                      Support
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}