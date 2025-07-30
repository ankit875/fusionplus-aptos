'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, Settings } from 'lucide-react'
import { TokenSelector } from './token-selector'
import { ChainSelector } from './chain-selector'
import { AmountInput } from './amount-input'
import { SwapSettings } from './swap-settings'
import { useSwapStore } from '@/store/swap-store'
import { useAccount } from 'wagmi'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { useTokenBalance } from '@/hooks/use-token-balance'
import { CHAIN_IDS } from '@/lib/tokens'
import toast from 'react-hot-toast'

export function SwapInterface() {
  const [showSettings, setShowSettings] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  
  const {
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    fromChain,
    toChain,
    isLoading,
    swapTokens,
    setFromToken,
    setToToken,
    setFromAmount,
    setToAmount,
    setFromChain,
    setToChain,
    setIsLoading,
  } = useSwapStore()

  const { isConnected: isEvmConnected } = useAccount()
  const { connected: isAptosConnected } = useWallet()
  
  const { balance: fromTokenBalance } = useTokenBalance(fromToken)

  // Validation logic
  useEffect(() => {
    setValidationError(null)
    
    if (!fromToken || !toToken) {
      return
    }
    
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      return
    }
    
    // Check if user has sufficient balance
    if (parseFloat(fromAmount) > parseFloat(fromTokenBalance)) {
      setValidationError('Insufficient balance')
      return
    }
    
    // Check wallet connections
    const fromChainIsAptos = fromChain === CHAIN_IDS.APTOS
    const toChainIsAptos = toChain === CHAIN_IDS.APTOS
    
    if (fromChainIsAptos && !isAptosConnected) {
      setValidationError('Connect Aptos wallet to swap from Aptos')
      return
    }
    
    if (!fromChainIsAptos && !isEvmConnected) {
      setValidationError('Connect EVM wallet to swap from EVM chains')
      return
    }
    
    if (toChainIsAptos && !isAptosConnected) {
      setValidationError('Connect Aptos wallet to swap to Aptos')
      return
    }
    
    if (!toChainIsAptos && !isEvmConnected) {
      setValidationError('Connect EVM wallet to swap to EVM chains')
      return
    }
    
    // Mock quote calculation
    const mockQuote = (parseFloat(fromAmount) * 0.998).toString()
    setToAmount(mockQuote)
  }, [fromToken, toToken, fromAmount, fromTokenBalance, isEvmConnected, isAptosConnected, fromChain, toChain, setToAmount])

  const handleSwap = async () => {
    if (validationError) {
      toast.error(validationError)
      return
    }
    
    try {
      setIsLoading(true)
      
      // Mock swap logic - replace with actual swap implementation
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast.success('Swap completed successfully!')
      setFromAmount('')
      setToAmount('')
    } catch (error) {
      toast.error('Swap failed. Please try again.')
      console.error('Swap error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const isSwapDisabled = () => {
    return (
      !fromToken ||
      !toToken ||
      !fromAmount ||
      parseFloat(fromAmount) <= 0 ||
      !!validationError ||
      isLoading
    )
  }

  const getSwapButtonText = () => {
    if (isLoading) return 'Swapping...'
    if (validationError) return validationError
    if (!fromToken || !toToken) return 'Select tokens'
    if (!fromAmount || parseFloat(fromAmount) <= 0) return 'Enter amount'
    return 'Swap'
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Swap</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {showSettings && <SwapSettings />}
        
        {/* From Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">From</span>
            <ChainSelector 
              selectedChain={fromChain}
              onChainSelect={setFromChain}
            />
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1">
              <AmountInput
                value={fromAmount}
                onChange={setFromAmount}
                placeholder="0.0"
              />
              {fromToken && (
                <div className="text-xs text-muted-foreground mt-1">
                  Balance: {parseFloat(fromTokenBalance).toFixed(4)} {fromToken.symbol}
                </div>
              )}
            </div>
            <TokenSelector
              selectedToken={fromToken}
              onTokenSelect={setFromToken}
              chainId={fromChain}
            />
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={swapTokens}
            className="rounded-full"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>

        {/* To Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">To</span>
            <ChainSelector 
              selectedChain={toChain}
              onChainSelect={setToChain}
            />
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1">
              <AmountInput
                value={toAmount}
                onChange={setToAmount}
                placeholder="0.0"
                readOnly
              />
            </div>
            <TokenSelector
              selectedToken={toToken}
              onTokenSelect={setToToken}
              chainId={toChain}
            />
          </div>
        </div>

        {/* Error Display */}
        {validationError && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            {validationError}
          </div>
        )}

        {/* Swap Button */}
        <Button 
          className="w-full" 
          onClick={handleSwap}
          disabled={isSwapDisabled()}
        >
          {getSwapButtonText()}
        </Button>
      </CardContent>
    </Card>
  )
}
