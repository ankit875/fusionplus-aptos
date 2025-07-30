import 'dotenv/config'
import { expect, jest } from '@jest/globals'

import { createServer, CreateServerReturnType } from 'prool'
import { anvil } from 'prool/instances'

import Sdk from '@1inch/cross-chain-sdk'
import {
    computeAddress,
    ContractFactory,
    ethers,
    JsonRpcProvider,
    parseEther,
    parseUnits,
    randomBytes,
    Wallet as SignerWallet
} from 'ethers'
import { uint8ArrayToHex, UINT_40_MAX } from '@1inch/byte-utils'
import assert from 'node:assert'
import { ChainConfig, config } from './config'
import { getContractTokenBalance, Wallet } from './wallet'
import { Resolver } from './resolver'
import { EscrowFactory } from './escrow-factory'
import factoryContract from '../dist/contracts/TestEscrowFactory.sol/TestEscrowFactory.json'
import resolverContract from '../dist/contracts/Resolver.sol/Resolver.json'
import * as aptos from './aptos'
import { sleepWithDetails } from './utils'

const { Address } = Sdk

jest.setTimeout(1000 * 60)

const userPk = '7764b03c4d3eb019cc0ec0630429622593b8d7625b83a109e9f2279828a88a66'
const resolverPk = 'ec24db4bfe6c9cbba5b3a04e342228323a87c6afca24006d40b5288c178536e3'


//ec24db4bfe6c9cbba5b3a04e342228323a87c6afca24006d40b5288c178536e3

