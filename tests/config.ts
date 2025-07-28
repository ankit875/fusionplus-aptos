import { z } from 'zod'
import Sdk from '@1inch/cross-chain-sdk'
import * as process from 'node:process'

const bool = z
    .string()
    .transform((v) => v.toLowerCase() === 'true')
    .pipe(z.boolean())

const ConfigSchema = z.object({
    // Support both old and new naming for backward compatibility
    SRC_CHAIN_RPC: z.string().url().optional(),
    DST_CHAIN_RPC: z.string().url().optional(),
    ETHEREUM_RPC: z.string().url().optional(),
    SRC_CHAIN_CREATE_FORK: bool.default('true'),
    DST_CHAIN_CREATE_FORK: bool.default('true'),
    ETHEREUM_CREATE_FORK: bool.default('true')
})

const fromEnv = ConfigSchema.parse(process.env)

// Use ETHEREUM_RPC if available, otherwise fall back to SRC_CHAIN_RPC
const ethereumRpc = fromEnv.ETHEREUM_RPC || fromEnv.SRC_CHAIN_RPC
const ethereumCreateFork = fromEnv.ETHEREUM_CREATE_FORK || fromEnv.SRC_CHAIN_CREATE_FORK

if (!ethereumRpc) {
    throw new Error('Missing Ethereum RPC URL. Please set either ETHEREUM_RPC or SRC_CHAIN_RPC in your environment variables.')
}

export const config = {
    chain: {
        // Source chain: Ethereum
        ethereum: {
            chainId: 11155111,
            url: "https://sepolia.infura.io/v3/eefe96c240bc4745a6d895d83d3968b4",
            createFork: false,
            limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
            wrappedNative: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
            ownerPrivateKey: '7764b03c4d3eb019cc0ec0630429622593b8d7625b83a109e9f2279828a88a66',
            blockNumber: 8844845,
            tokens: {
                USDC: {
                    address: '0x51B6c8FAb037fBf365CF43A02c953F2305e70bb4',
                    donor: '0x4B16c5dE96EB2117bBE5fd171E4d203624B014aa'
                }
            }
            // chainId: Sdk.NetworkEnum.COINBASE,
            // url: "https://1rpc.io/base",
            // createFork: true,
            // limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
            // wrappedNative: '0x4200000000000000000000000000000000000006',
            // ownerPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            // tokens: {
            //     USDC: {
            //         address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            //         donor: '0x4B16c5dE96EB2117bBE5fd171E4d203624B014aa'
            //     }
            // }
            // chainId: Sdk.NetworkEnum.BINANCE,
            // url: "https://bsc.nodereal.io",
            // createFork: true,
            // limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
            // wrappedNative: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
            // ownerPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            // blockNumber: 29621722,
            // tokens: {
            //     USDC: {
            //         address: '0x8965349fb649a33a30cbfda057d8ec2c48abe2a2',
            //         donor: '0x4188663a85C92EEa35b5AD3AA5cA7CeB237C6fe9'
            //     }
            // }
        },
        // Destination chain: Aptos
        aptos: {
            chainId: "APTOS",
            url: "https://fullnode.testnet.aptoslabs.com/v1",
            createFork: false, // Aptos doesn't support forking like EVM
            limitOrderProtocol: '', // Not applicable for Aptos
            wrappedNative: '', // Not applicable for Aptos
            ownerPrivateKey: '0x6d88a78a06fe6928d92911c5342917f4b76f0f65e65385cdba70457155db6e6f',
            blockNumber: 0, // Not applicable for Aptos
            tokens: {
                MY_TOKEN: {
                    address: '0x6a33e62028e210d895c22c631c17c856cf774c887785357672636db8530e6226',
                    donor: '0x6a33e62028e210d895c22c631c17c856cf774c887785357672636db8530e6226'
                }
            }
        }
    }

}

export type ChainConfig = (typeof config.chain)['ethereum']
