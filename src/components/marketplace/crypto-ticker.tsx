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
  priceChange: 'up' | 'down' | 'neutral';
  logo: string | null;
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
            
            setPriceDataMap(prev => {
              const newMap = new Map(prev);
              const currentData = newMap.get(currency);
              
              const previousPrice = currentData?.price || newPrice;
              
              let priceChange: 'up' | 'down' | 'neutral' = 'neutral';
              if (newPrice > previousPrice) {
                priceChange = 'up';
              } else if (newPrice < previousPrice) {
                priceChange = 'down';
              }
              
              newMap.set(currency, {
                price: newPrice,
                priceChange,
                logo: crypto.logoUrl,
              });
              
              return newMap;
            });
          }
        } catch (error) {
          console.error(`Failed to fetch price for ${currency}:`, error);
        }
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [cryptoAddresses]);

  useEffect(() => {
    if (cryptoAddresses.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % cryptoAddresses.length);
    }, 5000); // Rotate every 5 seconds

    return () => clearInterval(interval);
  }, [cryptoAddresses.length]);

  if (cryptoAddresses.length === 0) return null;

  const currentCrypto = cryptoAddresses[currentIndex];
  const currentPriceData = priceDataMap.get(currentCrypto.cryptocurrency.toUpperCase());

  if (!currentPriceData) return null;

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

      {/* Price */}
      <span className="text-xs font-medium tabular-nums">
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