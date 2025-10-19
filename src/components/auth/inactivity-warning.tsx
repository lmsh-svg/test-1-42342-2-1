'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface InactivityWarningProps {
  open: boolean;
  secondsRemaining: number;
  onDismiss: () => void;
}

export function InactivityWarning({ open, secondsRemaining, onDismiss }: InactivityWarningProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertCircle className="h-5 w-5" />
            Inactivity Warning
          </DialogTitle>
          <DialogDescription>
            You will be automatically logged out due to inactivity
          </DialogDescription>
        </DialogHeader>
        
        <Alert className="border-orange-200 bg-orange-50">
          <AlertDescription className="text-center">
            <div className="text-3xl font-bold text-orange-600 mb-2">
              {secondsRemaining}
            </div>
            <p className="text-sm text-muted-foreground">
              seconds remaining until automatic logout
            </p>
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button onClick={onDismiss} className="w-full">
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}