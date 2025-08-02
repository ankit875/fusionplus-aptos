'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { Token } from '@/store/swap-store'
import { TOKENS_BY_CHAIN } from '@/lib/tokens'
import { useTokenBalance } from '@/hooks/use-token-balance'
import Image from 'next/image'

interface TokenSelectorProps {
  selectedToken: Token | null
  onTokenSelect: (token: Token) => void
  chainId: number
}

function TokenOption({ token, onSelect }: { token: Token; onSelect: () => void }) {
  const { formattedBalance, isLoading } = useTokenBalance(token)
  
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
    >
      <div className="flex items-center space-x-3">
        {/* {token.logoURI && (
          <Image
            src={token.logoURI}
            alt={token.symbol}
            className="w-6 h-6 rounded-full"
            width={24}
            height={24}
          />
        )} */}
        <div className="flex flex-col items-start">
          <span className="font-medium">{token.symbol}</span>
          <span className="text-xs text-muted-foreground">{token.name}</span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-sm font-medium">
          {isLoading ? '...' : formattedBalance}
        </span>
        <span className="text-xs text-muted-foreground">Balance</span>
      </div>
    </button>
  )
}

export function TokenSelector({ selectedToken, onTokenSelect, chainId }: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const tokens = TOKENS_BY_CHAIN[chainId] || []

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 min-w-[140px] justify-between"
      >
        <div className="flex items-center space-x-2">
          {selectedToken ? (
            <>
              {/* {selectedToken.logoURI && (
                <Image
                  src={selectedToken.logoURI}
                  alt={selectedToken.symbol}
                  className="w-5 h-5 rounded-full"
                  width={20}
                  height={20}
                />
              )} */}
              <span>{selectedToken.symbol}</span>
            </>
          ) : (
            <span>Select Token</span>
          )}
        </div>
        <ChevronDown className="w-4 h-4" />
      </Button>

      {isOpen && (
        <div className="absolute top-full mt-1 right-0 z-10 bg-white dark:bg-gray-800 border rounded-lg shadow-lg min-w-[280px] max-h-[300px] overflow-y-auto">
          {tokens.length > 0 ? (
            tokens.map((token) => (
              <TokenOption
                key={token.address}
                token={token}
                onSelect={() => {
                  onTokenSelect(token)
                  setIsOpen(false)
                }}
              />
            ))
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              No tokens available for this chain
            </div>
          )}
        </div>
      )}
    </div>
  )
}
