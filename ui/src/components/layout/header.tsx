'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from '@/components/ui/button'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

export function Header() {
  const { connect, disconnect, connected, wallets, account } = useWallet()
  const [copied, setCopied] = useState(false)

  const handleCopyAddress = async () => {
    if (account?.address) {
      try {
        await navigator.clipboard.writeText(account.address)
        setCopied(true)
        toast.success('Address copied to clipboard!')
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        toast.error('Failed to copy address')
      }
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }
  return (
    <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="flex items-center space-x-4">
        <h1 className="text-2xl font-bold text-primary">8inch</h1>
        <span className="text-sm text-muted-foreground">Cross-Chain Swap</span>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* EVM Wallet Connection */}
        <ConnectButton />
        
        {/* Aptos Wallet Connection */}
        {connected ? (
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2">
              <div className="flex items-center">
                <select 
                  className="text-xs bg-transparent border-none outline-none text-muted-foreground"
                  value={wallets?.find(wallet => wallet.name === 'Petra')?.name || 'Petra'}
                  onChange={(e) => {
                    const selectedWallet = wallets?.find(wallet => wallet.name === e.target.value);
                    if (selectedWallet) {
                      disconnect();
                      setTimeout(() => connect(selectedWallet.name), 100);
                    }
                  }}
                >
                  {wallets?.map((wallet) => (
                    <option key={wallet.name} value={wallet.name}>
                      {wallet.name}
                    </option>
                  ))}
                </select>
              </div>
                
                {account?.address && (
                  <div className="flex items-center space-x-1">
                    <span className="text-sm font-mono">
                      {formatAddress(account.address)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={handleCopyAddress}
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
              >
                Disconnect
              </Button>
            </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (wallets && wallets.length > 0) {
                connect(wallets[1].name);
              }
            }}
          >
            Connect Aptos
          </Button>
        )}
      </div>
    </header>
  )
}
