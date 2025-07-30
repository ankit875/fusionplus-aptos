import type { Token } from '@/store/swap-store'

export const CHAIN_IDS = {
  ETHEREUM: 1,
  BSC: 56,
  POLYGON: 137,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BASE: 8453,
  APTOS: 999999, // Custom ID for Aptos
} as const

export const CHAINS = [
  {
    id: CHAIN_IDS.ETHEREUM,
    name: 'Ethereum',
    symbol: 'ETH',
    logoURI: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png',
  },
  {
    id: CHAIN_IDS.BSC,
    name: 'BNB Chain',
    symbol: 'BNB',
    logoURI: 'https://tokens.1inch.io/0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c.png',
  },
  {
    id: CHAIN_IDS.POLYGON,
    name: 'Polygon',
    symbol: 'MATIC',
    logoURI: 'https://tokens.1inch.io/0x0000000000000000000000000000000000001010.png',
  },
  {
    id: CHAIN_IDS.ARBITRUM,
    name: 'Arbitrum',
    symbol: 'ETH',
    logoURI: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png',
  },
  {
    id: CHAIN_IDS.APTOS,
    name: 'Aptos',
    symbol: 'APT',
    logoURI: 'https://raw.githubusercontent.com/aptos-labs/aptos-core/main/ecosystem/platform/public/logo.png',
  },
]

export const TOKENS_BY_CHAIN: Record<number, Token[]> = {
  [CHAIN_IDS.ETHEREUM]: [
    {
      address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      chainId: CHAIN_IDS.ETHEREUM,
      logoURI: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png',
    },
    {
      address: '0xa0b86a33e6441d147eec6b0fb6a44dafb51d7b6a',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: CHAIN_IDS.ETHEREUM,
      logoURI: 'https://tokens.1inch.io/0xa0b86a33e6441d147eec6b0fb6a44dafb51d7b6a.png',
    },
    {
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      chainId: CHAIN_IDS.ETHEREUM,
      logoURI: 'https://tokens.1inch.io/0xdac17f958d2ee523a2206206994597c13d831ec7.png',
    },
    {
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      chainId: CHAIN_IDS.ETHEREUM,
      logoURI: 'https://tokens.1inch.io/0x6b175474e89094c44da98b954eedeac495271d0f.png',
    },
  ],
  [CHAIN_IDS.BSC]: [
    {
      address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      symbol: 'BNB',
      name: 'BNB',
      decimals: 18,
      chainId: CHAIN_IDS.BSC,
      logoURI: 'https://tokens.1inch.io/0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c.png',
    },
    {
      address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 18,
      chainId: CHAIN_IDS.BSC,
      logoURI: 'https://tokens.1inch.io/0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d.png',
    },
    {
      address: '0x55d398326f99059ff775485246999027b3197955',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 18,
      chainId: CHAIN_IDS.BSC,
      logoURI: 'https://tokens.1inch.io/0x55d398326f99059ff775485246999027b3197955.png',
    },
  ],
  [CHAIN_IDS.APTOS]: [
    {
      address: '0x1::aptos_coin::AptosCoin',
      symbol: 'APT',
      name: 'Aptos',
      decimals: 8,
      chainId: CHAIN_IDS.APTOS,
      logoURI: 'https://raw.githubusercontent.com/aptos-labs/aptos-core/main/ecosystem/platform/public/logo.png',
    },
    {
      address: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: CHAIN_IDS.APTOS,
      logoURI: 'https://tokens.1inch.io/0xa0b86a33e6441d147eec6b0fb6a44dafb51d7b6a.png',
    },
  ],
}
