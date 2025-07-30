import { SwapInterface } from '@/components/swap/swap-interface'
import { Header } from '@/components/layout/header'

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <Header />
      <div className="mt-8 flex justify-center">
        <SwapInterface />
      </div>
    </main>
  )
}
