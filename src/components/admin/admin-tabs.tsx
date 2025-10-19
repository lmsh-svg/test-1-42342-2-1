'use client';

import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Users, 
  Coins, 
  Wallet, 
  CheckCircle, 
  TicketCheck, 
  Settings 
} from 'lucide-react';

const adminTabs = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Products', href: '/admin/products', icon: Package },
  { label: 'Orders', href: '/admin/orders', icon: ShoppingBag },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Deposits', href: '/admin/deposits', icon: Coins },
  { label: 'Crypto Addresses', href: '/admin/crypto-addresses', icon: Wallet },
  { label: 'Verifications', href: '/admin/verifications', icon: CheckCircle },
  { label: 'Support', href: '/marketplace/support', icon: TicketCheck },
  { label: 'API Management', href: '/admin/api-management', icon: Settings },
];

export function AdminTabs() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="border-b border-border bg-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {adminTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
            
            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                  isActive
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}