import { SwapInterface } from '@/components/swap/swap-interface'
import { Header } from '@/components/layout/header'
import { CreateOrderComponent } from '@/components/CreateOrder'

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <Header />
      <div className="mt-8 flex justify-center">
        <SwapInterface />
         {/* <CreateOrderComponent /> */}
      </div>
    </main>
  )
}
