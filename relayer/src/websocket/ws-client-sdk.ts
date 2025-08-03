import WebSocket from 'ws';
import { EventEmitter } from 'events';

// Types following 1inch WebSocket API pattern
export enum WebSocketEvent {
  Open = 'open',
  Close = 'close',
  Error = 'error',
  Message = 'message',
}

export enum OrderEventType {
  OrderCreated = 'order_created',
  OrderFilled = 'order_filled',
  OrderCancelled = 'order_cancelled',
  OrderInvalid = 'order_invalid',
  OrderFilledPartially = 'order_filled_partially',
}

interface WSMessage {
  id?: string;
  method: string;
  params?: any;
  result?: any;
  error?: any;
}

interface OrderEvent {
  event: OrderEventType;
  data: {
    orderHash: string;
    srcChainId: string;
    dstChainId: string;
    [key: string]: any;
  };
}

interface Quote {
  srcChainId: string;
  dstChainId: string;
  srcTokenAddress: string;
  dstTokenAddress: string;
  srcAmount: string;
  dstAmount: string;
  exchangeRate: number;
  estimatedGas: string;
  gasPrice: string;
  fees: {
    protocolFee: string;
    gasFee: string;
  };
  route: Array<{
    from: string;
    to: string;
    exchange: string;
  }>;
  timestamp: string;
  validUntil: string;
}

interface CreateOrderParams {
  maker: string;
  makingAmount: string;
  takingAmount: string;
  makerAsset: string;
  takerAsset: string;
  receiver: string;
  secret: string;
  srcChainId: string;
  dstChainId: string;
}

interface ActiveOrder {
  orderHash: string;
  status: string;
  srcChainId: string;
  dstChainId: string;
  createdAt: string;
  [key: string]: any;
}

export class CrossChainWebSocketApi extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private isConnected: boolean = false;
  private messageId: number = 0;
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private reconnectInterval: NodeJS.Timeout | null = null;
  private lazyInit: boolean;

  // Namespaced APIs following 1inch pattern
  public order: OrderNamespace;
  public rpc: RpcNamespace;

  constructor(config: { url: string; lazyInit?: boolean }) {
    super();
    this.url = config.url;
    this.lazyInit = config.lazyInit || false;

    // Initialize namespaces
    this.order = new OrderNamespace(this);
    this.rpc = new RpcNamespace(this);

    if (!this.lazyInit) {
      this.init();
    }
  }

  public init() {
    this.connect();
  }

  private connect() {
    console.log(`[WebSocket Client] Connecting to ${this.url}`);
    
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      console.log('[WebSocket Client] Connected');
      this.isConnected = true;
      this.emit(WebSocketEvent.Open);
      
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('[WebSocket Client] Error parsing message:', error);
      }
    });

    this.ws.on('close', () => {
      console.log('[WebSocket Client] Disconnected');
      this.isConnected = false;
      this.emit(WebSocketEvent.Close);
      this.scheduleReconnect();
    });

    this.ws.on('error', (error) => {
      console.error('[WebSocket Client] Error:', error);
      this.emit(WebSocketEvent.Error, error);
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    if (this.reconnectInterval) return;
    
    this.reconnectInterval = setInterval(() => {
      if (!this.isConnected) {
        console.log('[WebSocket Client] Attempting to reconnect...');
        this.connect();
      }
    }, 5000);
  }

  private handleMessage(message: WSMessage) {
    console.log('[WebSocket Client] Received:', message);

    // Handle responses to pending requests
    if (message.id && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message || 'Unknown error'));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    // Handle events/notifications
    switch (message.method) {
      case 'order_event':
        this.emit('order_event', message.result);
        break;
      case 'connection_established':
        console.log('[WebSocket Client] Connection established:', message.result);
        break;
      default:
        this.emit(WebSocketEvent.Message, message);
    }
  }

  // Base methods following 1inch API
  public on(event: string, callback: Function): this {
    return super.on(event, callback);
  }

  public off(event: string, callback: Function): this {
    return super.off(event, callback);
  }

  public onOpen(callback: () => void): this {
    return this.on(WebSocketEvent.Open, callback);
  }

  public onClose(callback: () => void): this {
    return this.on(WebSocketEvent.Close, callback);
  }

  public onError(callback: (error: any) => void): this {
    return this.on(WebSocketEvent.Error, callback);
  }

  public onMessage(callback: (data: any) => void): this {
    return this.on(WebSocketEvent.Message, callback);
  }

  public send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket is not connected');
    }
  }

  public close(): void {
    if (this.ws) {
      this.ws.close();
    }
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  // Promise-based request method
  private async request(method: string, params?: any, timeout: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `req_${++this.messageId}`;
      
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout: timeoutHandle });

      this.send({
        id,
        method,
        params: params || {}
      });
    });
  }

  // High-level API methods
  public async getQuote(params: {
    srcChainId: string;
    dstChainId: string;
    srcTokenAddress: string;
    dstTokenAddress: string;
    amount: string;
  }): Promise<Quote> {
    return await this.request('get_quote', params);
  }

  public async createOrder(params: CreateOrderParams): Promise<{ orderHash: string; status: string }> {
    return await this.request('create_order', params);
  }

  public async fillOrder(params: {
    orderHash: string;
    order: any;
    signature?: string;
    srcChainId: string;
    extension?: string;
  }): Promise<{ success: boolean }> {
    return await this.request('fill_order', params);
  }
}

// Order namespace following 1inch pattern
class OrderNamespace {
  constructor(private client: CrossChainWebSocketApi) {}

  public onOrder(callback: (data: OrderEvent) => void): void {
    this.client.on('order_event', callback);
  }

