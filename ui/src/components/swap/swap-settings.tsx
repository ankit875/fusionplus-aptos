'use client'

import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { useSwapStore } from '@/store/swap-store'

export function SwapSettings() {
  const { slippage, setSlippage } = useSwapStore()

  const slippagePresets = [0.1, 0.5, 1.0, 3.0]

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Slippage Tolerance</Label>
        <div className="flex space-x-2">
          {slippagePresets.map((preset) => (
            <button
              key={preset}
              onClick={() => setSlippage(preset)}
              className={`px-3 py-1 text-xs rounded border ${
                slippage === preset
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background border-input hover:bg-accent'
              }`}
            >
              {preset}%
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <Slider
            value={[slippage]}
            onValueChange={(value) => setSlippage(value[0])}
            max={5}
            min={0.1}
            step={0.1}
            className="w-full"
          />
          <div className="text-center text-xs text-muted-foreground">
            {slippage}%
          </div>
        </div>
      </div>
    </div>
  )
}
