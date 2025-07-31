import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
  chainId: number
}

export interface SwapState {
  fromToken: Token | null
  toToken: Token | null
  fromAmount: string
  toAmount: string
  fromChain: number
  toChain: number
  slippage: number
  isLoading: boolean
  quote: any | null
  
  // Actions
  setFromToken: (token: Token | null) => void
  setToToken: (token: Token | null) => void
  setFromAmount: (amount: string) => void
  setToAmount: (amount: string) => void
  setFromChain: (chainId: number) => void
  setToChain: (chainId: number) => void
  setSlippage: (slippage: number) => void
  setIsLoading: (loading: boolean) => void
  setQuote: (quote: any) => void
  swapTokens: () => void
  resetSwap: () => void
}

export const useSwapStore = create<SwapState>()(
  devtools((set, get) => ({
    fromToken: null,
    toToken: null,
    fromAmount: '',
    toAmount: '',
    fromChain: 11155111, // Ethereum Sepolia testnet
    toChain: 8453, // Base mainnet
    slippage: 0.5,
    isLoading: false,
    quote: null,

    setFromToken: (token) => set({ fromToken: token }),
    setToToken: (token) => set({ toToken: token }),
    setFromAmount: (amount) => set({ fromAmount: amount }),
    setToAmount: (amount) => set({ toAmount: amount }),
    setFromChain: (chainId) => set({ fromChain: chainId }),
    setToChain: (chainId) => set({ toChain: chainId }),
    setSlippage: (slippage) => set({ slippage }),
    setIsLoading: (loading) => set({ isLoading: loading }),
    setQuote: (quote) => set({ quote }),

    swapTokens: () => {
      const { fromToken, toToken, fromChain, toChain } = get()
      set({
        fromToken: toToken,
        toToken: fromToken,
        fromChain: toChain,
        toChain: fromChain,
        fromAmount: '',
        toAmount: '',
        quote: null,
      })
    },

    resetSwap: () => set({
      fromToken: null,
      toToken: null,
      fromAmount: '',
      toAmount: '',
      quote: null,
    }),
  }))
)
