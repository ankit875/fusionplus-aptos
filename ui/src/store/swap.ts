import { create } from 'zustand'

export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
  chainId: number
}

export interface Chain {
  chainId: number
  name: string
  symbol: string
  logoURI?: string
  rpcUrls: string[]
  blockExplorerUrls: string[]
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

interface SwapState {
  // Chain and token selections
  fromChain: Chain | null
  toChain: Chain | null
  fromToken: Token | null
  toToken: Token | null
  
  // Amounts
  fromAmount: string
  toAmount: string
  
  // Quote and transaction state
  quote: any | null
  isLoading: boolean
  error: string | null
  
  // Actions
  setFromChain: (chain: Chain) => void
  setToChain: (chain: Chain) => void
  setFromToken: (token: Token) => void
  setToToken: (token: Token) => void
  setFromAmount: (amount: string) => void
  setToAmount: (amount: string) => void
  setQuote: (quote: any) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  swapTokens: () => void
  reset: () => void
}

// Default chains
const defaultChains: Chain[] = [
  {
    chainId: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    logoURI: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png',
    rpcUrls: ['https://eth.merkle.io'],
    blockExplorerUrls: ['https://etherscan.io'],
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  {
    chainId: 56,
    name: 'BNB Chain',
    symbol: 'BNB',
    logoURI: 'https://tokens.1inch.io/0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c.png',
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    blockExplorerUrls: ['https://bscscan.com'],
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
  },
  {
    chainId: 999999, // Custom chainId for Aptos
    name: 'Aptos',
    symbol: 'APT',
    logoURI: 'https://raw.githubusercontent.com/aptos-labs/aptos-core/main/ecosystem/platform/public/logo.png',
    rpcUrls: ['https://fullnode.mainnet.aptoslabs.com/v1'],
    blockExplorerUrls: ['https://explorer.aptoslabs.com'],
    nativeCurrency: {
      name: 'Aptos',
      symbol: 'APT',
      decimals: 8,
    },
  },
]

export const useSwapStore = create<SwapState>((set, get) => ({
  // Initial state
  fromChain: defaultChains[0],
  toChain: defaultChains[2], // Aptos
  fromToken: null,
  toToken: null,
  fromAmount: '',
  toAmount: '',
  quote: null,
  isLoading: false,
  error: null,

  // Actions
  setFromChain: (chain) => set({ fromChain: chain }),
  setToChain: (chain) => set({ toChain: chain }),
  setFromToken: (token) => set({ fromToken: token }),
  setToToken: (token) => set({ toToken: token }),
  setFromAmount: (amount) => set({ fromAmount: amount }),
  setToAmount: (amount) => set({ toAmount: amount }),
  setQuote: (quote) => set({ quote }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  swapTokens: () => {
    const state = get()
    set({
      fromChain: state.toChain,
      toChain: state.fromChain,
      fromToken: state.toToken,
      toToken: state.fromToken,
      fromAmount: state.toAmount,
      toAmount: state.fromAmount,
    })
  },
  
  reset: () => set({
    fromAmount: '',
    toAmount: '',
    quote: null,
    isLoading: false,
    error: null,
  }),
}))

export { defaultChains }
