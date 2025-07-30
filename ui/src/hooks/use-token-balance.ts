'use client'

import { useEffect, useState } from 'react'
import { useAccount, useBalance } from 'wagmi'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { formatUnits } from 'viem'
import type { Token } from '@/store/swap-store'

export interface TokenBalance {
  token: Token
  balance: string
  formattedBalance: string
  isLoading: boolean
}

export function useTokenBalance(token: Token | null) {
  const [balance, setBalance] = useState<string>('0')
  const [isLoading, setIsLoading] = useState(false)
  
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount()
  const { account: aptosAccount, connected: isAptosConnected } = useWallet()
  
  // EVM token balance
  const { data: evmBalance, isLoading: isEvmLoading } = useBalance({
    address: evmAddress,
    token: token?.address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' 
      ? undefined 
      : token?.address as `0x${string}`,
    query: {
      enabled: !!(token && isEvmConnected && token.chainId !== 999999)
    }
  })

  useEffect(() => {
    if (!token) {
      setBalance('0')
      return
    }

    setIsLoading(true)

    if (token.chainId === 999999) {
      // Aptos token balance
      if (isAptosConnected && aptosAccount?.address) {
        fetchAptosBalance(token, aptosAccount.address)
      } else {
        setBalance('0')
        setIsLoading(false)
      }
    } else {
      // EVM token balance
      if (evmBalance) {
        setBalance(formatUnits(evmBalance.value, evmBalance.decimals))
      } else {
        setBalance('0')
      }
      setIsLoading(isEvmLoading)
    }
  }, [token, evmBalance, isEvmLoading, isAptosConnected, aptosAccount])

  const fetchAptosBalance = async (token: Token, address: string) => {
    try {
      // Mock Aptos balance - replace with actual Aptos SDK call
      // const aptosClient = new AptosClient(process.env.NEXT_PUBLIC_APTOS_RPC!)
      // const balance = await aptosClient.getAccountResource(address, token.address)
      
      // For now, return mock balance
      setBalance('100.0')
      setIsLoading(false)
    } catch (error) {
      console.error('Error fetching Aptos balance:', error)
      setBalance('0')
      setIsLoading(false)
    }
  }

  return {
    balance,
    formattedBalance: parseFloat(balance).toFixed(4),
    isLoading
  }
}
