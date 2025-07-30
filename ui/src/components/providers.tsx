'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'
import { Network } from '@aptos-labs/ts-sdk'
import { config } from '@/lib/wagmi'
import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  const dappConfig = {
    network: Network.MAINNET,
    aptosApiKeys: {
      testnet: process.env.NEXT_PUBLIC_APTOS_TESTNET_API_KEY || '',
      mainnet: process.env.NEXT_PUBLIC_APTOS_MAINNET_API_KEY || ''
    }
  }
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AptosWalletAdapterProvider
            plugins={[]}
            autoConnect={true}
            dappConfig={dappConfig}
            onError={(error) => {
              console.error('Aptos Wallet Error:', error)
            }}
          >
            {children}
          </AptosWalletAdapterProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
