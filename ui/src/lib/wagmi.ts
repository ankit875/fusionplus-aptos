import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  sepolia,
  bsc,
} from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: '8inch Cross-Chain Swap',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [
    mainnet,
    polygon,
    optimism,
    arbitrum,
    base,
    bsc,
    ...(process.env.NODE_ENV === 'development' ? [sepolia] : []),
  ],
  ssr: true,
})
