
import express from 'express';
import { ethers } from 'ethers';
import {
    Address,
    AuctionDetails,
    CrossChainOrder,
    HashLock,
    TimeLocks, randBigInt, Extension,
    TakerTraits,
    AmountMode,
    EscrowFactory as SdkEscrowFactory
} from '@1inch/cross-chain-sdk';
import { uint8ArrayToHex } from '@1inch/byte-utils';
import { Resolver as EthereumResolverContract } from '../lib/resolver.js';
import { config as ethereumConfig } from '../scripts/deployEscrowFactory.js';
import { Wallet } from '../lib/wallet.js';
import {  CHAIN_IDS, CHAIN_IDS_CONFIG, provider } from './config.js';
import { getdb } from '../../db.js';
import { createReceiverAddress, getAptosReceiverAddress } from '../utils/aptosAddress.js';
import { anounce_order, claim_funds, fund_dst_escrow } from '../lib/aptos.js';
import { EscrowFactory } from '../lib/escrow-factory.js';

const router = express.Router();
const cointype = process.env.TOKEN_TYPE || ''

router.get('/getQuote', (req, res) => {
    const {
        srcChainId,
        dstChainId,
        srcTokenAddress,
        dstTokenAddress,
        amount
    } = req.query;

    if (!srcChainId || !dstChainId || !srcTokenAddress || !dstTokenAddress || !amount) {
        return res.status(400).json({
            error: 'Missing required parameters',
            required: ['srcChainId', 'dstChainId', 'srcTokenAddress', 'dstTokenAddress', 'amount']
        });
    }

    const inputAmount = BigInt(amount);
    const EXCHANGE_RATE = 2; // HARDCODED 
    const outputAmount = (inputAmount * BigInt(Math.floor(EXCHANGE_RATE * 1000))) / BigInt(1000);

    const mockQuote = {
        srcChainId: srcChainId,
        dstChainId: dstChainId,
        srcTokenAddress,
        dstTokenAddress,
        srcAmount: amount,
        dstAmount: outputAmount.toString(),
        exchangeRate: EXCHANGE_RATE,
        estimatedGas: '21000',
        gasPrice: '0',
        fees: {
            protocolFee: '0',
            gasFee: '0'
        },
        route: [
            {
                from: srcTokenAddress,
                to: dstTokenAddress,
                exchange: 'AptosCrossChain'
            }
        ],
        timestamp: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30000).toISOString()
    };

    res.json(mockQuote);
});

// Default values managed by the relayer
const UINT_40_MAX = 2n ** 40n - 1n;

router.post('/createOrder', async (req, res) => {
    const {
        maker,
        makingAmount,
        takingAmount,
        makerAsset,
        takerAsset,
        receiver,
        secret,
        srcChainId,
        dstChainId       // Hash of the secret for escrow
    } = req.body;

    // Step 1: Validate input parameters
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
            error: 'Missing required parameters',
            required: [
                'makerAddress', 'srcChainId', 'dstChainId', 'srcTokenAddress',
                'dstTokenAddress', 'receiver', 'srcAmount', 'dstAmount', 'secretHash', 'signature'
            ]
        });
    }
    try {

        const sourceChainId = CHAIN_IDS_CONFIG[srcChainId as keyof typeof CHAIN_IDS_CONFIG]
        const destChainId =CHAIN_IDS_CONFIG[dstChainId as keyof typeof CHAIN_IDS_CONFIG]
         console.log(srcChainId, destChainId, 'sourceChainId, destChainId',sourceChainId);
        const processedReceiver = sourceChainId === CHAIN_IDS?.ETHEREUM ? createReceiverAddress(receiver) : receiver;
        const processedMaker = sourceChainId === CHAIN_IDS?.ETHEREUM ?  maker: createReceiverAddress(maker) ;
       
        console.log('Processed Receiver:', sourceChainId === CHAIN_IDS?.ETHEREUM, processedReceiver, 'Processed Maker:', processedMaker, maker, receiver);
        const secretBytes = ethers.toUtf8Bytes(secret);
        const finalSecret = uint8ArrayToHex(secretBytes);
        const timestamp = BigInt((await provider.getBlock('latest'))!.timestamp);
        const orderHash = HashLock.hashSecret(finalSecret);
        const order = CrossChainOrder.new(
            new Address(ethereumConfig.escrowFactoryContractAddress),
            {
                salt: randBigInt(1000n),
                maker: new Address(processedMaker),
                makingAmount: BigInt(makingAmount), // 1 USDC
                takingAmount: BigInt(takingAmount), // Equivalent amount on Aptos
                makerAsset: new Address(makerAsset),
                takerAsset: new Address(takerAsset),
                receiver: new Address(processedReceiver), // Receiver address on Aptos,
            },
            {
                hashLock: HashLock.forSingleFill(finalSecret),
                timeLocks: TimeLocks.new({
                    srcWithdrawal: 10n,           // 10sec finality lock
                    srcPublicWithdrawal: 120n,    // 2min private withdrawal
                    srcCancellation: 121n,        // 1sec public withdrawal
                    srcPublicCancellation: 122n,  // 1sec private cancellation
                    dstWithdrawal: 10n,           // 10sec finality lock
                    dstPublicWithdrawal: 100n,    // 100sec private withdrawal
                    dstCancellation: 101n         // 1sec public withdrawal
                }),
                srcChainId: sourceChainId,
                dstChainId: destChainId,
                srcSafetyDeposit: ethers.parseEther('0.001'),
                dstSafetyDeposit: ethers.parseEther('0.001')
            },
            {
                auction: new AuctionDetails({
                    initialRateBump: 0,
                    points: [],
                    duration: 120n,
                    startTime: timestamp
                }),
                whitelist: [
                    {
                        address: new Address(ethereumConfig.resolverContractAddress),
                        allowFrom: 0n
                    }
                ],
                resolvingStartTime: 0n
            },
            {
                nonce: randBigInt(UINT_40_MAX),
                allowPartialFills: false,
                allowMultipleFills: false
            }
        )
        const db = await getdb();
        // if(sourceChainId == CHAIN_IDS?.ETHEREUM) {
            // Handle Ethereum specific logic
        const typedData = order.getTypedData(srcChainId)
        const extension = order.extension.encode()
        const limitOrder = order.build()
         db.data.orders.push({
            limitOrder,
            orderHash,
            extension
        });
          await db.write();
       
        res.json({ success: true, order: limitOrder, typedData, extension, orderHash });
        console.log(db.data.orders, 'db.data.orders')
        // } else if (sourceChainId == CHAIN_IDS?.APTOS) {
            // Handle Aptos specific logic
            // await anounce_order({
            //     srcAmount: makingAmount,
            //     minDstAmount: takingAmount,
            //     expiresInSecs: 3600, // 1 hour
            //     secretHashHex: hexToUint8Array(ethers.keccak256(stringBytes))
            // });
        
      
    } catch (e) {
        return res.status(400).json({ error: 'Failed to create order', details: e.message });
    }

});



