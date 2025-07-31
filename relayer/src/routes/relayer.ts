import express from 'express';
import { ethers } from 'ethers';
import {
    Address,
    AuctionDetails,
    CrossChainOrder,
    HashLock,
    TimeLocks,
    TakerTraits,
    randBigInt,
    AmountMode,
    Extension
} from '@1inch/cross-chain-sdk';
import { hexToUint8Array, uint8ArrayToHex } from '@1inch/byte-utils';
import { Resolver as EthereumResolverContract } from '../lib/resolver.js';
import { config as ethereumConfig } from '../scripts/deployEscrowFactory.js';
import { Wallet } from '../lib/wallet.js';
import { aptosconfig, provider } from './config.js';
import { AptosClient } from "aptos";
import { claim_funds, fund_dst_escrow, getBalance } from '../lib/aptos.js';
import { getdb } from '../../db.js';

const router = express.Router();

const client = new AptosClient(aptosconfig.aptosNodeUrl); // or Testnet URL


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
/**
 * POST /announceOrder
 * Announces a cross-chain swap order to the relayer using 1inch Cross-Chain SDK
 */
router.post('/createOrder', async (req, res) => {
    const {
        maker,
        makingAmount,
        takingAmount,
        makerAsset,
        takerAsset,
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
        !makingAmount ||
        !takingAmount ||
        !secret
    ) {
        return res.status(400).json({
            error: 'Missing required parameters',
            required: [
                'makerAddress', 'srcChainId', 'dstChainId', 'srcTokenAddress',
                'dstTokenAddress', 'srcAmount', 'dstAmount', 'secretHash', 'signature'
            ]
        });
    }
    try {
        const secretBytes = ethers.toUtf8Bytes(secret);
        const finalSecret = uint8ArrayToHex(secretBytes);
        const timestamp = BigInt((await provider.getBlock('latest'))!.timestamp);
        const orderHash = HashLock.hashSecret(finalSecret);
        const order = CrossChainOrder.new(
            new Address(ethereumConfig.escrowFactoryContractAddress),
            {
                salt: randBigInt(1000n),
                maker: new Address(maker),
                makingAmount: BigInt(makingAmount), // 1 USDC
                takingAmount: BigInt(takingAmount), // Equivalent amount on Aptos
                makerAsset: new Address(makerAsset),
                takerAsset: new Address(takerAsset) // Placeholder for Aptos token
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
                srcChainId: 1,
                dstChainId,
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
        const typedData = order.getTypedData(srcChainId)
        const extension = order.extension.encode()
        const limitOrder = order.build()
        const db = await getdb();
        db.data.orders.push({
            limitOrder,
            orderHash,
            extension
        });
        await db.write();
        console.log(db.data.orders, 'db.data.orders')
        res.json({ success: true, order: limitOrder, typedData, extension, orderHash });
    } catch (e) {
        return res.status(400).json({ error: 'Failed to create order', details: e.message });
    }

});



router.post('/fillOrder', async (req, res) => {
    const { order, signature, srcChainId, extension, orderHash } = req.body

    const orderInstance = CrossChainOrder.fromDataAndExtension(order, Extension.decode(extension))
    // const orderHash = orderInstance.getOrderHash(srcChainId)
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
    /**
 * 
 * cointype,
 * dst_amount,
 * expiration_duration_secs,
 * secret_hash
 */ 
    const cointype = aptosconfig.tokenType;
    const dstAmount = Number(orderInstance.takingAmount.toString());
    const duration=Math.floor(Date.now() / 1000) + 3600
    // const expirationDurationSecs = orderInstance.deadline;
const secretHashU8 = new Uint8Array(ethers.getBytes(orderHash))

//     const secret = ethers.toUtf8Bytes("my_secret_password_for_swap_test");
//   const secret_hash = hexToUint8Array(ethers.keccak256(secret));
// //     const secretHash = orderInstance.escrowExtension.hashLockInfo;
// //     console.log("######### Secret Hash ##########", secretHash)

// //     const secretHex = ethers.hexlify(orderHash); // or use your uint8ArrayToHex function
// // const orderHashHex = HashLock.hashSecret(secretHex);
// const orderHash1 = hexToUint8Array(orderHashHex);
//     console.log("######### Order Hash ##########", orderHash1)

    // console.log(typeof secretHash, typeof ethers.keccak256(secret), ' secret_hash: ', secret_hash, 'secret', secret, 'newsecret', ethers.keccak256(secret))
    const balance = await getBalance(aptosconfig.moduleAddress);
    console.log("######### Balance of destination  ##########", balance);
    const orderId = await fund_dst_escrow({
        cointype,
        dstAmount,
        duration,
        secret_hash:secretHashU8
    });
    const balance1 = await getBalance(aptosconfig.moduleAddress);
    console.log("######### Balance of destination  ##########", balance1);
    console.log("######### Funded destination escrow ##########", orderId);

    const originalSecret= ethers.toUtf8Bytes("my_secret_password_for_swap_test");
    await claim_funds(orderId, originalSecret);
    const balance2 = await getBalance(aptosconfig.moduleAddress);
    console.log("######### Balance of destination  ##########", balance2);
    res.json({ success: true })


})


export default router
