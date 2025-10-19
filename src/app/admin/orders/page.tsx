'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, ArrowLeft, Edit } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface Order {
  id: number;
  userId: number;
  status: string;
  totalAmount: number;
  shippingAddress: string;
  notes: string;
  createdAt: string;
}

interface TrackingInfo {
  orderId: number;
  trackingNumber: string;
  carrier: string;
  status: string;
  estimatedDelivery: string;
  notes: string;
}

export default function AdminOrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tracking, setTracking] = useState<{ [key: number]: TrackingInfo }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isTrackingDialogOpen, setIsTrackingDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  
  // Tracking form
  const [trackingForm, setTrackingForm] = useState({
    trackingNumber: '',
    carrier: '',
    status: 'in_transit',
    estimatedDelivery: '',
    notes: '',
  });

  // Status form
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    } else if (user?.role === 'admin') {
      fetchOrders();
    }
  }, [user, authLoading, router]);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('/api/orders?limit=1000', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data);
        
        // Fetch tracking for each order
        for (const order of data) {
          fetchTracking(order.id);
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTracking = async (orderId: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/tracking-info?orderId=${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setTracking(prev => ({ ...prev, [orderId]: data[0] }));
        }
      }
    } catch (error) {
      console.error('Error fetching tracking:', error);
    }
  };

  const handleAddTracking = async () => {
    if (!selectedOrder || !trackingForm.trackingNumber.trim()) return;

    try {
      const token = localStorage.getItem('auth_token');
      
      // Check if tracking exists
      const existingTracking = tracking[selectedOrder.id];
      
      if (existingTracking) {
        // Update existing tracking
        await fetch(`/api/tracking-info/${existingTracking.orderId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            trackingNumber: trackingForm.trackingNumber,
            carrier: trackingForm.carrier || undefined,
            status: trackingForm.status,
            estimatedDelivery: trackingForm.estimatedDelivery || undefined,
            notes: trackingForm.notes || undefined,
          }),
        });
      } else {
        // Create new tracking
        await fetch('/api/tracking-info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderId: selectedOrder.id,
            trackingNumber: trackingForm.trackingNumber,
            carrier: trackingForm.carrier || undefined,
            status: trackingForm.status,
            estimatedDelivery: trackingForm.estimatedDelivery || undefined,
            notes: trackingForm.notes || undefined,
          }),
        });
      }

      // Update order status to shipped if adding tracking
      await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'shipped' }),
      });

      setIsTrackingDialogOpen(false);
      fetchOrders();
      setTrackingForm({
        trackingNumber: '',
        carrier: '',
        status: 'in_transit',
        estimatedDelivery: '',
        notes: '',
      });
    } catch (error) {
      console.error('Error adding tracking:', error);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return;

    try {
      const token = localStorage.getItem('auth_token');
      
      await fetch(`/api/orders?id=${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      setIsStatusDialogOpen(false);
      fetchOrders();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const openTrackingDialog = (order: Order) => {
    setSelectedOrder(order);
    const existingTracking = tracking[order.id];
    if (existingTracking) {
      setTrackingForm({
        trackingNumber: existingTracking.trackingNumber,
        carrier: existingTracking.carrier,
        status: existingTracking.status,
        estimatedDelivery: existingTracking.estimatedDelivery?.split('T')[0] || '',
        notes: existingTracking.notes || '',
      });
    }
    setIsTrackingDialogOpen(true);
  };

  const openStatusDialog = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setIsStatusDialogOpen(true);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <h1 className="text-3xl font-bold mb-8">Order Management</h1>

        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Order #{order.id}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      User ID: {order.userId} • {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                    {order.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Total Amount</p>
                    <p className="text-2xl font-bold">${order.totalAmount.toFixed(2)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium mb-1">Shipping Address</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {order.shippingAddress}
                    </p>
                  </div>
                </div>

                {tracking[order.id] && (
                  <div className="bg-muted rounded-md p-3 mb-4">
                    <p className="text-sm font-medium mb-2">Tracking Information</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tracking:</span>
                        <span className="font-mono font-semibold">
                          {tracking[order.id].trackingNumber}
                        </span>
                      </div>
                      {tracking[order.id].carrier && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Carrier:</span>
                          <span>{tracking[order.id].carrier}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openStatusDialog(order)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Update Status
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openTrackingDialog(order)}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    {tracking[order.id] ? 'Edit' : 'Add'} Tracking
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Tracking Dialog */}
      <Dialog open={isTrackingDialogOpen} onOpenChange={setIsTrackingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tracking[selectedOrder?.id ?? 0] ? 'Edit' : 'Add'} Tracking Information
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="trackingNumber">Tracking Number *</Label>
              <Input
                id="trackingNumber"
                value={trackingForm.trackingNumber}
                onChange={(e) => setTrackingForm({ ...trackingForm, trackingNumber: e.target.value })}
                placeholder="1Z999AA10123456784"
              />
            </div>
            <div>
              <Label htmlFor="carrier">Carrier</Label>
              <Input
                id="carrier"
                value={trackingForm.carrier}
                onChange={(e) => setTrackingForm({ ...trackingForm, carrier: e.target.value })}
                placeholder="UPS, FedEx, USPS, etc."
              />
            </div>
            <div>
              <Label htmlFor="trackingStatus">Status</Label>
              <Select
                value={trackingForm.status}
                onValueChange={(value) => setTrackingForm({ ...trackingForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="estimatedDelivery">Estimated Delivery</Label>
              <Input
                id="estimatedDelivery"
                type="date"
                value={trackingForm.estimatedDelivery}
                onChange={(e) => setTrackingForm({ ...trackingForm, estimatedDelivery: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="trackingNotes">Notes</Label>
              <Textarea
                id="trackingNotes"
                value={trackingForm.notes}
                onChange={(e) => setTrackingForm({ ...trackingForm, notes: e.target.value })}
                placeholder="Additional tracking information..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTrackingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTracking}>
              Save Tracking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">Order Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus}>
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}