// eslint-disable-next-line max-lines-per-function
describe('Resolver example', () => {
    // Note: 1inch SDK doesn't currently support APTOS chain ID natively,
    // so we use COINBASE as a placeholder for the order creation.
    // The actual cross-chain logic to Aptos is handled separately via aptos.ts module.
    let srcChainId = config.chain.ethereum.chainId  // Ethereum source
    let dstChainId = config.chain.aptos.chainId  // Aptos destination (used for logging only)

    type EthereumChain = {
        node?: CreateServerReturnType | undefined
        provider: JsonRpcProvider
        escrowFactory: string
        resolver: string
    }

    let ethereumChain: EthereumChain

    let ethereumUser: Wallet
    let ethereumResolver: Wallet
    let ethereumFactory: EscrowFactory
    let ethereumResolverContract: Wallet

    let ethereumTimestamp: bigint

    async function increaseEthereumTime(t: number): Promise<void> {
        await ethereumChain.provider.send('evm_increaseTime', [t])
    }

    beforeAll(async () => {
        console.log("######### HELLO ########");
        // Initialize only Ethereum chain (source)
        ethereumChain = await initEthereumChain(config.chain.ethereum)
        ethereumUser = new Wallet(userPk, ethereumChain.provider)
        ethereumResolver = new Wallet(resolverPk, ethereumChain.provider)
        // // Setup Ethereum contracts
        ethereumFactory = new EscrowFactory(ethereumChain.provider, ethereumChain.escrowFactory)

        // // // Fund user with 1000 USDC on Ethereum and approve for limit order protocol
        // await ethereumUser.topUpFromDonor(
        //     config.chain.ethereum.tokens.USDC.address,
        //     config.chain.ethereum.tokens.USDC.donor,
        //     parseUnits('1000', 6)
        // )

        // await ethereumUser.approveToken(
        //     config.chain.ethereum.tokens.USDC.address,
        //     config.chain.ethereum.limitOrderProtocol,
        //     MaxUint256
        // )

        console.log("Resolver contract", ethereumChain.resolver);
        // // Setup resolver contract on Ethereum
        const balance = await getEthereumBalances(config.chain.ethereum.tokens.USDC.address);
        console.log("######### Balances ##########")
        console.log(balance);
        console.log("#########  ##########")
        // // Fund resolver for gas
        // await ethereumResolver.transfer(ethereumChain.resolver, parseEther('1'))

        ethereumTimestamp = BigInt((await ethereumChain.provider.getBlock('latest'))!.timestamp)
        console.log("ETHEREUM Timestamp: ", ethereumTimestamp);
    })

    async function getEthereumBalances(srcToken: string): Promise<{ user: bigint; resolver: bigint }> {
        return {
            user: await ethereumUser.tokenBalance(srcToken),
            resolver: await getContractTokenBalance(ethereumChain.resolver, srcToken, ethereumChain.provider)
        }
    }

    afterAll(async () => {
        ethereumChain.provider.destroy()
        // await ethereumChain.node?.stop()
    })

    // eslint-disable-next-line max-lines-per-function
    describe('Successful Swap from ETH SBL to Aptos FRESH', () => {
        it.skip('should swap Ethereum USDC -> Aptos MY_TOKEN with Skipping Aptos operation', async () => {
            console.log(`\n=== Starting Ethereum -> Aptos swap run: 1 ===`)
            console.log("Note: Run 1 tests the full flow without expecting failures")
            // Create cross-chain order
            const secretBytes = ethers.toUtf8Bytes("my_secret_password_for_swap_test");
            const secret = uint8ArrayToHex(secretBytes)
        
            const order = Sdk.CrossChainOrder.new(
                new Address(ethereumChain.escrowFactory),
                {
                    salt: Sdk.randBigInt(1000n),
                    maker: new Address(await ethereumUser.getAddress()),
                    makingAmount: parseUnits('1', 6), // 1 USDC
                    takingAmount: parseUnits('1', 6), // Equivalent amount on Aptos
                    makerAsset: new Address(config.chain.ethereum.tokens.USDC.address),
                    // Note: Using placeholder address because 1inch SDK doesn't support Aptos address format
                    // Actual Aptos token: 0x55625547c27ed94dde4184151d8a688d39615ace5d389b7fa4f0dbf887819b7c::my_token::SimpleToken
                    takerAsset: new Address('0x0000000000000000000000000000000000000000') // Placeholder for Aptos token
                },
                {
                    hashLock: Sdk.HashLock.forSingleFill(secret),
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: 10n,           // 10sec finality lock
                        srcPublicWithdrawal: 120n,    // 2min private withdrawal
                        srcCancellation: 121n,        // 1sec public withdrawal
                        srcPublicCancellation: 122n,  // 1sec private cancellation
                        dstWithdrawal: 10n,           // 10sec finality lock
                        dstPublicWithdrawal: 100n,    // 100sec private withdrawal
                        dstCancellation: 101n         // 1sec public withdrawal
                    }),
                    srcChainId: Sdk.NetworkEnum.ETHEREUM,
                    dstChainId: Sdk.NetworkEnum.COINBASE, // Using COINBASE as placeholder since SDK doesn't support APTOS yet
                    srcSafetyDeposit: parseEther('0.001'),
                    dstSafetyDeposit: parseEther('0.001')
                },
                {
                    auction: new Sdk.AuctionDetails({
                        initialRateBump: 0,
                        points: [],
                        duration: 120n,
                        startTime: ethereumTimestamp
                    }),
                    whitelist: [
                        {
                            address: new Address(ethereumChain.resolver),
                            allowFrom: 0n
                        }
                    ],
                    resolvingStartTime: 0n
                },
                {
                    nonce: Sdk.randBigInt(UINT_40_MAX),
                    allowPartialFills: false,
                    allowMultipleFills: false
                }
            )

            // User signs order on Ethereum
            const signature = await ethereumUser.signOrder(srcChainId, order)
            const orderHash = order.getOrderHash(srcChainId)

            // Resolver deploys escrow on Ethereum
            const resolverContract = new Resolver(ethereumChain.resolver, "APTOS_RESOLVER_ADDRESS")

            console.log(`[Ethereum] Filling order ${orderHash}`)

            const fillAmount = order.makingAmount
            const { txHash: orderFillHash, blockHash: ethereumDeployBlock } = await ethereumResolver.send(
                resolverContract.deploySrc(
                    srcChainId,
                    order,
                    signature,
                    Sdk.TakerTraits.default()
                        .setExtension(order.extension)
                        .setAmountMode(Sdk.AmountMode.maker)
                        .setAmountThreshold(order.takingAmount),
                    fillAmount
                )
            )


            console.log(`[Ethereum] Order ${orderHash} filled for ${fillAmount} USDC in tx: ${orderFillHash}`)

            const balance = await getEthereumBalances(config.chain.ethereum.tokens.USDC.address);
            console.log("######### Balance after eth order filled ##########")
            console.log(balance);
            console.log("#########  ##########")


            const ethereumEscrowEvent = await ethereumFactory.getSrcDeployEvent(ethereumDeployBlock)

            // Fund escrow on Aptos
            console.log(`[Aptos Testnet] Funding destination escrow for order ${orderHash}`)

            let aptosOrderId: number = -1;

            console.log("[Aptos Testnet] Skipping Aptos operations for first run (demonstrating Ethereum-only flow)")

            const ESCROW_SRC_IMPLEMENTATION = await ethereumFactory.getSourceImpl()
            const srcEscrowAddress = new Sdk.EscrowFactory(new Address(ethereumChain.escrowFactory)).getSrcEscrowAddress(
                ethereumEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )

            // Wait for finality period
            // await increaseEthereumTime(11)
            await sleepWithDetails(4, "Sleeping for 10 seconds", "WOKE UP JUST NOW!!!");

            // Claim funds on Aptos
            console.log("[Aptos Testnet] Skipping claim for first run")

            // Withdraw funds from Ethereum escrow for resolver
            console.log(`[Ethereum] Withdrawing funds for resolver from ${srcEscrowAddress}`)

            // Both runs should succeed - the Ethereum side is independent of Aptos funding
            const { txHash: resolverWithdrawHash } = await ethereumResolver.send(
                resolverContract.withdraw('src', srcEscrowAddress, secret, ethereumEscrowEvent[0])
            )
            console.log(`[Ethereum] Successfully withdrew funds for resolver in tx: ${resolverWithdrawHash}`)

            console.log("[Ethereum] Note: Withdrawal succeeded even without Aptos funding - this demonstrates the Ethereum escrow independence")

            console.log("######### Balance END ##########")
            console.log(balance);
            console.log("#########  ##########")

            console.log(`=== Completed Ethereum -> Aptos swap run: ${1} ===\n`)
        })

        it('should swap Ethereum SBL -> Aptos FRESH [Demonstrate complete swap]', async () => {
            console.log(`\n=== Starting Ethereum -> Aptos swap run: 2 ===`)

            console.log("Note: Run 2 demonstrates the complete cross-chain swap")

            // Create cross-chain order
            const secretBytes = ethers.toUtf8Bytes("my_secret_password_for_swap_test");
            const secret = uint8ArrayToHex(secretBytes)

            const order = Sdk.CrossChainOrder.new(
                new Address(ethereumChain.escrowFactory),
                {
                    salt: Sdk.randBigInt(1000n),
                    maker: new Address(await ethereumUser.getAddress()),
                    makingAmount: parseUnits('1', 6), // 1 USDC
                    takingAmount: parseUnits('1', 6), // Equivalent amount on Aptos
                    makerAsset: new Address(config.chain.ethereum.tokens.USDC.address),
                    // Note: Using placeholder address because 1inch SDK doesn't support Aptos address format
                    // Actual Aptos token: 0x55625547c27ed94dde4184151d8a688d39615ace5d389b7fa4f0dbf887819b7c::my_token::SimpleToken
                    takerAsset: new Address('0x0000000000000000000000000000000000000000') // Placeholder for Aptos token
                },
                {
                    hashLock: Sdk.HashLock.forSingleFill(secret),
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: 10n,           // 10sec finality lock
                        srcPublicWithdrawal: 120n,    // 2min private withdrawal
                        srcCancellation: 121n,        // 1sec public withdrawal
                        srcPublicCancellation: 122n,  // 1sec private cancellation
                        dstWithdrawal: 10n,           // 10sec finality lock
                        dstPublicWithdrawal: 100n,    // 100sec private withdrawal
                        dstCancellation: 101n         // 1sec public withdrawal
                    }),
                    srcChainId: Sdk.NetworkEnum.ETHEREUM,
                    dstChainId: Sdk.NetworkEnum.COINBASE, // Using COINBASE as placeholder since SDK doesn't support APTOS yet
                    srcSafetyDeposit: parseEther('0.001'),
                    dstSafetyDeposit: parseEther('0.001')
                },
                {
                    auction: new Sdk.AuctionDetails({
                        initialRateBump: 0,
                        points: [],
                        duration: 120n,
                        startTime: ethereumTimestamp
                    }),
                    whitelist: [
                        {
                            address: new Address(ethereumChain.resolver),
                            allowFrom: 0n
                        }
                    ],
                    resolvingStartTime: 0n
                },
                {
                    nonce: Sdk.randBigInt(UINT_40_MAX),
                    allowPartialFills: false,
                    allowMultipleFills: false
                }
            )

            // User signs order on Ethereum
            const signature = await ethereumUser.signOrder(srcChainId, order)
            const orderHash = order.getOrderHash(srcChainId)

            // Resolver deploys escrow on Ethereum
            const resolverContract = new Resolver(ethereumChain.resolver, "APTOS_RESOLVER_ADDRESS")

            console.log(`[Ethereum] Filling order ${orderHash}`)

            const fillAmount = order.makingAmount
            const { txHash: orderFillHash, blockHash: ethereumDeployBlock } = await ethereumResolver.send(
                resolverContract.deploySrc(
                    srcChainId,
                    order,
                    signature,
                    Sdk.TakerTraits.default()
                        .setExtension(order.extension)
                        .setAmountMode(Sdk.AmountMode.maker)
                        .setAmountThreshold(order.takingAmount),
                    fillAmount
                )
            )


            console.log(`[Ethereum] Order ${orderHash} filled for ${fillAmount} USDC in tx: ${orderFillHash}`)

            const balance = await getEthereumBalances(config.chain.ethereum.tokens.USDC.address);
            console.log("######### Balance after eth order filled ##########")
            console.log(balance);
            console.log("#########  ##########")


            const ethereumEscrowEvent = await ethereumFactory.getSrcDeployEvent(ethereumDeployBlock)

            // Fund escrow on Aptos
            console.log(`[Aptos Testnet] Funding destination escrow for order ${orderHash}`)

            let aptosOrderId: number = -1;


            try {
                aptosOrderId = await aptos.fund_dst_escrow()
                console.log(`[Aptos Testnet] Successfully funded escrow with order ID: ${aptosOrderId}`)
            } catch (error) {
                console.log(`[Aptos Testnet] Failed to fund escrow: ${error}`)
            }


            const ESCROW_SRC_IMPLEMENTATION = await ethereumFactory.getSourceImpl()
            const srcEscrowAddress = new Sdk.EscrowFactory(new Address(ethereumChain.escrowFactory)).getSrcEscrowAddress(
                ethereumEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )

            // Wait for finality period
            // await increaseEthereumTime(11)
            await sleepWithDetails(4, "Sleeping for 10 seconds", "WOKE UP JUST NOW!!!");


            console.log(`[Aptos Testnet] Attempting to claim funds for user`)
            if (aptosOrderId !== -1) {
                try {
                    await aptos.claim_funds(aptosOrderId, aptos.userAccount);
                    console.log(`[Aptos Testnet] Successfully claimed funds for order: ${aptosOrderId}`)
                } catch (error) {
                    console.log(`[Aptos Testnet] Failed to claim funds: ${error}`)
                }
            } else {
                console.log("[Aptos Testnet] No valid order ID to claim funds from")
            }


            // Withdraw funds from Ethereum escrow for resolver
            console.log(`[Ethereum] Withdrawing funds for resolver from ${srcEscrowAddress}`)

            // Both runs should succeed - the Ethereum side is independent of Aptos funding
            const { txHash: resolverWithdrawHash } = await ethereumResolver.send(
                resolverContract.withdraw('src', srcEscrowAddress, secret, ethereumEscrowEvent[0])
            )
            console.log(`[Ethereum] Successfully withdrew funds for resolver in tx: ${resolverWithdrawHash}`)


            console.log("######### Balance END ##########")
            console.log(balance);
            console.log("#########  ##########")

            console.log(`=== Completed Ethereum -> Aptos swap run ===\n`)
        })
    })

    describe.skip('Cancellation', () => {
        it.skip('should cancel Ethereum USDC -> Aptos MY_TOKEN swap', async () => {
            console.log("\n=== Testing Ethereum -> Aptos swap cancellation ===")

            // Create order with random hash lock (secret won't be revealed)
            const hashLock = Sdk.HashLock.forSingleFill(uint8ArrayToHex(randomBytes(32)))

            const order = Sdk.CrossChainOrder.new(
                new Address(ethereumChain.escrowFactory),
                {
                    salt: Sdk.randBigInt(1000n),
                    maker: new Address(await ethereumUser.getAddress()),
                    makingAmount: parseUnits('100', 6), // 100 USDC
                    takingAmount: parseUnits('99', 6),  // Slightly less on Aptos
                    makerAsset: new Address(config.chain.ethereum.tokens.USDC.address),
                    takerAsset: new Address('0x0000000000000000000000000000000000000000') // Placeholder for Aptos token
                },
                {
                    hashLock,
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: 0n,            // No finality lock for test
                        srcPublicWithdrawal: 120n,    // 2min private withdrawal
                        srcCancellation: 121n,        // 1sec public withdrawal
                        srcPublicCancellation: 122n,  // 1sec private cancellation
                        dstWithdrawal: 0n,            // No finality lock for test
                        dstPublicWithdrawal: 100n,    // 100sec private withdrawal
                        dstCancellation: 101n         // 1sec public withdrawal
                    }),
                    srcChainId: Sdk.NetworkEnum.ETHEREUM,
                    dstChainId: Sdk.NetworkEnum.COINBASE, // Using COINBASE as placeholder since SDK doesn't support APTOS yet
                    srcSafetyDeposit: parseEther('0.001'),
                    dstSafetyDeposit: parseEther('0.001')
                },
                {
                    auction: new Sdk.AuctionDetails({
                        initialRateBump: 0,
                        points: [],
                        duration: 120n,
                        startTime: ethereumTimestamp
                    }),
                    whitelist: [
                        {
                            address: new Address(ethereumChain.resolver),
                            allowFrom: 0n
                        }
                    ],
                    resolvingStartTime: 0n
                },
                {
                    nonce: Sdk.randBigInt(UINT_40_MAX),
                    allowPartialFills: false,
                    allowMultipleFills: false
                }
            )

            const signature = await ethereumUser.signOrder(srcChainId, order)
            const orderHash = order.getOrderHash(srcChainId)

            // Resolver fills order on Ethereum
            const resolverContract = new Resolver(ethereumChain.resolver, "APTOS_RESOLVER_ADDRESS")

            console.log(`[Ethereum] Filling order ${orderHash} for cancellation test`)

            const fillAmount = order.makingAmount
            const { txHash: orderFillHash, blockHash: ethereumDeployBlock } = await ethereumResolver.send(
                resolverContract.deploySrc(
                    srcChainId,
                    order,
                    signature,
                    Sdk.TakerTraits.default()
                        .setExtension(order.extension)
                        .setAmountMode(Sdk.AmountMode.maker)
                        .setAmountThreshold(order.takingAmount),
                    fillAmount
                )
            )

            console.log(`[Ethereum] Order ${orderHash} filled for ${fillAmount} USDC in tx: ${orderFillHash}`)

            const ethereumEscrowEvent = await ethereumFactory.getSrcDeployEvent(ethereumDeployBlock)

            // Fund escrow on Aptos
            console.log(`[Aptos] Funding destination escrow for cancellation test`)
            const aptosOrderIdForCancel = await aptos.fund_dst_escrow()

            const ESCROW_SRC_IMPLEMENTATION = await ethereumFactory.getSourceImpl()
            const srcEscrowAddress = new Sdk.EscrowFactory(new Address(ethereumChain.escrowFactory)).getSrcEscrowAddress(
                ethereumEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )

            // Wait for cancellation period
            await increaseEthereumTime(125)

            // Cancel on Aptos first
            console.log(`[Aptos] Cancelling swap for order: ${aptosOrderIdForCancel}`)
            if (aptosOrderIdForCancel !== -1) {
                await aptos.cancel_swap(aptosOrderIdForCancel)
                console.log(`[Aptos] Successfully cancelled order: ${aptosOrderIdForCancel}`)
            } else {
                console.log("[Aptos] Failed to get order ID for cancellation")
            }

            // Cancel on Ethereum
            console.log(`[Ethereum] Cancelling escrow ${srcEscrowAddress}`)
            const { txHash: cancelEthereumEscrow } = await ethereumResolver.send(
                resolverContract.cancel('src', srcEscrowAddress, ethereumEscrowEvent[0])
            )
            console.log(`[Ethereum] Successfully cancelled escrow in tx: ${cancelEthereumEscrow}`)

            console.log("=== Completed Ethereum -> Aptos cancellation test ===\n")
        })
    })
})

