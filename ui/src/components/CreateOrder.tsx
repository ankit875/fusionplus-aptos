'use client'

import React, { useState } from 'react'

interface OrderPayload {
  maker: string
  makingAmount: string
  takingAmount: string
  makerAsset: string
  takerAsset: string
  srcChainId: number
  dstChainId: number
  secret: string
}

interface ApiResponse {
  success?: boolean
  message?: string
  data?: any
}

interface CreatedOrder {
  // This will be the order object returned from createOrder API
  // Replace with actual structure from your API
  id?: string
  order: any
  extension: string
  typedData?: {
    domain: any
    types: { [key: string]: any }
    primaryType: string
    message: any
  }
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      isMetaMask?: boolean
    }
  }
}

export const CreateOrderComponent = () => {
  const [loading, setLoading] = useState<boolean>(false)
  const [signing, setSigning] = useState<boolean>(false)
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)
  const [filledOrder, setFilledOrder] = useState<any>(null)

  const [signature, setSignature] = useState<string | null>(null)
  const [walletConnected, setWalletConnected] = useState<boolean>(false)
  const [userAddress, setUserAddress] = useState<string | null>(null)

  const orderPayload: OrderPayload = {
    maker: userAddress || '0xAF8AE7A70f3E0158d4587B642E6d60c9Da8Faa1D',
    makingAmount: '1000000',
    takingAmount: '1000000',
    makerAsset: '0x51B6c8FAb037fBf365CF43A02c953F2305e70bb4',
    takerAsset: '0x0000000000000000000000000000000000000000',
    srcChainId: 11155111,
    dstChainId: 8453,
    secret: 'my_secret_password_for_swap_test',
  }

  // Connect wallet function
  const connectWallet = async (): Promise<void> => {
    try {
      if (!window.ethereum) {
        setError('MetaMask is not installed. Please install MetaMask to continue.')
        return
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      if (accounts.length > 0) {
        console.log('Connected accounts:', accounts)
        setUserAddress(accounts[0])
        setWalletConnected(true)
        setError(null)
      }
    } catch (err) {
      setError(`Failed to connect wallet: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // Step 1: Create Order
  const createOrder = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    setResponse(null)
    setCreatedOrder(null)

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
        console.log('in response oka', { data })
        setCreatedOrder(data)
        setResponse({
          success: true,
          message: 'Order created successfully',
          data: data,
        })
      } else {
        setError(`API Error: ${response.status} - ${data.message || 'Unknown error'}`)
      }
    } catch (err) {
      setError(
        `Network Error: ${err instanceof Error ? err.message : 'Failed to connect to server'}`
      )
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Sign Order using EIP-712
  const signOrder = async (): Promise<void> => {
    if (!window.ethereum) {
      setError('Wallet not available')
      return
    }

    if (!userAddress) {
      setError('Wallet not connected')
      return
    }

    if (!createdOrder || !createdOrder.typedData) {
      setError('No order to sign. Please create an order first.')
      return
    }

    setSigning(true)
    setError(null)
    setSignature(null)

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

      setSignature(signature)
    } catch (err) {
      setError(`Failed to sign order: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSigning(false)
    }
  }

  const fillOrder = async () => {
    if (!window.ethereum) {
      setError('Wallet not available')
      return
    }

    if (!userAddress) {
      setError('Wallet not connected')
      return
    }

    if (!createdOrder || !createdOrder.typedData) {
      setError('No order to sign. Please create an order first.')
      return
    }
    if (!signature) {
      setError('Signature not found, sign the order first')
      return
    }

    try {
      const response = await fetch('http://localhost:3002/relayer/fillOrder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: createdOrder.order,
          extension: createdOrder.extension,
          signature,
          srcChainId: 11155111,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        console.log('in response oka', { data })
        setFilledOrder(data)
        setResponse({
          success: true,
          message: 'Order filled successfully',
          data: data,
        })
      } else {
        setError(`API Error: ${response.status} - ${data.message || 'Unknown error'}`)
      }
    } catch (err) {
      setError(
        `Network Error: ${err instanceof Error ? err.message : 'Failed to connect to server'}`
      )
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Announce Order (if needed)
  const announceOrder = async (): Promise<void> => {
    if (!signature || !createdOrder) {
      setError('Order must be created and signed before announcing')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:3000/relayer/announceOrder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...orderPayload,
          orderId: createdOrder.id,
          signature: signature,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setResponse({
          success: true,
          message: 'Order announced successfully',
          data: data,
        })
      } else {
        setError(`API Error: ${response.status} - ${data.message || 'Unknown error'}`)
      }
    } catch (err) {
      setError(
        `Network Error: ${err instanceof Error ? err.message : 'Failed to connect to server'}`
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">1inch Fusion+ Order Flow</h2>

      {/* Wallet Connection */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        {!walletConnected ? (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-blue-800">Step 1: Connect Wallet</h3>
            <button
              onClick={connectWallet}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Connect MetaMask
            </button>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold mb-2 text-blue-800">✅ Wallet Connected</h3>
            <p className="text-blue-700 text-sm font-mono">{userAddress}</p>
          </div>
        )}
      </div>

      {/* Order Details Display */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3 text-gray-700">Order Details:</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Maker:</span>{' '}
            <span className="font-mono">{orderPayload.maker}</span>
          </div>
          <div>
            <span className="font-medium">Making Amount:</span> {orderPayload.makingAmount}
          </div>
          <div>
            <span className="font-medium">Taking Amount:</span> {orderPayload.takingAmount}
          </div>
          <div>
            <span className="font-medium">Maker Asset:</span>{' '}
            <span className="font-mono">{orderPayload.makerAsset}</span>
          </div>
          <div>
            <span className="font-medium">Taker Asset:</span>{' '}
            <span className="font-mono">{orderPayload.takerAsset}</span>
          </div>
          <div>
            <span className="font-medium">Source Chain ID:</span> {orderPayload.srcChainId}
          </div>
          <div>
            <span className="font-medium">Destination Chain ID:</span> {orderPayload.dstChainId}
          </div>
          <div>
            <span className="font-medium">Secret:</span> {orderPayload.secret}
          </div>
        </div>
      </div>

      {/* Step 2: Create Order */}
      <div className="mb-4">
        <button
          onClick={createOrder}
          disabled={!walletConnected || loading || !!createdOrder}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
            !walletConnected || loading || !!createdOrder
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 active:bg-green-800'
          }`}
        >
          {loading
            ? 'Creating Order...'
            : createdOrder
              ? '✅ Order Created'
              : 'Step 2: Create Order'}
        </button>
      </div>

      {/* Created Order Display */}
      {createdOrder && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="text-green-800 font-semibold mb-2">✅ Order Created</h4>
          <div className="text-sm text-green-700">
            {createdOrder.id && (
              <p>
                <span className="font-medium">Order ID:</span> {createdOrder.id}
              </p>
            )}
            <p>Order is ready to be signed</p>
          </div>
        </div>
      )}

      {/* Step 3: Sign Order */}
      <div className="mb-4">
        <button
          onClick={signOrder}
          disabled={!createdOrder || signing || !!signature}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
            !createdOrder || signing || !!signature
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
          }`}
        >
          {signing
            ? 'Please sign in wallet...'
            : signature
              ? '✅ Order Signed'
              : 'Step 3: Sign Order (EIP-712)'}
        </button>
      </div>

      {/* Signature Display */}
      {signature && (
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 className="text-purple-800 font-semibold mb-2">✅ Order Signed</h4>
          <p className="text-sm text-purple-700 mb-2">EIP-712 Signature:</p>
          <div className="bg-purple-100 p-3 rounded text-xs font-mono break-all">{signature}</div>
        </div>
      )}

      {/* Step 4: Announce Order (Optional) */}
      <div className="mb-4">
        <button
          onClick={fillOrder}
          disabled={!signature || loading}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
            !signature || loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'
          }`}
        >
          {loading ? 'Fill Order...' : 'Step 4: Fill Order (Optional)'}
        </button>
      </div>

      {!createdOrder && walletConnected && (
        <p className="text-sm text-gray-600 mt-2 text-center">
          Create an order first to proceed with signing
        </p>
      )}

      {createdOrder && !signature && (
        <p className="text-sm text-gray-600 mt-2 text-center">
          Sign the created order before announcing
        </p>
      )}

      {/* Success Response */}
      {response && response.success && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="text-green-800 font-semibold">✅ Success</h4>
          <p className="text-green-700 mt-1">{response.message}</p>
          {response.data && (
            <pre className="mt-2 text-xs bg-green-100 p-2 rounded overflow-x-auto">
              {JSON.stringify(response.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="text-red-800 font-semibold">❌ Error</h4>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}
    </div>
  )
}
