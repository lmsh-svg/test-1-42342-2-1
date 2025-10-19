'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

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
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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
                
                // Determine price change based on comparison with previous price
                // Only compare if we have a previous price and it's from the last 30 seconds
                let priceChange: 'up' | 'down' | 'neutral' = 'neutral';
                
                if (currentData && (now - currentData.lastUpdated) <= 30000) {
                  if (newPrice > previousPrice) {
                    priceChange = 'up';
                  } else if (newPrice < previousPrice) {
                    priceChange = 'down';
                  }
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
              
              if (isInitialLoad) {
                setIsInitialLoad(false);
              }
            }
          }
        } catch (error) {
          console.error(`Failed to fetch price for ${currency}:`, error);
        }
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [cryptoAddresses, isInitialLoad]);

  // Rotate through cryptocurrencies - only switch if next crypto has valid data
  useEffect(() => {
    if (cryptoAddresses.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        // Find next crypto with valid price data
        let nextIndex = (prev + 1) % cryptoAddresses.length;
        let attempts = 0;
        
        while (attempts < cryptoAddresses.length) {
          const nextCrypto = cryptoAddresses[nextIndex];
          const nextPriceData = priceDataMap.get(nextCrypto.cryptocurrency.toUpperCase());
          
          // Only switch if the next crypto has loaded price data
          if (nextPriceData && nextPriceData.price > 0) {
            return nextIndex;
          }
          
          nextIndex = (nextIndex + 1) % cryptoAddresses.length;
          attempts++;
        }
        
        // If no valid crypto found, keep current
        return prev;
      });
    }, 5000); // Rotate every 5 seconds

    return () => clearInterval(interval);
  }, [cryptoAddresses, priceDataMap]);

  // Don't render until we have crypto addresses and at least one has price data
  if (cryptoAddresses.length === 0 || isInitialLoad) return null;

  const currentCrypto = cryptoAddresses[currentIndex];
  const currentPriceData = priceDataMap.get(currentCrypto.cryptocurrency.toUpperCase());

  // Keep showing current crypto until we have valid data - don't disappear
  if (!currentPriceData || currentPriceData.price === 0) {
    // Try to find any crypto with valid data to display
    for (let i = 0; i < cryptoAddresses.length; i++) {
      const crypto = cryptoAddresses[i];
      const priceData = priceDataMap.get(crypto.cryptocurrency.toUpperCase());
      if (priceData && priceData.price > 0) {
        // Found a valid one, update current index
        if (currentIndex !== i) {
          setCurrentIndex(i);
        }
        // For now, return null and let the state update trigger re-render
        return null;
      }
    }
    // No valid data at all yet
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/50">
      {/* Crypto Icon */}
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

      {/* Crypto Symbol */}
      <span className="text-xs font-semibold text-foreground">
        {currentCrypto.cryptocurrency.toUpperCase()}
      </span>

      {/* Price */}
      <span className="text-xs font-medium tabular-nums text-muted-foreground">
        ${currentPriceData.price < 1 
          ? currentPriceData.price.toFixed(4)
          : currentPriceData.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
        }
      </span>

      {/* Price Change Arrow */}
      {currentPriceData.priceChange === 'up' && (
        <TrendingUp className="w-3 h-3 text-green-500" />
      )}
      {currentPriceData.priceChange === 'down' && (
        <TrendingDown className="w-3 h-3 text-red-500" />
      )}
    </div>
  );
}