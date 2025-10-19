'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

interface CryptoAddress {
  id: number;
  cryptocurrency: string;
  logoUrl: string | null;
}

interface PriceData {
  price: number;
  previousPrice: number;
  priceChange: 'up' | 'down' | 'neutral';
  logo: string | null;
  lastUpdated: number;
}

const CRYPTO_PRICE_APIS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  LTC: 'litecoin',
  DOGE: 'dogecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  SOL: 'solana',
  DOT: 'polkadot',
};

export default function CryptoTicker() {
  const [cryptoAddresses, setCryptoAddresses] = useState<CryptoAddress[]>([]);
  const [priceDataMap, setPriceDataMap] = useState<Map<string, PriceData>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const loadCryptoAddresses = async () => {
      try {
        const res = await fetch('/api/admin/crypto-addresses?isActive=true');
        if (res.ok) {
          const data = await res.json();
          setCryptoAddresses(data);
        }
      } catch (error) {
        console.error('Failed to load crypto addresses:', error);
      }
    };

    loadCryptoAddresses();
  }, []);

  useEffect(() => {
    if (cryptoAddresses.length === 0) return;

    const fetchPrices = async () => {
      for (const crypto of cryptoAddresses) {
        const currency = crypto.cryptocurrency.toUpperCase();
        const coinGeckoId = CRYPTO_PRICE_APIS[currency];
        
        if (!coinGeckoId) continue;

        try {
          const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`
          );
          
          if (res.ok) {
            const data = await res.json();
            const newPrice = data[coinGeckoId]?.usd || 0;
            
            if (newPrice > 0) {
              setPriceDataMap(prev => {
                const newMap = new Map(prev);
                const currentData = newMap.get(currency);
                
                const now = Date.now();
                const previousPrice = currentData?.price || newPrice;
                
                // Determine price change - always show arrow after first update
                let priceChange: 'up' | 'down' | 'neutral' = 'neutral';
                
                if (currentData && previousPrice > 0 && newPrice !== previousPrice) {
                  priceChange = newPrice > previousPrice ? 'up' : 'down';
                }
                
                newMap.set(currency, {
                  price: newPrice,
                  previousPrice: currentData?.price || newPrice,
                  priceChange,
                  logo: crypto.logoUrl,
                  lastUpdated: now,
                });
                
                return newMap;
              });
            }
          }
        } catch (error) {
          console.error(`Failed to fetch price for ${currency}:`, error);
        }
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [cryptoAddresses]);

  // Rotate through cryptocurrencies
  useEffect(() => {
    if (cryptoAddresses.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        let nextIndex = (prev + 1) % cryptoAddresses.length;
        let attempts = 0;
        
        while (attempts < cryptoAddresses.length) {
          const nextCrypto = cryptoAddresses[nextIndex];
          const nextPriceData = priceDataMap.get(nextCrypto.cryptocurrency.toUpperCase());
          
          if (nextPriceData && nextPriceData.price > 0) {
            return nextIndex;
          }
          
          nextIndex = (nextIndex + 1) % cryptoAddresses.length;
          attempts++;
        }
        
        return prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [cryptoAddresses, priceDataMap]);

  // Always show loading state or current crypto - never return null
  if (cryptoAddresses.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/50">
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  const currentCrypto = cryptoAddresses[currentIndex];
  const currentPriceData = priceDataMap.get(currentCrypto.cryptocurrency.toUpperCase());

  // If current crypto has no data, find first crypto with valid data
  if (!currentPriceData || currentPriceData.price === 0) {
    for (let i = 0; i < cryptoAddresses.length; i++) {
      const crypto = cryptoAddresses[i];
      const priceData = priceDataMap.get(crypto.cryptocurrency.toUpperCase());
      if (priceData && priceData.price > 0) {
        // Render this crypto instead
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/50">
            {priceData.logo ? (
              <img
                src={priceData.logo}
                alt={crypto.cryptocurrency}
                className="w-4 h-4 rounded-full"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-[8px] font-bold text-primary">
                  {crypto.cryptocurrency.slice(0, 1).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-xs font-semibold text-foreground">
              {crypto.cryptocurrency.toUpperCase()}
            </span>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              ${priceData.price < 1 
                ? priceData.price.toFixed(4)
                : priceData.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              }
            </span>
            {priceData.priceChange === 'up' && (
              <TrendingUp className="w-3 h-3 text-green-500" />
            )}
            {priceData.priceChange === 'down' && (
              <TrendingDown className="w-3 h-3 text-red-500" />
            )}
          </div>
        );
      }
    }
    
    // No data loaded yet - show loading
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/50">
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading prices...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/50">
      {currentPriceData.logo ? (
        <img
          src={currentPriceData.logo}
          alt={currentCrypto.cryptocurrency}
          className="w-4 h-4 rounded-full"
        />
      ) : (
        <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-[8px] font-bold text-primary">
            {currentCrypto.cryptocurrency.slice(0, 1).toUpperCase()}
          </span>
        </div>
      )}
      <span className="text-xs font-semibold text-foreground">
        {currentCrypto.cryptocurrency.toUpperCase()}
      </span>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">
        ${currentPriceData.price < 1 
          ? currentPriceData.price.toFixed(4)
          : currentPriceData.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
        }
      </span>
      {currentPriceData.priceChange === 'up' && (
        <TrendingUp className="w-3 h-3 text-green-500" />
      )}
      {currentPriceData.priceChange === 'down' && (
        <TrendingDown className="w-3 h-3 text-red-500" />
      )}
    </div>
  );
}