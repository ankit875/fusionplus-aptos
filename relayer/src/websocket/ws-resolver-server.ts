import WebSocket from 'ws';
import express from 'express';
import { createServer } from 'http';
import { ethers } from 'ethers';
import {
  Address,
  CrossChainOrder,
  Extension,
  TakerTraits,
  AmountMode,
  EscrowFactory as SdkEscrowFactory,
  DstImmutablesComplement,
} from "@1inch/cross-chain-sdk";
import { uint8ArrayToHex } from "@1inch/byte-utils";
import { Resolver as EthereumResolverContract } from "../lib/resolver.js";
import { config as ethereumConfig } from "../scripts/deployEscrowFactory.js";
import { Wallet } from "../lib/wallet.js";
import { CHAIN_IDS, provider } from "../routes/config.js";
import { getAptosReceiverAddress } from "../utils/aptosAddress.js";
import { claim_funds, fund_dst_escrow, fund_src_escrow } from "../lib/aptos.js";
import { EscrowFactory } from "../lib/escrow-factory.js";
import { AptosAccount } from "aptos";

interface WSMessage {
  id?: string;
  method: string;
  params?: any;
  result?: any;
  error?: any;
}

interface OrderExecution {
  orderHash: string;
  status: string;
  startedAt?: Date;
  completedAt?: Date;
  progress?: number;
  secret?: string;
  error?: string;
  orderId?: number;
  srcTxHash?: string;
  dstTxHash?: string;
  withdrawTxHash?: string;
}

class WSResolverServer {
  private ws: WebSocket | null = null;
  private app: express.Application;
  private server: any;
  private port: number;
  private relayerUrl: string;
  private executions: Map<string, OrderExecution> = new Map();
  private isConnected: boolean = false;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cointype: string;
  private resolverId: string;

  constructor(port: number = 3005, relayerUrl: string = 'ws://localhost:3004') {
    this.port = port;
    this.relayerUrl = relayerUrl;
    this.cointype = process.env.TOKEN_TYPE || "";
    this.resolverId = `resolver-${Math.random().toString(36).substr(2, 9)}`;
    
    this.app = express();
    this.server = createServer(this.app);
    
    this.setupRESTEndpoints();
    this.connectToRelayer();
    this.startHeartbeat();
  }

