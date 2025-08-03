import WebSocket from 'ws';
import express from "express";
import { ethers } from "ethers";
import {
  Address,
  AuctionDetails,
  CrossChainOrder,
  HashLock,
  TimeLocks,
  randBigInt
} from "@1inch/cross-chain-sdk";
import { uint8ArrayToHex } from "@1inch/byte-utils";
import { config as ethereumConfig } from "../scripts/deployEscrowFactory.js";
import { CHAIN_IDS, CHAIN_IDS_CONFIG, provider } from "./config.js";
import { getdb } from "../../db.js";
import {
  createReceiverAddress
} from "../utils/aptosAddress.js";

const router = express.Router();
const cointype = process.env.TOKEN_TYPE || "";


interface WSMessage {
  id?: string;
  method: string;
  params?: any;
  result?: any;
  error?: any;
}

class WSRelayerClient {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private isConnected: boolean = false;
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();

  constructor(wsUrl: string = 'ws://localhost:3004') {
    this.wsUrl = wsUrl;
    this.connect();
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('[REST-Relayer] Connected to WebSocket relayer');
        this.isConnected = true;
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('[REST-Relayer] Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('[REST-Relayer] Disconnected from WebSocket relayer');
        this.isConnected = false;
        setTimeout(() => this.connect(), 5000);
      });