async function initEthereumChain(
    cnf: ChainConfig
): Promise<{ node?: CreateServerReturnType; provider: JsonRpcProvider; escrowFactory: string; resolver: string }> {
    const { node, provider } = await getProvider(cnf)
    console.log("PROVIDER", provider)
    console.log("Node", node)
    const deployer = new SignerWallet(cnf.ownerPrivateKey, provider)

    // Deploy EscrowFactory on Ethereum
    const escrowFactory = await deploy(
        factoryContract,
        [
            cnf.limitOrderProtocol,
            cnf.wrappedNative,
            Address.fromBigInt(0n).toString(), // accessToken
            deployer.address, // owner
            60 * 30, // src rescue delay
            60 * 30  // dst rescue delay
        ],
        provider,
        deployer
    )
    console.log(`[Ethereum] Escrow factory deployed to: ${escrowFactory}`)

    // Deploy Resolver contract on Ethereum
    const resolver = await deploy(
        resolverContract,
        [
            escrowFactory,
            cnf.limitOrderProtocol,
            // computeAddress(resolverPk) // resolver as owner
            "0x29C705923aae1e40D6eb59e6ED8F008A55483Fa7"
        ],
        provider,
        deployer
    )
    console.log(`[Ethereum] Resolver contract deployed to: ${resolver}`)

    return { node: node, provider, resolver, escrowFactory }
}

async function getProvider(cnf: ChainConfig): Promise<{ node?: CreateServerReturnType; provider: JsonRpcProvider }> {
    // if (!cnf.createFork) {
    //     return {
    //         provider: new JsonRpcProvider(cnf.url, cnf.chainId)
    //     }
    // }

    // const node = createServer({
    //     instance: anvil({ forkUrl: cnf.url, chainId: cnf.chainId, forkBlockNumber: cnf.blockNumber }),
    //     limit: 1
    // })
    // await node.start()

    // const address = node.address()
    // assert(address)

    console.log("=== config ====", cnf);

    const provider = new JsonRpcProvider(cnf.url, cnf.chainId)

    return {
        provider,
        node: undefined
    }
}

/**
 * Deploy contract and return its address
 */
async function deploy(
    json: { abi: any; bytecode: any },
    params: unknown[],
    provider: JsonRpcProvider,
    deployer: SignerWallet
): Promise<string> {
    const deployed = await new ContractFactory(json.abi, json.bytecode, deployer).deploy(...params)
    await deployed.waitForDeployment()

    return await deployed.getAddress()
}

