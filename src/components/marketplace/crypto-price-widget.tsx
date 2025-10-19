'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface CryptoAddress {
  id: number;
  cryptocurrency: string;
  address: string;
  label: string;
  logoUrl: string | null;
  isActive: boolean;
}

interface PriceData {
  currency: string;
  price: number;
  priceChange: 'up' | 'down' | 'neutral';
  history: number[];
  logo: string | null;
}

const CRYPTO_PRICE_APIS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  LTC: 'litecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  SOL: 'solana',
  DOT: 'polkadot',
};

export default function CryptoPriceWidget() {
  const [cryptoAddresses, setCryptoAddresses] = useState<CryptoAddress[]>([]);
  const [priceDataMap, setPriceDataMap] = useState<Map<string, PriceData>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load crypto addresses from admin panel
  useEffect(() => {
    const loadCryptoAddresses = async () => {
      try {
        const res = await fetch('/api/admin/crypto-addresses?isActive=true');
        if (res.ok) {
          const data = await res.json();
          setCryptoAddresses(data);
          
          // Initialize price data for each crypto
          const initialPriceMap = new Map<string, PriceData>();
          data.forEach((crypto: CryptoAddress) => {
            initialPriceMap.set(crypto.cryptocurrency, {
              currency: crypto.cryptocurrency,
              price: 0,
              priceChange: 'neutral',
              history: [],
              logo: crypto.logoUrl,
            });
          });
          setPriceDataMap(initialPriceMap);
        }
      } catch (error) {
        console.error('Failed to load crypto addresses:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCryptoAddresses();
  }, []);

  // Fetch prices for all cryptos
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
              
              if (currentData) {
                const previousPrice = currentData.history.length > 0 
                  ? currentData.history[currentData.history.length - 1] 
                  : currentData.price;
                
                let priceChange: 'up' | 'down' | 'neutral' = 'neutral';
                if (newPrice > previousPrice) {
                  priceChange = 'up';
                } else if (newPrice < previousPrice) {
                  priceChange = 'down';
                }
                
                // Keep last 20 price points for sparkline
                const newHistory = [...currentData.history, newPrice].slice(-20);
                
                newMap.set(currency, {
                  ...currentData,
                  price: newPrice,
                  priceChange,
                  history: newHistory,
                });
              }
              
              return newMap;
            });
          }
        } catch (error) {
          console.error(`Failed to fetch price for ${currency}:`, error);
        }
      }
    };

    // Initial fetch
    fetchPrices();

    // Update every 20 seconds
    const interval = setInterval(fetchPrices, 20000);

    return () => clearInterval(interval);
  }, [cryptoAddresses]);

  // Rotate through cryptocurrencies
  useEffect(() => {
    if (cryptoAddresses.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % cryptoAddresses.length);
    }, 4000); // Change every 4 seconds

    return () => clearInterval(interval);
  }, [cryptoAddresses.length]);

  if (isLoading || cryptoAddresses.length === 0) {
    return null;
  }

  const currentCrypto = cryptoAddresses[currentIndex];
  const currentPriceData = priceDataMap.get(currentCrypto.cryptocurrency.toUpperCase());

  if (!currentPriceData) return null;

  const renderSparkline = (history: number[]) => {
    if (history.length < 2) return null;

    const max = Math.max(...history);
    const min = Math.min(...history);
    const range = max - min || 1;

    const points = history.map((price, index) => {
      const x = (index / (history.length - 1)) * 100;
      const y = ((max - price) / range) * 100;
      return `${x},${y}`;
    }).join(' ');

    const lineColor = currentPriceData.priceChange === 'up' 
      ? 'rgb(34, 197, 94)' 
      : currentPriceData.priceChange === 'down'
      ? 'rgb(239, 68, 68)'
      : 'rgb(156, 163, 175)';

    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-16 h-8 opacity-60"
      >
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  const getPriceChangeIcon = () => {
    switch (currentPriceData.priceChange) {
      case 'up':
        return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-3 h-3 text-red-500" />;
      default:
        return <Minus className="w-3 h-3 text-gray-400" />;
    }
  };

  const getPriceChangeColor = () => {
    switch (currentPriceData.priceChange) {
      case 'up':
        return 'text-green-500';
      case 'down':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 overflow-hidden">
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          {/* Crypto Info */}
          <div className="flex items-center gap-2 min-w-0">
            {currentPriceData.logo ? (
              <img
                src={currentPriceData.logo}
                alt={currentCrypto.cryptocurrency}
                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">
                  {currentCrypto.cryptocurrency.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-bold truncate">
                  {currentCrypto.cryptocurrency.toUpperCase()}
                </h3>
                {getPriceChangeIcon()}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {currentCrypto.label}
              </p>
            </div>
          </div>

          {/* Sparkline */}
          <div className="hidden sm:block flex-shrink-0">
            {renderSparkline(currentPriceData.history)}
          </div>

          {/* Price */}
          <div className="text-right flex-shrink-0">
            <p className={`text-base sm:text-lg font-bold ${getPriceChangeColor()}`}>
              ${currentPriceData.price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: currentPriceData.price < 1 ? 6 : 2,
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              USD
            </p>
          </div>
        </div>

        {/* Progress dots */}
        {cryptoAddresses.length > 1 && (
          <div className="flex justify-center gap-1 mt-3">
            {cryptoAddresses.map((_, index) => (
              <div
                key={index}
                className={`h-1 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-4 bg-primary'
                    : 'w-1 bg-primary/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}