  public onOrderCreated(callback: (data: any) => void): void {
    this.client.on('order_event', (data: OrderEvent) => {
      if (data.event === OrderEventType.OrderCreated) {
        callback(data.data);
      }
    });
  }

  public onOrderFilled(callback: (data: any) => void): void {
    this.client.on('order_event', (data: OrderEvent) => {
      if (data.event === OrderEventType.OrderFilled) {
        callback(data.data);
      }
    });
  }

  public onOrderCancelled(callback: (data: any) => void): void {
    this.client.on('order_event', (data: OrderEvent) => {
      if (data.event === OrderEventType.OrderCancelled) {
        callback(data.data);
      }
    });
  }

  public onOrderInvalid(callback: (data: any) => void): void {
    this.client.on('order_event', (data: OrderEvent) => {
      if (data.event === OrderEventType.OrderInvalid) {
        callback(data.data);
      }
    });
  }

  public onOrderFilledPartially(callback: (data: any) => void): void {
    this.client.on('order_event', (data: OrderEvent) => {
      if (data.event === OrderEventType.OrderFilledPartially) {
        callback(data.data);
      }
    });
  }
}

// RPC namespace following 1inch pattern
class RpcNamespace {
  constructor(private client: CrossChainWebSocketApi) {}

  public async ping(): Promise<{ timestamp: string }> {
    return await (this.client as any).request('ping');
  }

  public onPong(callback: (data: string) => void): void {
    this.client.on('pong', callback);
  }

  public async getActiveOrders(): Promise<{ orders: ActiveOrder[]; total: number }> {
    return await (this.client as any).request('get_active_orders');
  }

  public onGetActiveOrders(callback: (data: { orders: ActiveOrder[]; total: number }) => void): void {
    // This would be implemented if the server supports streaming active orders
    this.client.on('active_orders_response', callback);
  }

  public async getAllowedMethods(): Promise<string[]> {
    return await (this.client as any).request('get_allowed_methods');
  }

  public onGetAllowedMethods(callback: (data: string[]) => void): void {
    this.client.on('allowed_methods_response', callback);
  }
}

// Example usage and testing
export class CrossChainSwapClient {
  private wsApi: CrossChainWebSocketApi;

  constructor(relayerUrl: string = 'ws://localhost:8080') {
    this.wsApi = new CrossChainWebSocketApi({ url: relayerUrl });
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.wsApi.onOpen(() => {
      console.log('[Client] Connected to relayer');
      this.subscribeToOrders();
    });

    this.wsApi.onClose(() => {
      console.log('[Client] Disconnected from relayer');
    });

    this.wsApi.onError((error) => {
      console.error('[Client] Connection error:', error);
    });

    // Subscribe to all order events
    this.wsApi.order.onOrder((data) => {
      console.log('[Client] Order event received:', data);
    });

    // Subscribe to specific order events
    this.wsApi.order.onOrderCreated((data) => {
      console.log('[Client] New order created:', data.orderHash);
    });

    this.wsApi.order.onOrderFilled((data) => {
      console.log('[Client] Order filled:', data.orderHash);
    });
  }

  private async subscribeToOrders() {
    try {
      await this.wsApi.send({
        method: 'subscribe_orders',
        params: {}
      });
      console.log('[Client] Subscribed to order events');
    } catch (error) {
      console.error('[Client] Failed to subscribe to orders:', error);
    }
  }

  // High-level swap methods
  public async getQuote(
    srcChainId: string,
    dstChainId: string,
    srcTokenAddress: string,
    dstTokenAddress: string,
    amount: string
  ): Promise<Quote> {
    return await this.wsApi.getQuote({
      srcChainId,
      dstChainId,
      srcTokenAddress,
      dstTokenAddress,
      amount
    });
  }

  public async createOrder(orderParams: CreateOrderParams): Promise<{ orderHash: string; status: string }> {
    return await this.wsApi.createOrder(orderParams);
  }

  public async fillOrder(orderHash: string, orderData: any): Promise<{ success: boolean }> {
    return await this.wsApi.fillOrder({
      orderHash,
      order: orderData,
      srcChainId: orderData.srcChainId,
      extension: orderData.extension
    });
  }

  public async getActiveOrders(): Promise<{ orders: ActiveOrder[]; total: number }> {
    return await this.wsApi.rpc.getActiveOrders();
  }

  public async ping(): Promise<{ timestamp: string }> {
    return await this.wsApi.rpc.ping();
  }

  public close(): void {
    this.wsApi.close();
  }
}

// Export for use
export default CrossChainWebSocketApi;

// Usage example
if (require.main === module) {
  const client = new CrossChainSwapClient('ws://localhost:8080');

  // Example: Create a swap order
  setTimeout(async () => {
    try {
      // Get quote first
      const quote = await client.getQuote(
        'ETH::1',
        'APTOS::1',
        '0x8EB8a3b98659Cce290402893d0123abb75E3ab28',
        '0x1::coin::USDC',
        '1000000000000000000'
      );
      console.log('[Example] Quote received:', quote);

      // Create order
      const order = await client.createOrder({
        maker: '0x1234567890123456789012345678901234567890',
        makingAmount: '1000000000000000000',
        takingAmount: quote.dstAmount,
        makerAsset: quote.srcTokenAddress,
        takerAsset: quote.dstTokenAddress,
        receiver: '0x9876543210987654321098765432109876543210',
        secret: 'my_secret_password_for_swap_test',
        srcChainId: quote.srcChainId,
        dstChainId: quote.dstChainId
      });
      console.log('[Example] Order created:', order);

    } catch (error) {
      console.error('[Example] Error:', error);
    }
  }, 2000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('[Example] Shutting down client...');
    client.close();
    process.exit(0);
  });
}