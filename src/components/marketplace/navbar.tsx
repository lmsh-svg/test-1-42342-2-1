'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Shield, ShoppingCart, Home, Settings, Package, LogOut, Award, User, Users, TicketCheck, Store, Wallet, CheckCircle, Menu, HelpCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import CryptoTicker from '@/components/marketplace/crypto-ticker';

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [credits, setCredits] = useState<number>(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchUserCredits();
    } else {
      setIsLoadingCredits(false);
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

  const handleNavigation = (path: string) => {
    setMobileMenuOpen(false);
    router.push(path);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-lg">
      {/* Desktop Navigation */}
      <div className="hidden lg:block">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo/Brand */}
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold text-foreground">Secure Marketplace</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Crypto Ticker */}
              <CryptoTicker />

              {/* Credits Display */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/marketplace/deposits')}
                className="gap-2 font-semibold"
                disabled={isLoadingCredits}
              >
                <Wallet className="h-4 w-4" />
                <span>Credits:</span>
                {isLoadingCredits ? (
                  <span className="text-muted-foreground">--</span>
                ) : (
                  <span className="text-primary">${credits.toFixed(2)}</span>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/marketplace')}
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/marketplace/browse')}
                className="gap-2"
              >
                <Store className="h-4 w-4" />
                <span>Browse</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/marketplace/orders')}
                className="gap-2"
              >
                <Package className="h-4 w-4" />
                <span>Orders</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/marketplace/cart')}
                className="gap-2"
              >
                <ShoppingCart className="h-4 w-4" />
                <span>Cart</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/marketplace/reward-store')}
                className="gap-2 text-amber-600 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-400"
              >
                <Award className="h-4 w-4" />
                <span>Rewards Store</span>
              </Button>

              {/* Settings/Menu Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Settings className="h-4 w-4" />
                    <span>Menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {isAdmin && (
                    <>
                      <DropdownMenuItem onClick={() => router.push('/admin')}>
                        <Shield className="h-4 w-4 mr-2" />
                        Admin Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  
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
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Support
                  </DropdownMenuItem>
                  
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
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        {/* Top Bar */}
        <div className="max-w-7xl mx-auto px-3">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-base font-bold text-foreground">Marketplace</span>
            </div>

            {/* Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <SheetHeader className="mb-4">
                  <SheetTitle className="text-left">Menu</SheetTitle>
                </SheetHeader>

                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleNavigation('/marketplace')}
                  >
                    <Home className="h-5 w-5" />
                    <span>Home</span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleNavigation('/marketplace/browse')}
                  >
                    <Store className="h-5 w-5" />
                    <span>View Products</span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleNavigation('/marketplace/cart')}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    <span>Shopping Cart</span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleNavigation('/marketplace/orders')}
                  >
                    <Package className="h-5 w-5" />
                    <span>My Orders</span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleNavigation('/marketplace/rewards')}
                  >
                    <Award className="h-5 w-5" />
                    <span>Rewards</span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleNavigation('/marketplace/verify-deposit')}
                  >
                    <CheckCircle className="h-5 w-5" />
                    <span>Verified Deposit</span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleNavigation('/marketplace/settings')}
                  >
                    <Settings className="h-5 w-5" />
                    <span>Settings</span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleNavigation('/marketplace/support')}
                  >
                    <HelpCircle className="h-5 w-5" />
                    <span>Support</span>
                  </Button>

                  {isAdmin && (
                    <>
                      <div className="border-t border-border/50 my-2" />
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 h-11"
                        onClick={() => handleNavigation('/admin')}
                      >
                        <Shield className="h-5 w-5" />
                        <span>Admin Dashboard</span>
                      </Button>
                    </>
                  )}

                  <div className="border-t border-border/50 my-2" />

                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11 text-destructive hover:text-destructive"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Credits & Crypto Bar - Mobile Only */}
        <div className="border-t border-border/50 bg-muted/30">
          <div className="max-w-7xl mx-auto px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              {/* Credits - Prominent Display */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/marketplace/deposits')}
                className="gap-2 font-semibold flex-1 h-9 bg-card/50"
                disabled={isLoadingCredits}
              >
                <Wallet className="h-4 w-4" />
                <span className="text-xs">Credits:</span>
                {isLoadingCredits ? (
                  <span className="text-xs text-muted-foreground">--</span>
                ) : (
                  <span className="text-xs font-bold text-primary">${credits.toFixed(2)}</span>
                )}
              </Button>

              {/* Crypto Ticker */}
              <div className="flex-shrink-0">
                <CryptoTicker />
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}