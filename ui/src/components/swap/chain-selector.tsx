'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { CHAINS } from '@/lib/tokens'
import Image from 'next/image'

interface ChainSelectorProps {
  selectedChain: number
  onChainSelect: (chainId: number) => void
}

export function ChainSelector({ selectedChain, onChainSelect }: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedChainData = CHAINS.find(chain => chain.id === selectedChain)

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2"
      >
        {selectedChainData ? (
          <>
            {selectedChainData.logoURI && (
              <Image
                src={selectedChainData.logoURI}
                alt={selectedChainData.name}
                className="w-5 h-5 rounded-full"
                width={20}
                height={20}
              />
            )}
            <span>{selectedChainData.symbol}</span>
          </>
        ) : (
          <span>Select Chain</span>
        )}
        <ChevronDown className="w-4 h-4" />
      </Button>

      {isOpen && (
        <div className="absolute top-full mt-1 right-0 z-10 bg-white dark:bg-gray-800 border rounded-lg shadow-lg min-w-[150px]">
          {CHAINS.map((chain) => (
            <button
              key={chain.id}
              onClick={() => {
                onChainSelect(chain.id)
                setIsOpen(false)
              }}
              className="w-full flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
            >
              {chain.logoURI && (
                <Image
                  src={chain.logoURI}
                  alt={chain.name}
                  className="w-5 h-5 rounded-full"
                  width={20}
                  height={20}
                />
              )}
              <span>{chain.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
