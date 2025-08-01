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

interface OrderPayload {
  maker: string
  makingAmount: string
  takingAmount: string
  makerAsset: string
  takerAsset: string
  receiverAddress?: string // Optional for Aptos, required for EVM
  srcChainId: number
  dstChainId: number
  secret: string
}

interface CreatedOrder {
  id?: string
  order: any
  extension: string
  typedData?: {
    domain: any
    types: { [key: string]: any }
    primaryType: string
    message: any
  }
  orderHash: string
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      isMetaMask?: boolean
    }
  }
}

export function SwapInterface() {
  const [showSettings, setShowSettings] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [signing, setSigning] = useState<boolean>(false)
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [filledOrder, setFilledOrder] = useState<any>(null)
  
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

  const { isConnected: isEvmConnected, address: userAddress } = useAccount()
  const { connected: isAptosConnected, account } = useWallet()
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
    
    if (parseFloat(fromAmount) > parseFloat(fromTokenBalance)) {
      setValidationError('Insufficient balance')
      return
    }
    
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
    
    const mockQuote = (parseFloat(fromAmount) * 0.998).toString()
    setToAmount(mockQuote)
  }, [fromToken, toToken, fromAmount, fromTokenBalance, isEvmConnected, isAptosConnected, fromChain, toChain, setToAmount])

  const orderPayload: OrderPayload = {
    maker: userAddress || '0xAF8AE7A70f3E0158d4587B642E6d60c9Da8Faa1D',
    makingAmount: fromAmount ? (parseFloat(fromAmount) * 1e6).toString() : '0',
    takingAmount: toAmount ? (parseFloat(toAmount) * 1e6).toString() : '0',
    makerAsset: fromToken?.address || '0x51B6c8FAb037fBf365CF43A02c953F2305e70bb4',
    takerAsset: toToken?.address || '0x0000000000000000000000000000000000000000',
    receiverAddress: account?.address,
    srcChainId: fromChain || 11155111,
    dstChainId: toChain || 8453,
    secret: 'my_secret_password_for_swap_test',
  }
  console.log('Order Payload:', account?.address)
  const createOrder = async (): Promise<void> => {
    setLoading(true)
    setValidationError(null)
    
    try {
      const response = await fetch('http://localhost:3002/relayer/createOrder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      })

      const data = await response.json()
      if (response.ok) {
        console.log('Order created:', data)
        setCreatedOrder(data)
        toast.success('Order created successfully!')
      } else {
        setValidationError(`API Error: ${response.status} - ${data.message || 'Unknown error'}`)
        toast.error('Failed to create order')
      }
    } catch (err) {
      setValidationError(`Network Error: ${err instanceof Error ? err.message : 'Failed to connect to server'}`)
      toast.error('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fillOrder = async (sig: string) => {
    if (!createdOrder) {
      setValidationError('Order missing')
      toast.error('Order missing')
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch('http://localhost:3002/relayer/fillOrder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: createdOrder.order,
          extension: createdOrder.extension,
          orderHash: createdOrder.orderHash,
          signature: sig,
          srcChainId: fromChain || 11155111,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        console.log('Order filled:', data)
        setFilledOrder(data)
        toast.success('Order filled successfully!')
        setFromAmount('')
        setToAmount('')
        setCreatedOrder(null)
        setSignature(null)
      } else {
        setValidationError(`API Error: ${response.status} - ${data.message || 'Unknown error'}`)
        toast.error('Failed to fill order')
      }
    } catch (err) {
      setValidationError(`Network Error: ${err instanceof Error ? err.message : 'Failed to connect to server'}`)
      toast.error('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  const signOrder = async (): Promise<void> => {
    if (!window.ethereum) {
      setValidationError('Wallet not available')
      toast.error('Wallet not available')
      return
    }

    if (!userAddress) {
      setValidationError('Wallet not connected')
      toast.error('Wallet not connected')
      return
    }

    if (!createdOrder || !createdOrder.typedData) {
      setValidationError('No order to sign')
      toast.error('No order to sign')
      return
    }

    setSigning(true)
    setValidationError(null)

    try {
      const { typedData } = createdOrder

      const signature = await window.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [
          userAddress,
          JSON.stringify({
            domain: typedData.domain,
            types: {
              EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
              ],
              ...typedData.types,
            },
            primaryType: typedData.primaryType,
            message: typedData.message,
          }),
        ],
      })
      console.log('Signature: created...', signature)
      setSignature(signature)
      toast.success('Order signed successfully!')
      
      // Pass signature directly to fillOrder
      await fillOrder(signature)
    } catch (err) {
      setValidationError(`Failed to sign order: ${err instanceof Error ? err.message : 'Unknown error'}`)
      toast.error('Failed to sign order')
    } finally {
      setSigning(false)
    }
  }

  const handleAction = async () => {
    if (!createdOrder) {
      await createOrder()
    } else if (!signature) {
      await signOrder()
    }
  }

  const isActionDisabled = () => {
    return (
      !fromToken ||
      !toToken ||
      !fromAmount ||
      parseFloat(fromAmount) <= 0 ||
      !!validationError ||
      loading ||
      signing ||
      (createdOrder && signature && !filledOrder)
    )
  }

  const getActionButtonText = () => {
    if (loading) return 'Processing...'
    if (signing) return 'Please sign in wallet...'
    if (validationError) return validationError
    if (!fromToken || !toToken) return 'Select tokens'
    if (!fromAmount || parseFloat(fromAmount) <= 0) return 'Enter amount'
    if (filledOrder) return 'Order Completed'
    if (signature) return 'Order Signed'
    if (createdOrder) return 'Sign Order'
    return 'Create Order'
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

        {/* Status Display */}
        {createdOrder && !signature && (
          <div className="text-sm text-green-500 bg-green-50 dark:bg-green-900/20 p-2 rounded">
            Order created successfully. Please sign the order.
          </div>
        )}
        {signature && !filledOrder && (
          <div className="text-sm text-green-500 bg-green-50 dark:bg-green-900/20 p-2 rounded">
            Order signed successfully. Awaiting fill confirmation.
          </div>
        )}
        {filledOrder && (
          <div className="text-sm text-green-500 bg-green-50 dark:bg-green-900/20 p-2 rounded">
            Order filled successfully!
          </div>
        )}
        {validationError && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            {validationError}
          </div>
        )}

        {/* Action Button */}
        <Button 
          className="w-full" 
          onClick={handleAction}
          disabled={isActionDisabled()}
        >
          {getActionButtonText()}
        </Button>
      </CardContent>
    </Card>
  )
}