      this.ws.on('error', (error) => {
        console.error('[REST-Relayer] WebSocket error:', error);
        this.isConnected = false;
      });

    } catch (error) {
      console.error('[REST-Relayer] Failed to connect to WebSocket relayer:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  private handleMessage(message: WSMessage): void {
    if (message.id && this.pendingRequests.has(message.id)) {
      const request = this.pendingRequests.get(message.id)!;
      clearTimeout(request.timeout);
      this.pendingRequests.delete(message.id);
      
      if (message.error) {
        request.reject(new Error(message.error.message || 'WebSocket request failed'));
      } else {
        request.resolve(message.result);
      }
    }
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to WebSocket relayer'));
        return;
      }

      const id = `rest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const message: WSMessage = { id, method, params };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('WebSocket request timeout'));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      
      try {
        this.ws!.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  public async submitOrderForExecution(orderData: any): Promise<any> {
    return this.sendRequest('fill_order', orderData);
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

const wsRelayerClient = new WSRelayerClient(process.env.WS_RELAYER_URL || 'ws://localhost:3004');

router.get("/getQuote", (req, res) => {
  const { srcChainId, dstChainId, srcTokenAddress, dstTokenAddress, amount } =
    req.query;

  if (
    !srcChainId ||
    !dstChainId ||
    !srcTokenAddress ||
    !dstTokenAddress ||
    !amount
  ) {
    return res.status(400).json({
      error: "Missing required parameters",
      required: [
        "srcChainId",
        "dstChainId",
        "srcTokenAddress",
        "dstTokenAddress",
        "amount",
      ],
    });
  }

  const inputAmount = BigInt(amount);
  const EXCHANGE_RATE = 2; 
  const outputAmount =
    (inputAmount * BigInt(Math.floor(EXCHANGE_RATE * 1000))) / BigInt(1000);

  const mockQuote = {
    srcChainId: srcChainId,
    dstChainId: dstChainId,
    srcTokenAddress,
    dstTokenAddress,
    srcAmount: amount,
    dstAmount: outputAmount.toString(),
    exchangeRate: EXCHANGE_RATE,
    estimatedGas: "21000",
    gasPrice: "0",
    fees: {
      protocolFee: "0",
      gasFee: "0",
    },
    route: [
      {
        from: srcTokenAddress,
        to: dstTokenAddress,
        exchange: "AptosCrossChain",
      },
    ],
    timestamp: new Date().toISOString(),
    validUntil: new Date(Date.now() + 30000).toISOString(),
  };

  res.json(mockQuote);
});

// Default values managed by the relayer
const UINT_40_MAX = 2n ** 40n - 1n;

router.post("/createOrder", async (req, res) => {
  const {
    maker,
    makingAmount,
    takingAmount,
    makerAsset,
    takerAsset,
    receiver,
    secret,
    srcChainId,
    dstChainId, 
  } = req.body;

  if (
    !maker ||
    !srcChainId ||
    !dstChainId ||
    !makerAsset ||
    !takerAsset ||
    !receiver ||
    !makingAmount ||
    !takingAmount ||
    !secret
  ) {
    return res.status(400).json({
      error: "Missing required parameters",
      required: [
        "makerAddress",
        "srcChainId",
        "dstChainId",
        "srcTokenAddress",
        "dstTokenAddress",
        "receiver",
        "srcAmount",
        "dstAmount",
        "secretHash",
        "signature",
      ],
    });
  }
  try {
    const sourceChainId =
      CHAIN_IDS_CONFIG[srcChainId as keyof typeof CHAIN_IDS_CONFIG];
    const destChainId =
      CHAIN_IDS_CONFIG[dstChainId as keyof typeof CHAIN_IDS_CONFIG];
    console.log(
      srcChainId,
      destChainId,
      "sourceChainId, destChainId",
      sourceChainId
    );
    const processedReceiver =
      sourceChainId === CHAIN_IDS?.ETHEREUM
        ? createReceiverAddress(receiver)
        : receiver;
    const processedMaker =
      sourceChainId === CHAIN_IDS?.ETHEREUM
        ? maker
        : createReceiverAddress(maker);

    console.log(
      "Processed Receiver:",
      sourceChainId === CHAIN_IDS?.ETHEREUM,
      processedReceiver,
      "Processed Maker:",
      processedMaker,
      maker,
      receiver
    );
    const secretBytes = ethers.toUtf8Bytes(secret);
    const finalSecret = uint8ArrayToHex(secretBytes);
    const timestamp = BigInt((await provider.getBlock("latest"))!.timestamp);
    const orderHash = HashLock.hashSecret(finalSecret);
    const order = CrossChainOrder.new(
      new Address(ethereumConfig.escrowFactoryContractAddress),
      {
        salt: randBigInt(1000n),
        maker: new Address(processedMaker),
        makingAmount: BigInt(makingAmount), 
        takingAmount: BigInt(takingAmount), 
        makerAsset: new Address(makerAsset),
        takerAsset: new Address(takerAsset),
        receiver: new Address(processedReceiver), 
      },
      {
        hashLock: HashLock.forSingleFill(finalSecret),
        timeLocks: TimeLocks.new({
          srcWithdrawal: 10n,
          srcPublicWithdrawal: 120n,
          srcCancellation: 121n,
          srcPublicCancellation: 122n,
          dstWithdrawal: 10n,
          dstPublicWithdrawal: 100n,
          dstCancellation: 101n,
        }).setDeployedAt(BigInt(Math.floor(Date.now() / 1000))),
        srcChainId: sourceChainId,
        dstChainId: destChainId,
        srcSafetyDeposit: ethers.parseEther("0.001"),
        dstSafetyDeposit: ethers.parseEther("0.001"),
      },
      {
        auction: new AuctionDetails({
          initialRateBump: 0,
          points: [],
          duration: 120n,
          startTime: timestamp,
        }),
        whitelist: [
          {
            address: new Address(ethereumConfig.resolverContractAddress),
            allowFrom: 0n,
          },
        ],
        resolvingStartTime: 0n,
      },
      {
        nonce: randBigInt(UINT_40_MAX),
        allowPartialFills: false,
        allowMultipleFills: false,
      }
    );
    const db = await getdb();
    const typedData = order.getTypedData(srcChainId);
    const extension = order.extension.encode();
    const limitOrder = order.build();
    db.data.orders.push({
      limitOrder,
      orderHash,
      extension,
    });
    await db.write();

    res.json({
      success: true,
      order: limitOrder,
      typedData,
      extension,
      orderHash,
    });
    console.log(db.data.orders, "db.data.orders");
  } catch (e) {
    return res
      .status(400)
      .json({ error: "Failed to create order", details: e.message });
  }
});

router.post("/fillOrder", async (req, res) => {
  const { order, signature, srcChainId, extension, orderHash } = req.body;

  if (!orderHash && !order) {
    return res.status(400).json({ error: "Missing orderHash or order data" });
  }

  try {
    if (!wsRelayerClient.getConnectionStatus()) {
      console.log(`[REST-Relayer] WebSocket relayer not available, using fallback for order ${orderHash}`);
      return await executeOriginalFillOrder(req, res);
    }

    let orderData = order;
    let actualOrderHash = orderHash;
    
    if (!orderData && orderHash) {
      const db = await getdb();
      const storedOrder = db.data.orders.find(o => o.orderHash === orderHash);
      if (storedOrder) {
        orderData = storedOrder.limitOrder;
        actualOrderHash = storedOrder.orderHash;
      }
    }

    if (!orderData) {
      return res.status(404).json({ error: "Order not found" });
    }

    console.log(`[REST-Relayer] Submitting order ${actualOrderHash} to WebSocket relayer`);

    const wsResult = await wsRelayerClient.submitOrderForExecution({
      orderHash: actualOrderHash,
      order: orderData,
      extension: extension,
      srcChainId: srcChainId,
      signature: signature,
      secret: "my_secret_password_for_swap_test"
    });
    const result = await executeOriginalFillOrder(req, res);
    console.log(`[REST-Relayer] Order ${actualOrderHash} submitted successfully`, wsResult, "wsResult", result);
    res.json({
      success: true,
      orderHash: actualOrderHash,
      status: 'submitted_for_execution',
      message: 'Order submitted to WebSocket relayer',
      wsResult
    });

  } catch (error) {
    console.error(`[REST-Relayer] WebSocket submission failed for order ${orderHash}:`, error);
    
    console.log(`[REST-Relayer] Falling back to direct execution for order ${orderHash}`);
    try {
      return await executeOriginalFillOrder(req, res);
    } catch (fallbackError) {
      console.error(`[REST-Relayer] Fallback execution also failed:`, fallbackError);
      res.status(500).json({
        error: "Both WebSocket and fallback execution failed",
        details: {
          wsError: error.message,
          fallbackError: fallbackError.message
        }
      });
    }
  }
});

async function executeOriginalFillOrder(req: any, res: any) {
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[REST-Relayer] Shutting down, disconnecting from WebSocket relayer...');
  wsRelayerClient.disconnect();
  process.exit(0);
});

export default router;
export { WSRelayerClient, wsRelayerClient };