'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Navbar from '@/components/marketplace/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MessageSquare, Send, Plus } from 'lucide-react';

interface Ticket {
  id: number;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface Message {
  id: number;
  ticketId: number;
  userId: number;
  message: string;
  createdAt: string;
}

export default function SupportPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewTicketDialogOpen, setIsNewTicketDialogOpen] = useState(false);
  const [isMessagesDialogOpen, setIsMessagesDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const [ticketForm, setTicketForm] = useState({
    subject: '',
    category: 'general',
    priority: 'medium',
    message: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchTickets();
    }
  }, [user, authLoading, router]);

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`/api/support-tickets?userId=${user?.id}&limit=1000`, {
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

  const handleCreateTicket = async () => {
    if (!ticketForm.subject.trim() || !ticketForm.message.trim() || !ticketForm.category) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      
      // Create ticket
      const ticketResponse = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user?.id,
          subject: ticketForm.subject,
          category: ticketForm.category,
          status: 'open',
          priority: ticketForm.priority,
        }),
      });

      if (ticketResponse.ok) {
        const ticket = await ticketResponse.json();
        
        // Add first message
        await fetch('/api/ticket-messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            ticketId: ticket.id,
            userId: user?.id,
            message: ticketForm.message,
          }),
        });

        setIsNewTicketDialogOpen(false);
        fetchTickets();
        setTicketForm({ subject: '', category: 'general', priority: 'medium', message: '' });
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const openTicketMessages = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    fetchMessages(ticket.id);
    setIsMessagesDialogOpen(true);
    setNewMessage('');
  };

  const handleSendMessage = async () => {
    if (!selectedTicket || !newMessage.trim() || isSending) return;

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
          message: newMessage.trim(),
        }),
      });

      setNewMessage('');
      fetchMessages(selectedTicket.id);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading support tickets...</p>
          </div>
        </div>
      </>
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
    <>
      <Navbar />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Support Tickets</h1>
            <Button onClick={() => setIsNewTicketDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          </div>

          {tickets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground mb-4">No support tickets yet</p>
                <Button onClick={() => setIsNewTicketDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Ticket
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <Card key={ticket.id} className="cursor-pointer hover:border-primary transition-colors">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-medium px-2 py-1 rounded-md border capitalize ${getCategoryColor(ticket.category)}`}>
                            {ticket.category}
                          </span>
                        </div>
                        <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Created {new Date(ticket.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={ticket.status === 'open' ? 'destructive' : 'default'}>
                          {ticket.status}
                        </Badge>
                        <Badge variant="outline">{ticket.priority}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTicketMessages(ticket)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      View Messages
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* New Ticket Dialog */}
        <Dialog open={isNewTicketDialogOpen} onOpenChange={setIsNewTicketDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={ticketForm.category}
                  onValueChange={(value) => setTicketForm({ ...ticketForm, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">Technical Support</SelectItem>
                    <SelectItem value="billing">Billing & Payments</SelectItem>
                    <SelectItem value="order">Order Issues</SelectItem>
                    <SelectItem value="account">Account Management</SelectItem>
                    <SelectItem value="general">General Inquiry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  placeholder="Brief description of your issue"
                />
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={ticketForm.priority}
                  onValueChange={(value) => setTicketForm({ ...ticketForm, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  value={ticketForm.message}
                  onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })}
                  placeholder="Describe your issue in detail..."
                  rows={5}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewTicketDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTicket}>
                Create Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Messages Dialog */}
        <Dialog open={isMessagesDialogOpen} onOpenChange={setIsMessagesDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
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
                    Ticket #{selectedTicket?.id}
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
                      {msg.userId === user?.id ? 'You' : 'Support Team'}
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
            {selectedTicket?.status === 'open' && (
              <div className="border-t pt-4 space-y-3">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSending ? 'Sending...' : 'Send Message'}
                  </Button>
                </div>
              </div>
            )}
            {selectedTicket?.status !== 'open' && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground text-center">
                  This ticket is {selectedTicket?.status}. No new messages can be added.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}