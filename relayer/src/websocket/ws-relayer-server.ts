import WebSocket from 'ws';
import express from 'express';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';

interface WSMessage {
  id?: string;
  method: string;
  params?: any;
  result?: any;
  error?: any;
}

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  isResolver?: boolean;
  subscriptions: Set<string>;
  lastSeen?: Date;
}

interface OrderExecution {
  orderHash: string;
  status: string;
  assignedResolver?: string;
  startedAt?: Date;
  completedAt?: Date;
  progress?: number;
  txHashes?: any;
  error?: string;
}

class WSRelayerServer {
  private wss: WebSocket.Server;
  private app: express.Application;
  private server: any;
  private clients: Map<string, ConnectedClient> = new Map();
  private executions: Map<string, OrderExecution> = new Map();
  private orders: Map<string, any> = new Map();
  private port: number;

  constructor(port: number = 3004) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.setupWebSocket();
    this.setupRESTEndpoints();
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
          client.lastSeen = new Date();
        } else {
          console.log(`[WS-Relayer] Removing inactive client ${clientId}`);
          this.clients.delete(clientId);
        }
      });
    }, 30000);
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = uuidv4();
      const client: ConnectedClient = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        lastSeen: new Date()
      };
      
      this.clients.set(clientId, client);
      console.log(`[WS-Relayer] Client ${clientId} connected`);

      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          await this.handleMessage(clientId, message);
        } catch (error) {
          console.error('[WS-Relayer] Error parsing message:', error);
          this.sendError(clientId, 'Invalid JSON format');
        }
      });

      ws.on('close', () => {
        if (client.isResolver) {
          this.handleResolverDisconnection(clientId);
        }
        this.clients.delete(clientId);
        console.log(`[WS-Relayer] Client ${clientId} disconnected`);
      });

      ws.on('pong', () => {
        client.lastSeen = new Date();
      });

      this.sendMessage(clientId, {
        id: 'welcome',
        method: 'connection_established',
        result: { clientId, timestamp: new Date().toISOString() }
      });
    });
  }

  private async handleMessage(clientId: string, message: WSMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`[WS-Relayer] Received:`, { method: message.method, id: message.id });

    try {
      switch (message.method) {
        case 'ping':
          this.sendMessage(clientId, {
            id: message.id,
            method: 'pong',
            result: { timestamp: new Date().toISOString() }
          });
          break;

        case 'register_as_resolver':
          await this.handleResolverRegistration(clientId, message);
          break;

        case 'fill_order':
          await this.handleFillOrder(clientId, message);
          break;

        case 'order_status_update':
          await this.handleOrderStatusUpdate(clientId, message);
          break;

        case 'resolver_heartbeat':
          client.lastSeen = new Date();
          this.sendMessage(clientId, {
            id: message.id,
            method: 'heartbeat_ack',
            result: { timestamp: new Date().toISOString() }
          });
          break;

        default:
          this.sendError(clientId, `Unknown method: ${message.method}`, message.id);
      }
    } catch (error) {
      console.error(`[WS-Relayer] Error handling message:`, error);
      this.sendError(clientId, `Server error: ${error.message}`, message.id);
    }
  }

  private async handleResolverRegistration(clientId: string, message: WSMessage): Promise<void> {
    const client = this.clients.get(clientId)!;
    client.isResolver = true;
    
    this.sendMessage(clientId, {
      id: message.id,
      method: 'resolver_registered',
      result: { status: 'success' }
    });
    
    console.log(`[WS-Relayer] Resolver ${clientId} registered`);
  }

  private async handleFillOrder(clientId: string, message: WSMessage): Promise<void> {
    const { orderHash } = message.params;
    
    if (!orderHash) {
      return this.sendError(clientId, 'Missing orderHash', message.id);
    }

    this.orders.set(orderHash, message.params);
    
    this.executions.set(orderHash, {
      orderHash,
      status: 'assigned',
      assignedResolver: undefined,
      startedAt: new Date()
    });

    const resolver = this.getAvailableResolver();
    if (!resolver) {
      return this.sendError(clientId, 'No available resolvers', message.id);
    }

    const execution = this.executions.get(orderHash)!;
    execution.assignedResolver = resolver.id;
    execution.status = 'processing';

    this.sendMessage(resolver.id, {
      method: 'resolve_order',
      params: message.params
    });

    this.sendMessage(clientId, {
      id: message.id,
      method: 'fill_order_response',
      result: { 
        orderHash, 
        status: 'assigned_to_resolver',
        resolverId: resolver.id
      }
    });

    console.log(`[WS-Relayer] Order ${orderHash} assigned to resolver ${resolver.id}`);
  }

  private async handleOrderStatusUpdate(clientId: string, message: WSMessage): Promise<void> {
    const { orderHash, status, progress, txHashes, error } = message.params;
    
    console.log(`[WS-Relayer] Order status update: ${orderHash} -> ${status}`);
    
    const execution = this.executions.get(orderHash);
    if (!execution) {
      console.error(`[WS-Relayer] Execution not found for order ${orderHash}`);
      return;
    }

    execution.status = status;
    execution.progress = progress;
    if (txHashes) {
      execution.txHashes = { ...execution.txHashes, ...txHashes };
    }
    if (error) {
      execution.error = error;
    }
    if (['completed', 'failed'].includes(status)) {
      execution.completedAt = new Date();
    }

    this.broadcastOrderEvent({
      event: status === 'completed' ? 'order_filled' : 'order_processing',
      data: {
        orderHash,
        status,
        progress,
        txHashes,
        timestamp: new Date().toISOString()
      }
    });
  }

  private getAvailableResolver(): ConnectedClient | undefined {
    return Array.from(this.clients.values())
      .find(client => 
        client.isResolver && 
        client.ws.readyState === WebSocket.OPEN
      );
  }

  private handleResolverDisconnection(resolverId: string): void {
    this.executions.forEach((execution, orderHash) => {
      if (execution.assignedResolver === resolverId && execution.status === 'processing') {
        console.log(`[WS-Relayer] Reassigning order ${orderHash} due to resolver disconnection`);
        execution.status = 'created';
        execution.assignedResolver = undefined;
      }
    });
  }

  private broadcastOrderEvent(eventData: any): void {
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(client.id, {
          method: 'order_event',
          result: eventData
        });
      }
    });
  }

  private sendMessage(clientId: string, message: WSMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[WS-Relayer] Failed to send message to ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  private sendError(clientId: string, error: string, messageId?: string): void {
    this.sendMessage(clientId, {
      id: messageId,
      method: 'error',
      error: { message: error, timestamp: new Date().toISOString() }
    });
  }

  private setupRESTEndpoints(): void {
    this.app.use(express.json());

    this.app.get('/health', (req, res) => {
      const resolvers = Array.from(this.clients.values()).filter(c => c.isResolver);
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connectedClients: this.clients.size,
        resolvers: {
          total: resolvers.length,
          available: resolvers.filter(r => r.ws.readyState === WebSocket.OPEN).length
        },
        orders: {
          total: this.orders.size,
          processing: Array.from(this.executions.values()).filter(e => e.status === 'processing').length,
          completed: Array.from(this.executions.values()).filter(e => e.status === 'completed').length
        }
      });
    });

    this.app.get('/orders/:orderHash', (req, res) => {
      const order = this.orders.get(req.params.orderHash);
      const execution = this.executions.get(req.params.orderHash);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      res.json({ order, execution });
    });
  }

  public start(): void {
    this.server.listen(this.port, () => {
      console.log(`[WS-Relayer] WebSocket Relayer started on port ${this.port}`);
      console.log(`[WS-Relayer] Health check: http://localhost:${this.port}/health`);
    });
  }

  public stop(): void {
    this.wss.close();
    this.server.close();
  }
}

const relayerServer = new WSRelayerServer(3004);
relayerServer.start();

process.on('SIGINT', () => {
  console.log('[WS-Relayer] Shutting down...');
  relayerServer.stop();
  process.exit(0);
});

export default WSRelayerServer;