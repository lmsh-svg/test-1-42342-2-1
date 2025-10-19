'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowLeft, MessageSquare, Send } from 'lucide-react';

interface Ticket {
  id: number;
  userId: number;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: number;
  ticketId: number;
  senderId: number;
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
      
      const response = await fetch('/api/support-tickets?limit=1000', {
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
          senderId: user?.id,
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

        <h1 className="text-3xl font-bold mb-8">Support Tickets</h1>

        {tickets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No support tickets yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tickets.map((ticket) => (
              <Card key={ticket.id} className="cursor-pointer hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg line-clamp-1">{ticket.subject}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        User ID: {ticket.userId}
                      </p>
                    </div>
                    <Badge variant={ticket.status === 'open' ? 'destructive' : 'default'}>
                      {ticket.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Priority:</span>
                      <span className="font-medium capitalize">{ticket.priority}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Created:</span>
                      <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
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
                        onClick={() => handleUpdateStatus(ticket.id, 'closed')}
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
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle>{selectedTicket?.subject}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Ticket #{selectedTicket?.id} • User ID: {selectedTicket?.userId}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge>{selectedTicket?.status}</Badge>
                <Badge variant="outline">{selectedTicket?.priority}</Badge>
              </div>
            </div>
          </DialogHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 my-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    msg.senderId === user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(msg.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Reply Input */}
          <div className="border-t pt-4 space-y-4">
            <Textarea
              placeholder="Type your reply..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              rows={3}
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