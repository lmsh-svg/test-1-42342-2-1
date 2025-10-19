'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Clock, Truck, Info, Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ShippingWidget() {
  const [timeLeft, setTimeLeft] = useState('');
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [nextShippingDate, setNextShippingDate] = useState('');
  const [daysUntilShipping, setDaysUntilShipping] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const central = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
      
      let nextShipping = new Date(central);
      nextShipping.setHours(9, 0, 0, 0);
      
      // If past 9 AM today, move to next day
      if (central >= nextShipping) {
        nextShipping.setDate(nextShipping.getDate() + 1);
      }
      
      // Get USPS holidays
      const holidays = getUSPSHolidays(nextShipping.getFullYear());
      
      // Skip Sundays and holidays
      let daysSkipped = 0;
      let currentHoliday = null;
      
      while (nextShipping.getDay() === 0 || isUSPSHoliday(nextShipping, holidays)) {
        if (isUSPSHoliday(nextShipping, holidays)) {
          currentHoliday = getHolidayName(nextShipping, holidays);
        }
        nextShipping.setDate(nextShipping.getDate() + 1);
        daysSkipped++;
        
        // Safety check to prevent infinite loop
        if (daysSkipped > 14) break;
      }
      
      // Calculate business days until shipping
      const businessDays = calculateBusinessDays(central, nextShipping, holidays);
      setDaysUntilShipping(businessDays);
      
      if (currentHoliday) {
        setIsHoliday(true);
        setHolidayName(currentHoliday);
      } else {
        setIsHoliday(false);
        setHolidayName('');
      }
      
      setNextShippingDate(nextShipping.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      }));
      
      const diff = nextShipping.getTime() - central.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const getUSPSHolidays = (year: number): Map<string, string> => {
    const holidays = new Map<string, string>();
    
    // Fixed date holidays
    holidays.set(`${year}-01-01`, "New Year's Day");
    holidays.set(`${year}-07-04`, "Independence Day");
    holidays.set(`${year}-11-11`, "Veterans Day");
    holidays.set(`${year}-12-25`, "Christmas Day");
    
    // Calculated holidays for 2025
    if (year === 2025) {
      holidays.set(`${year}-01-20`, "Martin Luther King Jr. Day"); // 3rd Monday of January
      holidays.set(`${year}-02-17`, "Presidents' Day"); // 3rd Monday of February
      holidays.set(`${year}-05-26`, "Memorial Day"); // Last Monday of May
      holidays.set(`${year}-09-01`, "Labor Day"); // 1st Monday of September
      holidays.set(`${year}-10-13`, "Columbus Day"); // 2nd Monday of October
      holidays.set(`${year}-11-27`, "Thanksgiving"); // 4th Thursday of November
    }
    
    // Calculated holidays for 2026
    if (year === 2026) {
      holidays.set(`${year}-01-19`, "Martin Luther King Jr. Day");
      holidays.set(`${year}-02-16`, "Presidents' Day");
      holidays.set(`${year}-05-25`, "Memorial Day");
      holidays.set(`${year}-09-07`, "Labor Day");
      holidays.set(`${year}-10-12`, "Columbus Day");
      holidays.set(`${year}-11-26`, "Thanksgiving");
    }
    
    return holidays;
  };

  const isUSPSHoliday = (date: Date, holidays: Map<string, string>): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    return holidays.has(dateStr);
  };

  const getHolidayName = (date: Date, holidays: Map<string, string>): string => {
    const dateStr = date.toISOString().split('T')[0];
    return holidays.get(dateStr) || '';
  };

  const calculateBusinessDays = (start: Date, end: Date, holidays: Map<string, string>): number => {
    let days = 0;
    const current = new Date(start);
    
    while (current < end) {
      current.setDate(current.getDate() + 1);
      // Skip Sundays and holidays
      if (current.getDay() !== 0 && !isUSPSHoliday(current, holidays)) {
        days++;
      }
    }
    
    return days;
  };

  return (
    <>
      {/* Compact Widget */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-lg shadow-primary/5">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-pulse" />
                {isHoliday && (
                  <AlertTriangle className="h-3 w-3 text-destructive absolute -top-1 -right-1" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                    Same-Day Shipping
                  </p>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    USPS
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isHoliday ? (
                    <span className="text-destructive font-medium">
                      USPS Closed ({holidayName}) - Ships {nextShippingDate}
                    </span>
                  ) : daysUntilShipping > 1 ? (
                    <span className="text-yellow-600 font-medium">
                      Ships within {daysUntilShipping} business days
                    </span>
                  ) : (
                    <>
                      Order within <span className="text-primary font-bold">{timeLeft}</span> ships today
                    </>
                  )}
                </p>
              </div>
            </div>
            
            <Dialog open={showInfo} onOpenChange={setShowInfo}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 p-0">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Shipping Information
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                  {/* Same-Day Shipping */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Same-Day Shipping
                    </h3>
                    <Card className="bg-muted/50">
                      <CardContent className="p-4 space-y-2">
                        <p className="text-sm">
                          Orders placed before <span className="font-bold text-primary">9:00 AM Central Time</span> will ship the same day.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          • Ships Monday through Saturday
                        </p>
                        <p className="text-sm text-muted-foreground">
                          • No Sunday shipping
                        </p>
                        <p className="text-sm text-muted-foreground">
                          • Subject to USPS holiday closures
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* USPS Shipping Options */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      USPS Shipping Options
                    </h3>
                    <div className="grid gap-3">
                      <Card className="bg-muted/50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold">USPS Standard Shipping - $22.99</h4>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Affordable and reliable service
                          </p>
                          <ul className="text-sm space-y-1 text-muted-foreground">
                            <li>• 2-5 business days delivery</li>
                            <li>• Tracking included</li>
                            <li>• Standard processing</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="bg-muted/50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold">USPS Priority Mail - $35.99</h4>
                            <Badge variant="default">Recommended</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Fast and reliable service with tracking
                          </p>
                          <ul className="text-sm space-y-1 text-muted-foreground">
                            <li>• 1-3 business days delivery</li>
                            <li>• Free tracking included</li>
                            <li>• Insurance up to $100 included</li>
                            <li>• Priority processing</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Holiday Closures */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      USPS Holiday Closures
                    </h3>
                    <Card className="bg-destructive/5 border-destructive/20">
                      <CardContent className="p-4">
                        <p className="text-sm mb-3">
                          USPS does not operate on federal holidays. Shipping will be delayed accordingly:
                        </p>
                        <div className="grid sm:grid-cols-2 gap-2 text-sm">
                          <div>• New Year's Day</div>
                          <div>• Martin Luther King Jr. Day</div>
                          <div>• Presidents' Day</div>
                          <div>• Memorial Day</div>
                          <div>• Independence Day</div>
                          <div>• Labor Day</div>
                          <div>• Columbus Day</div>
                          <div>• Veterans Day</div>
                          <div>• Thanksgiving</div>
                          <div>• Christmas Day</div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                          When a holiday falls on a Sunday, it's observed on Monday. Orders placed on or before holidays will ship on the next business day.
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Important Delivery Requirements */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      Important: Delivery Requirements
                    </h3>
                    <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <h4 className="font-semibold text-sm mb-2">✓ Use a Verified Address</h4>
                          <p className="text-sm text-muted-foreground">
                            You must use an address where you have previously received mail. USPS tracks delivery patterns, and new addresses may be flagged as suspicious.
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="font-semibold text-sm mb-2">✓ Use Your Real Name</h4>
                          <p className="text-sm text-muted-foreground">
                            The name on your order must match the name associated with mail delivery at your address. Using an alias or unverified name may result in delivery issues.
                          </p>
                        </div>

                        <div className="border-t border-yellow-200 dark:border-yellow-800 pt-3 mt-3">
                          <p className="text-sm font-semibold text-destructive">
                            ⚠️ We Are Not Responsible For Delivery Issues
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            If you do not follow these requirements and your package is not delivered, flagged, or returned by USPS, we cannot be held responsible. Please ensure your shipping information is accurate and verified before placing an order.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Delivery Information */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Delivery Information</h3>
                    <Card className="bg-muted/50">
                      <CardContent className="p-4">
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>Double-check your shipping address for accuracy</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>Include apartment/unit numbers if applicable</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>Ensure someone is available to receive packages</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>Track your package using the provided tracking number</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>Contact us immediately if you notice any issues with your order</span>
                          </li>
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </>
  );
}