  private connectToRelayer(): void {
    try {
      console.log(`[WS-Resolver] Connecting to relayer at ${this.relayerUrl}`);
      
      this.ws = new WebSocket(this.relayerUrl);

      this.ws.on('open', () => {
        console.log('[WS-Resolver] Connected to relayer');
        this.isConnected = true;
        
        this.sendMessage({
          id: 'register',
          method: 'register_as_resolver',
          params: {
            resolverId: this.resolverId,
            capabilities: ['ethereum_to_aptos', 'aptos_to_ethereum']
          }
        });

        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      });

      this.ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          await this.handleMessage(message);
        } catch (error) {
          console.error('[WS-Resolver] Error parsing message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('[WS-Resolver] Disconnected from relayer');
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('[WS-Resolver] WebSocket error:', error);
        this.isConnected = false;
        this.scheduleReconnect();
      });

    } catch (error) {
      console.error('[WS-Resolver] Failed to connect to relayer:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval) return;
    
    this.reconnectInterval = setInterval(() => {
      if (!this.isConnected) {
        console.log('[WS-Resolver] Attempting to reconnect...');
        this.connectToRelayer();
      }
    }, 5000);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({
          method: 'resolver_heartbeat',
          params: {
            resolverId: this.resolverId,
            timestamp: new Date().toISOString(),
            activeOrders: Array.from(this.executions.keys()),
            load: this.executions.size
          }
        });
      }
    }, 30000);
  }

  private async handleMessage(message: WSMessage): Promise<void> {
    console.log(`[WS-Resolver] Received:`, { method: message.method, id: message.id });

    try {
      switch (message.method) {
        case 'resolve_order':
          await this.handleResolveOrder(message);
          break;

        case 'heartbeat_ack':
          console.log('[WS-Resolver] Heartbeat acknowledged');
          break;

        case 'connection_established':
        case 'resolver_registered':
          console.log(`[WS-Resolver] ${message.method}:`, message.result);
          break;

        default:
          console.log(`[WS-Resolver] Unhandled method: ${message.method}`);
      }
    } catch (error) {
      console.error(`[WS-Resolver] Error handling message ${message.method}:`, error);
    }
  }

  private async handleResolveOrder(message: WSMessage): Promise<void> {
    const { orderHash, order, signature, srcChainId, extension, secret } = message.params;
    
    if (this.executions.has(orderHash)) {
      console.log(`[WS-Resolver] Already processing order ${orderHash}`);
      return;
    }

    try {
      console.log(`[WS-Resolver] Starting resolution for order ${orderHash}`);
      
      const execution: OrderExecution = {
        orderHash,
        status: 'pending',
        startedAt: new Date(),
        progress: 0
      };
      
      this.executions.set(orderHash, execution);
      
      this.notifyRelayer(orderHash, 'processing', { progress: 0 });

      await this.executeOrder({
        order,
        signature,
        srcChainId,
        extension,
        orderHash,
        secret
      });
      
    } catch (error) {
      console.error(`[WS-Resolver] Failed to resolve order ${orderHash}:`, error);
      this.handleExecutionFailure(orderHash, error.message);
    }
  }

  private async executeOrder(params: any): Promise<void> {
    const { order, signature, srcChainId, extension, orderHash, secret } = params;
    const execution = this.executions.get(orderHash)!;

    console.log(`[WS-Resolver] Executing order ${orderHash} from ${srcChainId}`);

    execution.status = 'validating';
    execution.progress = 10;
    this.notifyRelayer(orderHash, 'processing', { progress: 10, status: 'validating' });

    const orderInstance = CrossChainOrder.fromDataAndExtension(
      order,
      Extension.decode(extension)
    );

    const ethereumResolverWallet = new Wallet(
      ethereumConfig.resolverPk,
      provider
    );
    
    const fillAmount = orderInstance.makingAmount;
    const originalSecret = ethers.toUtf8Bytes(secret || "my_secret_password_for_swap_test");
    const finalSecret = uint8ArrayToHex(originalSecret);
    
    const ethereumFactory = new EscrowFactory(
      provider,
      ethereumConfig.escrowFactoryContractAddress
    );

    execution.secret = finalSecret;
    execution.progress = 20;

    if (srcChainId === CHAIN_IDS?.SEPOLIA) {
      await this.executeEthereumToAptos(
        orderInstance, orderHash, signature, fillAmount, 
        ethereumResolverWallet, originalSecret, finalSecret, ethereumFactory
      );
    } else if (srcChainId === CHAIN_IDS?.APTOS) {
      await this.executeAptosToEthereum(
        orderInstance, orderHash, signature, 
        ethereumResolverWallet, originalSecret, finalSecret, ethereumFactory
      );
    } else {
      throw new Error(`Unsupported source chain: ${srcChainId}`);
    }
  }

  private async executeEthereumToAptos(
    orderInstance: CrossChainOrder, orderHash: string, signature: string, fillAmount: bigint, 
    ethereumResolverWallet: Wallet, originalSecret: Uint8Array, finalSecret: string, ethereumFactory: EscrowFactory
  ): Promise<void> {
    const execution = this.executions.get(orderHash)!;
    
    try {
      const receiver = orderInstance.receiver.toString();
      const aptosReceiverAddress = getAptosReceiverAddress(receiver);
      
      const resolverContract = new EthereumResolverContract(
        ethereumConfig.resolverContractAddress,
        "APTOS_RESOLVER_ADDRESS"
      );

      execution.status = 'src_deploying';
      execution.progress = 30;
      this.notifyRelayer(orderHash, 'processing', { progress: 30, status: 'src_deploying' });

      console.log(`[WS-Resolver] Deploying source escrow for order ${orderHash}`);
      
      const { txHash: orderFillHash, blockHash: ethereumDeployBlock } =
        await ethereumResolverWallet.send(
          resolverContract.deploySrc(
            CHAIN_IDS.SEPOLIA,
            orderInstance,
            signature,
            TakerTraits.default()
              .setExtension(orderInstance.extension)
              .setAmountMode(AmountMode.maker)
              .setAmountThreshold(orderInstance.takingAmount),
            fillAmount
          )
        );

      execution.srcTxHash = orderFillHash;
      execution.progress = 50;
      execution.status = 'src_deployed';
      
      console.log(`[WS-Resolver] Source escrow deployed in tx: ${orderFillHash}`);
      this.notifyRelayer(orderHash, 'processing', { 
        progress: 50, 
        status: 'src_deployed',
        txHashes: { srcTx: orderFillHash }
      });

      execution.status = 'dst_deploying';
      execution.progress = 60;
      
      const dstAmount = Number(orderInstance.takingAmount.toString());
      const duration = Math.floor(Date.now() / 1000) + 3600;
      const secretHashU8 = new Uint8Array(ethers.getBytes(orderHash));

      console.log(`[WS-Resolver] Funding destination escrow for order ${orderHash}`);
      
      const orderId = await fund_dst_escrow({
        cointype: this.cointype,
        dstAmount,
        duration,
        secret_hash: secretHashU8,
        recieverAddress: aptosReceiverAddress,
      });

      execution.orderId = orderId;
      execution.status = 'dst_deployed';
      execution.progress = 70;
      this.notifyRelayer(orderHash, 'processing', { progress: 70, status: 'dst_deployed', orderId });

      const ethereumEscrowEvent = await ethereumFactory.getSrcDeployEvent(ethereumDeployBlock);
      const ESCROW_SRC_IMPLEMENTATION = await ethereumFactory.getSourceImpl();
      const srcEscrowAddress = new SdkEscrowFactory(
        new Address(ethereumConfig.escrowFactoryContractAddress)
      ).getSrcEscrowAddress(ethereumEscrowEvent[0], ESCROW_SRC_IMPLEMENTATION);

      execution.status = 'withdrawing';
      execution.progress = 80;

      console.log(`[WS-Resolver] Withdrawing funds from ${srcEscrowAddress}`);

      const { txHash: resolverWithdrawHash } = await ethereumResolverWallet.send(
        resolverContract.withdraw("src", srcEscrowAddress, finalSecret, ethereumEscrowEvent[0])
      );

      execution.withdrawTxHash = resolverWithdrawHash;
      execution.progress = 90;

      console.log(`[WS-Resolver] Withdrew funds in tx: ${resolverWithdrawHash}`);

      execution.status = 'claiming';
      execution.progress = 95;
      
      console.log(`[WS-Resolver] Claiming funds for order ${orderHash}`);
      await claim_funds(orderId, originalSecret);

      execution.status = 'completed';
      execution.progress = 100;
      execution.completedAt = new Date();

      console.log(`[WS-Resolver] Order ${orderHash} completed successfully`);
      
      this.notifyRelayer(orderHash, 'completed', {
        srcTxHash: orderFillHash,
        dstTxHash: resolverWithdrawHash,
        secret: finalSecret,
        orderId: orderId,
        progress: 100
      });

    } catch (error) {
      console.error(`[WS-Resolver] Ethereum to Aptos execution failed:`, error);
      throw error;
    }
  }

  private async executeAptosToEthereum(
    orderInstance: CrossChainOrder, orderHash: string, signature: string, 
    ethereumResolverWallet: Wallet, originalSecret: Uint8Array, finalSecret: string, ethereumFactory: EscrowFactory
  ): Promise<void> {
    const execution = this.executions.get(orderHash)!;
    
    try {
      const resolverAccount = AptosAccount.fromAptosAccountObject({
        privateKeyHex: process.env.USER_PRIVKEY as string,
        address: process.env.USER_ADDR as string,
      });
      
      const makingAmount = Number(orderInstance.makingAmount);
      const takingAmount = orderInstance.takingAmount;
      const secretHashU8 = new Uint8Array(ethers.getBytes(orderHash));

      execution.status = 'src_deploying';
      execution.progress = 30;
      this.notifyRelayer(orderHash, 'processing', { progress: 30, status: 'src_deploying' });

      console.log(`[WS-Resolver] Funding source escrow for order ${orderHash}`);

      const orderID = await fund_src_escrow({
        minDstAmount: Number(takingAmount),
        expiresInSecs: 3600,
        secretHashHex: secretHashU8,
        srcAmount: makingAmount,
        signature,
        resolverAccount
      });

      execution.orderId = orderID;
      execution.status = 'src_deployed';
      execution.progress = 50;
      this.notifyRelayer(orderHash, 'processing', { progress: 50, status: 'src_deployed', orderId: orderID });

      const taker = orderInstance.receiver;
      const resolverContract = new EthereumResolverContract(
        "ETHEREUM_RESOLVER_ADDRESS",
        process.env.ETHEREUM_RESOLVER_ADDRESS as string
      );

      execution.status = 'dst_deploying';
      execution.progress = 60;

      console.log(`[WS-Resolver] Deploying destination escrow for order ${orderHash}`);
      
      const immutables = orderInstance.toSrcImmutables(CHAIN_IDS.APTOS, taker, takingAmount, orderHash);
      const deployDstTx = resolverContract.deployDst(immutables);

      const { txHash: orderFillHash } = await ethereumResolverWallet.send(deployDstTx);
       
      execution.dstTxHash = orderFillHash;
      execution.status = 'dst_deployed';
      execution.progress = 70;
      this.notifyRelayer(orderHash, 'processing', { progress: 70, status: 'dst_deployed', txHashes: { dstTx: orderFillHash } });

      execution.status = 'withdrawing';
      execution.progress = 80;

      const ESCROW_DST_IMPLEMENTATION = await ethereumFactory.getDestinationImpl();
      const dstEscrowAddress = new SdkEscrowFactory(new Address(ethereumConfig.escrowFactoryContractAddress))
        .getDstEscrowAddress(
          immutables,
          DstImmutablesComplement.new({
            amount: immutables.amount,
            maker: immutables.maker,
            safetyDeposit: immutables.safetyDeposit,
            token: immutables.token
          }),
          0n,
          immutables.taker,
          ESCROW_DST_IMPLEMENTATION
        );

      const { txHash: resolverWithdrawHash } = await ethereumResolverWallet.send(
        resolverContract.withdraw('dst', dstEscrowAddress, finalSecret, immutables)
      );

      execution.withdrawTxHash = resolverWithdrawHash;
      execution.progress = 90;

      console.log(`[WS-Resolver] Withdrew funds in tx: ${resolverWithdrawHash}`);

      execution.status = 'claiming';
      execution.progress = 95;
      
      console.log(`[WS-Resolver] Claiming funds for order ${orderHash}`);
      await claim_funds(orderID, originalSecret);

      execution.status = 'completed';
      execution.progress = 100;
      execution.completedAt = new Date();

      console.log(`[WS-Resolver] Order ${orderHash} completed successfully`);

      this.notifyRelayer(orderHash, 'completed', {
        srcOrderId: orderID,
        dstTxHash: orderFillHash,
        resolverWithdrawHash: resolverWithdrawHash,
        progress: 100
      });

    } catch (error) {
      console.error(`[WS-Resolver] Aptos to Ethereum execution failed:`, error);
      throw error;
    }
  }

  private handleExecutionFailure(orderHash: string, error: string): void {
    const execution = this.executions.get(orderHash);
    if (execution) {
      execution.status = 'failed';
      execution.error = error;
      execution.completedAt = new Date();
    }
    
    this.notifyRelayer(orderHash, 'failed', { error });
  }

  private notifyRelayer(orderHash: string, status: string, additionalData: any = {}): void {
    const execution = this.executions.get(orderHash);
    
    this.sendMessage({
      method: 'order_status_update',
      params: {
        orderHash,
        status,
        timestamp: new Date().toISOString(),
        resolver: this.resolverId,
        progress: execution?.progress || 0,
        ...additionalData
      }
    });
  }

  private sendMessage(message: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[WS-Resolver] Failed to send message:', error);
      }
    } else {
      console.error('[WS-Resolver] Cannot send message - not connected to relayer');
    }
  }

  private setupRESTEndpoints(): void {
    this.app.use(express.json());

    this.app.get('/health', (req, res) => {
      const activeExecutions = Array.from(this.executions.values());
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        resolverId: this.resolverId,
        connectedToRelayer: this.isConnected,
        activeExecutions: this.executions.size,
        statistics: {
          completed: activeExecutions.filter(e => e.status === 'completed').length,
          failed: activeExecutions.filter(e => e.status === 'failed').length,
          active: activeExecutions.filter(e => !['completed', 'failed'].includes(e.status)).length
        },
        cointype: this.cointype
      });
    });

    this.app.get('/executions/:orderHash', (req, res) => {
      const execution = this.executions.get(req.params.orderHash);
      if (execution) {
        res.json({ execution });
      } else {
        res.status(404).json({ error: 'Execution not found' });
      }
    });

    this.app.get('/executions', (req, res) => {
      res.json({
        executions: Array.from(this.executions.values()),
        total: this.executions.size
      });
    });
  }

  public start(): void {
    this.server.listen(this.port, () => {
      console.log(`[WS-Resolver] WebSocket Resolver started on port ${this.port}`);
      console.log(`[WS-Resolver] Health check: http://localhost:${this.port}/health`);
      console.log(`[WS-Resolver] Resolver ID: ${this.resolverId}`);
      console.log(`[WS-Resolver] Token type: ${this.cointype}`);
    });
  }

  public stop(): void {
    if (this.ws) {
      this.ws.close();
    }
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.server.close();
  }
}

const resolverServer = new WSResolverServer(3005, 'ws://localhost:3004');
resolverServer.start();

process.on('SIGINT', () => {
  console.log('[WS-Resolver] Shutting down...');
  resolverServer.stop();
  process.exit(0);
});

export default WSResolverServer;