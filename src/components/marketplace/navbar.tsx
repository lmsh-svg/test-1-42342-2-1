'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Shield, ShoppingCart, Home, Settings, Package, LogOut, Award, User, Users, TicketCheck, Store, Wallet, CheckCircle, Menu } from 'lucide-react';
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
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-foreground hidden sm:inline">Secure Marketplace</span>
            <span className="text-lg font-bold text-foreground sm:hidden">Marketplace</span>
          </div>

          {/* Desktop Navigation - Hidden on mobile */}
          <div className="hidden lg:flex items-center gap-2">
            {/* Crypto Ticker - Always visible */}
            <CryptoTicker />

            {/* Credits Display - Always visible, shows loading state */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/marketplace/deposits')}
              className="gap-2 font-semibold"
              disabled={isLoadingCredits}
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Credits:</span>
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

            {/* Settings/Menu Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* Admin Dashboard Link - Only shown to admins */}
                {isAdmin && (
                  <>
                    <DropdownMenuItem onClick={() => router.push('/admin')}>
                      <Shield className="h-4 w-4 mr-2" />
                      Admin Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                
                {/* Common menu items for all users */}
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
                
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Navigation - Only visible on mobile */}
          <div className="flex lg:hidden items-center gap-2">
            {/* Crypto Ticker on mobile - compact */}
            <div className="hidden sm:block">
              <CryptoTicker />
            </div>

            {/* Mobile Menu Sheet */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[350px]">
                <SheetHeader className="mb-6">
                  <SheetTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Menu
                  </SheetTitle>
                </SheetHeader>

                <div className="flex flex-col gap-3">
                  {/* Credits Card */}
                  <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Your Credits</span>
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {isLoadingCredits ? (
                      <div className="text-2xl font-bold text-foreground">--</div>
                    ) : (
                      <div className="text-2xl font-bold text-primary">${credits.toFixed(2)}</div>
                    )}
                    <Button 
                      size="sm" 
                      className="w-full mt-3"
                      onClick={() => handleNavigation('/marketplace/deposits')}
                    >
                      Add Credits
                    </Button>
                  </div>

                  {/* Crypto Ticker on very small screens */}
                  <div className="sm:hidden bg-muted/50 rounded-lg p-3 border border-border/50">
                    <CryptoTicker />
                  </div>

                  {/* Main Navigation */}
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => handleNavigation('/marketplace')}
                    >
                      <Home className="h-5 w-5" />
                      <span className="text-base">Home</span>
                    </Button>

                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => handleNavigation('/marketplace/browse')}
                    >
                      <Store className="h-5 w-5" />
                      <span className="text-base">Browse Products</span>
                    </Button>

                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => handleNavigation('/marketplace/cart')}
                    >
                      <ShoppingCart className="h-5 w-5" />
                      <span className="text-base">Shopping Cart</span>
                    </Button>

                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => handleNavigation('/marketplace/orders')}
                    >
                      <Package className="h-5 w-5" />
                      <span className="text-base">My Orders</span>
                    </Button>
                  </div>

                  {/* Separator */}
                  <div className="border-t border-border/50 my-2" />

                  {/* Admin Dashboard - Only for admins */}
                  {isAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 h-12"
                        onClick={() => handleNavigation('/admin')}
                      >
                        <Shield className="h-5 w-5" />
                        <span className="text-base">Admin Dashboard</span>
                      </Button>
                      <div className="border-t border-border/50 my-2" />
                    </>
                  )}

                  {/* Additional Options */}
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => handleNavigation('/marketplace/rewards')}
                    >
                      <Award className="h-5 w-5" />
                      <span className="text-base">Rewards</span>
                    </Button>

                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => handleNavigation('/marketplace/verify-deposit')}
                    >
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-base">Verify Deposit</span>
                    </Button>

                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => handleNavigation('/marketplace/settings')}
                    >
                      <Settings className="h-5 w-5" />
                      <span className="text-base">Settings</span>
                    </Button>

                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => handleNavigation('/marketplace/support')}
                    >
                      <TicketCheck className="h-5 w-5" />
                      <span className="text-base">Support</span>
                    </Button>
                  </div>

                  {/* Separator */}
                  <div className="border-t border-border/50 my-2" />

                  {/* Logout */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-12 text-destructive hover:text-destructive"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="text-base">Logout</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}