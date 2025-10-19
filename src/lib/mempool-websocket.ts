/**
 * Mempool.space WebSocket client for real-time Bitcoin transaction tracking
 * Documentation: https://mempool.space/docs/api/websocket
 */

type AddressTransaction = {
  txid: string;
  version: number;
  locktime: number;
  vin: Array<{
    txid: string;
    vout: number;
    prevout: {
      scriptpubkey: string;
      scriptpubkey_address: string;
      value: number;
    };
    sequence: number;
  }>;
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_address: string;
    value: number;
  }>;
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
};

type WebSocketMessage = {
  'address-transactions'?: {
    [address: string]: {
      mempool: AddressTransaction[];
      confirmed: AddressTransaction[];
    };
  };
  'block-transactions'?: AddressTransaction[];
  'multi-address-transactions'?: {
    [address: string]: {
      mempool: AddressTransaction[];
      confirmed: AddressTransaction[];
      removed: string[];
    };
  };
};

export class MempoolWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private trackedAddresses: Set<string> = new Set();
  private messageHandlers: Array<(message: WebSocketMessage) => void> = [];
  private isConnecting = false;

  constructor(private wsUrl: string = 'wss://mempool.space/api/v1/ws') {}

  /**
   * Connect to mempool.space WebSocket
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('WebSocket connection already in progress');
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log('Mempool WebSocket connected');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          
          // Re-track addresses if reconnecting
          if (this.trackedAddresses.size > 0) {
            this.trackAddresses(Array.from(this.trackedAddresses));
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as WebSocketMessage;
            this.messageHandlers.forEach(handler => handler(data));
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket closed');
          this.isConnecting = false;
          this.handleReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(console.error);
    }, delay);
  }

  /**
   * Track single address for transactions
   */
  trackAddress(address: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    this.trackedAddresses.add(address);
    this.ws.send(JSON.stringify({
      'track-address': address
    }));
    console.log(`Tracking address: ${address}`);
  }

  /**
   * Track multiple addresses for transactions
   */
  trackAddresses(addresses: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    addresses.forEach(addr => this.trackedAddresses.add(addr));
    this.ws.send(JSON.stringify({
      'track-addresses': addresses
    }));
    console.log(`Tracking ${addresses.length} addresses`);
  }

  /**
   * Track transaction by TXID
   */
  trackTransaction(txid: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    this.ws.send(JSON.stringify({
      'track-tx': txid
    }));
    console.log(`Tracking transaction: ${txid}`);
  }

  /**
   * Subscribe to mempool events (new transactions)
   */
  trackMempool(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    this.ws.send(JSON.stringify({
      'track-mempool-txids': true
    }));
    console.log('Tracking mempool transaction IDs');
  }

  /**
   * Add message handler
   */
  onMessage(handler: (message: WebSocketMessage) => void): () => void {
    this.messageHandlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.trackedAddresses.clear();
    this.messageHandlers = [];
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance for server-side usage
let mempoolWsInstance: MempoolWebSocket | null = null;

export function getMempoolWebSocket(): MempoolWebSocket {
  if (!mempoolWsInstance) {
    mempoolWsInstance = new MempoolWebSocket();
  }
  return mempoolWsInstance;
}