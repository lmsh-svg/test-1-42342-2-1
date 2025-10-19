'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, ArrowLeft, MessageSquare, Send, Filter } from 'lucide-react';

interface Ticket {
  id: number;
  userId: number;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: number;
  ticketId: number;
  userId: number;
  message: string;
  createdAt: string;
}

export default function AdminTicketsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    } else if (user?.role === 'admin') {
      fetchTickets();
    }
  }, [user, authLoading, router]);

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const params = new URLSearchParams({ limit: '1000' });
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/support-tickets?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchTickets();
    }
  }, [categoryFilter, statusFilter]);

  const fetchMessages = async (ticketId: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`/api/ticket-messages?ticketId=${ticketId}&limit=1000`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const openTicketDialog = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    fetchMessages(ticket.id);
    setIsDialogOpen(true);
    setReplyMessage('');
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const token = localStorage.getItem('auth_token');
      
      await fetch('/api/ticket-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          userId: user?.id,
          message: replyMessage.trim(),
        }),
      });

      setReplyMessage('');
      fetchMessages(selectedTicket.id);
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleUpdateStatus = async (ticketId: number, status: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      await fetch(`/api/support-tickets?id=${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading tickets...</p>
        </div>
      </div>
    );
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      technical: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      billing: 'bg-green-500/10 text-green-600 border-green-500/20',
      order: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      account: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      general: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    };
    return colors[category] || colors.general;
  };

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

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Support Tickets</h1>
          
          {/* Filters */}
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="order">Order</SelectItem>
                <SelectItem value="account">Account</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {tickets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No support tickets found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tickets.map((ticket) => (
              <Card key={ticket.id} className="cursor-pointer hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs font-medium px-2 py-1 rounded-md border capitalize ${getCategoryColor(ticket.category)}`}>
                          {ticket.category}
                        </span>
                        <Badge variant={ticket.status === 'open' ? 'destructive' : 'default'} className="text-xs">
                          {ticket.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-base line-clamp-2">{ticket.subject}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        User ID: {ticket.userId}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Priority:</span>
                      <Badge variant="outline" className="text-xs capitalize">{ticket.priority}</Badge>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Created:</span>
                      <span className="text-xs">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTicketDialog(ticket)}
                      className="flex-1"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    {ticket.status === 'open' && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus(ticket.id, 'closed');
                        }}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Messages Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-1 rounded-md border capitalize ${getCategoryColor(selectedTicket?.category || 'general')}`}>
                    {selectedTicket?.category}
                  </span>
                  <Badge variant={selectedTicket?.status === 'open' ? 'destructive' : 'default'}>
                    {selectedTicket?.status}
                  </Badge>
                  <Badge variant="outline">{selectedTicket?.priority}</Badge>
                </div>
                <DialogTitle className="text-lg">{selectedTicket?.subject}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Ticket #{selectedTicket?.id} • User ID: {selectedTicket?.userId}
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 my-4 pr-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.userId === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-xl p-3 shadow-sm ${
                    msg.userId === user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/80'
                  }`}
                >
                  <p className="text-xs font-semibold mb-1.5 opacity-90">
                    {msg.userId === user?.id ? 'Admin' : `User #${msg.userId}`}
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  <p className="text-xs opacity-60 mt-2">
                    {new Date(msg.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Reply Input */}
          <div className="border-t pt-4 space-y-3">
            <Textarea
              placeholder="Type your reply..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="flex gap-2">
              {selectedTicket?.status === 'open' && (
                <Button
                  variant="outline"
                  onClick={() => handleUpdateStatus(selectedTicket.id, 'closed')}
                >
                  Close Ticket
                </Button>
              )}
              {selectedTicket?.status === 'closed' && (
                <Button
                  variant="outline"
                  onClick={() => handleUpdateStatus(selectedTicket.id, 'open')}
                >
                  Reopen Ticket
                </Button>
              )}
              <Button
                onClick={handleSendReply}
                disabled={!replyMessage.trim() || isSending}
                className="ml-auto"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSending ? 'Sending...' : 'Send Reply'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}