router.post('/fillOrder', async (req, res) => {
    const { order, signature, srcChainId, extension, orderHash } = req.body

    const orderInstance = CrossChainOrder.fromDataAndExtension(order, Extension.decode(extension))
   const aptosReceiverAddress = getAptosReceiverAddress(orderInstance);

    const ethereumResolverWallet = new Wallet(ethereumConfig.resolverPk, provider);
    const resolverContract = new EthereumResolverContract(ethereumConfig.resolverContractAddress, "APTOS_RESOLVER_ADDRESS")

    console.log(`[Ethereum] Filling order ${orderHash}`)
    const fillAmount = orderInstance.makingAmount

    const { txHash: orderFillHash, blockHash: ethereumDeployBlock } = await ethereumResolverWallet.send(
        resolverContract.deploySrc(
            srcChainId,
            orderInstance,
            signature,
            TakerTraits.default()
                .setExtension(orderInstance.extension)
                .setAmountMode(AmountMode.maker)
                .setAmountThreshold(orderInstance.takingAmount),
            fillAmount
        )
    )
    
    console.log(`[Ethereum] Order ${orderHash} filled for ${fillAmount} USDC in tx: ${orderFillHash}`)
   
    
    const dstAmount = Number(orderInstance.takingAmount.toString());
    const duration=Math.floor(Date.now() / 1000) + 3600
    const secretHashU8 = new Uint8Array(ethers.getBytes(orderHash))

    console.log("######### Receiver Address ##########", aptosReceiverAddress);
    const orderId = await fund_dst_escrow({
        cointype,
        dstAmount,
        duration,
        secret_hash:secretHashU8,
        recieverAddress: aptosReceiverAddress
    });

    // Fund escrow on Aptos
    console.log(`[Aptos Testnet] Funding destination escrow for order ${orderHash}`)
    
    const ethereumFactory = new EscrowFactory(provider, ethereumConfig.escrowFactoryContractAddress);
    const ethereumEscrowEvent = await ethereumFactory.getSrcDeployEvent(ethereumDeployBlock)

    const ESCROW_SRC_IMPLEMENTATION = await ethereumFactory.getSourceImpl()
    const srcEscrowAddress = new SdkEscrowFactory(new Address(ethereumConfig.escrowFactoryContractAddress)).getSrcEscrowAddress(
        ethereumEscrowEvent[0],
        ESCROW_SRC_IMPLEMENTATION
    )
    // Withdraw funds from Ethereum escrow for resolver
    console.log(`[Ethereum] Withdrawing funds for resolver from ${srcEscrowAddress}`)
    const originalSecret= ethers.toUtf8Bytes("my_secret_password_for_swap_test");
    const finalSecret = uint8ArrayToHex(originalSecret);

    const { txHash: resolverWithdrawHash } = await ethereumResolverWallet.send(
        resolverContract.withdraw('src', srcEscrowAddress, finalSecret, ethereumEscrowEvent[0])
    )
    console.log(`[Ethereum] Successfully withdrew funds for resolver in tx: ${resolverWithdrawHash}`)
    
    await claim_funds(orderId, originalSecret);
   
    res.json({ success: true })


})


export default router
