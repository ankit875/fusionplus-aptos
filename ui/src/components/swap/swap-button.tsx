'use client'

import { Button } from '@/components/ui/button'
import { useSwapStore } from '@/store/swap'
import { useAccount } from 'wagmi'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function SwapButton() {
  const { 
    fromChain, 
    toChain, 
    fromToken, 
    toToken, 
    fromAmount, 
    isLoading 
  } = useSwapStore()
  
  const { isConnected: isEvmConnected } = useAccount()
  const { connected: isAptosConnected } = useWallet()

  const handleSwap = async () => {
    try {
      useSwapStore.getState().setLoading(true)
      
      // Mock swap logic - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast.success('Swap completed successfully!')
      useSwapStore.getState().reset()
    } catch (error) {
      toast.error('Swap failed. Please try again.')
      console.error('Swap error:', error)
    } finally {
      useSwapStore.getState().setLoading(false)
    }
  }

  const getButtonText = () => {
    if (!fromChain || !toChain) return 'Select chains'
    if (!fromToken || !toToken) return 'Select tokens'
    if (!fromAmount || parseFloat(fromAmount) <= 0) return 'Enter amount'
    
    // Check wallet connections based on chain types
    const needsEvmConnection = [fromChain, toChain].some(chain => chain.chainId !== 999999)
    const needsAptosConnection = [fromChain, toChain].some(chain => chain.chainId === 999999)
    
    if (needsEvmConnection && !isEvmConnected) return 'Connect EVM wallet'
    if (needsAptosConnection && !isAptosConnected) return 'Connect Aptos wallet'
    
    if (isLoading) return 'Swapping...'
    return 'Swap'
  }

  const isDisabled = () => {
    if (!fromChain || !toChain || !fromToken || !toToken) return true
    if (!fromAmount || parseFloat(fromAmount) <= 0) return true
    if (isLoading) return true
    
    const needsEvmConnection = [fromChain, toChain].some(chain => chain.chainId !== 999999)
    const needsAptosConnection = [fromChain, toChain].some(chain => chain.chainId === 999999)
    
    if (needsEvmConnection && !isEvmConnected) return true
    if (needsAptosConnection && !isAptosConnected) return true
    
    return false
  }

  return (
    <Button 
      onClick={handleSwap}
      disabled={isDisabled()}
      className="w-full h-12 text-lg font-semibold"
      size="lg"
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {getButtonText()}
    </Button>
  )
}
