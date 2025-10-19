'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const WARNING_DURATION = 60 * 1000; // 60 seconds warning

interface InactivityState {
  showWarning: boolean;
  secondsRemaining: number;
}

export function useInactivityLogout(isAuthenticated: boolean) {
  const router = useRouter();
  const [state, setState] = useState<InactivityState>({
    showWarning: false,
    secondsRemaining: 60,
  });

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const logout = useCallback(() => {
    // Clear all timers
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    // Perform logout
    localStorage.removeItem('auth_token');
    localStorage.removeItem('cart');
    
    // Redirect to login
    router.push('/login?reason=inactivity');
  }, [router]);

  const startWarningCountdown = useCallback(() => {
    setState({ showWarning: true, secondsRemaining: 60 });

    // Start countdown
    let secondsLeft = 60;
    countdownIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      setState({ showWarning: true, secondsRemaining: secondsLeft });

      if (secondsLeft <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        logout();
      }
    }, 1000);

    // Auto-logout after 60 seconds
    warningTimerRef.current = setTimeout(() => {
      logout();
    }, WARNING_DURATION);
  }, [logout]);

  const resetInactivityTimer = useCallback(() => {
    // Clear existing timers
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    // Hide warning if it was showing
    setState({ showWarning: false, secondsRemaining: 60 });

    // Only set timer if user is authenticated
    if (!isAuthenticated) return;

    // Set new inactivity timer
    inactivityTimerRef.current = setTimeout(() => {
      startWarningCountdown();
    }, INACTIVITY_TIMEOUT - WARNING_DURATION); // Show warning 60 seconds before timeout
  }, [isAuthenticated, startWarningCountdown]);

  const dismissWarning = useCallback(() => {
    // Clear warning timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    // Reset the entire inactivity timer
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Clear all timers if not authenticated
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

    // Activity events to track
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle the reset function to avoid excessive calls
    let throttleTimer: NodeJS.Timeout | null = null;
    const throttledReset = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          resetInactivityTimer();
          throttleTimer = null;
        }, 1000); // Throttle to once per second
      }
    };

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, throttledReset);
    });

    // Initialize timer
    resetInactivityTimer();

    // Cleanup
    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, throttledReset);
      });
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [isAuthenticated, resetInactivityTimer]);

  return {
    showWarning: state.showWarning,
    secondsRemaining: state.secondsRemaining,
    dismissWarning,
  };
}