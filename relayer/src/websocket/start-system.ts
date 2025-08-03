import RelayerWebSocketServer from './ws-relayer-server';
import ResolverWebSocketServer from './ws-resolver-server';
import { CrossChainSwapClient } from './ws-client-sdk';

async function startSystem() {
  console.log('🚀 Starting Cross-Chain Swap WebSocket System...\n');

  // Start Relayer
  console.log('📡 Starting Relayer...');
  const relayer = new RelayerWebSocketServer(8080);
  relayer.start();
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start Resolver  
  console.log('🔧 Starting Resolver...');
  const resolver = new ResolverWebSocketServer(8082, 'ws://localhost:8080');
  resolver.start();
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test client
  console.log('🧪 Starting Test Client...');
  const client = new CrossChainSwapClient('ws://localhost:8080');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n✅ System Started Successfully!');
  console.log('📊 Relayer Dashboard: http://localhost:8080/health');
  console.log('🔧 Resolver Dashboard: http://localhost:8082/health');
  console.log('🌐 WebSocket URL: ws://localhost:8080\n');

  // Run test after startup
  setTimeout(async () => {
    try {
      console.log('🧪 Running test swap...');
      
      const quote = await client.getQuote(
        'ETH::1',
        'APTOS::1', 
        '0x8EB8a3b98659Cce290402893d0123abb75E3ab28',
        '0x1::coin::USDC',
        '1000000000000000000'
      );
      console.log('✅ Test quote received:', {
        srcAmount: quote.srcAmount,
        dstAmount: quote.dstAmount,
        rate: quote.exchangeRate
      });

      const order = await client.createOrder({
        maker: '0x1234567890123456789012345678901234567890',
        makingAmount: '1000000000000000000',
        takingAmount: quote.dstAmount,
        makerAsset: quote.srcTokenAddress,
        takerAsset: quote.dstTokenAddress,
        receiver: 'aptos_receiver_address',
        secret: 'my_secret_password_for_swap_test',
        srcChainId: 'ETH::1',
        dstChainId: 'APTOS::1'
      });
      console.log('✅ Test order created:', order.orderHash);

    } catch (error) {
      console.log('⚠️  Test error (expected in demo mode):', error.message);
    }
  }, 5000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down system...');
    client.close();
    resolver.stop();
    relayer.stop();
    process.exit(0);
  });
}

startSystem().catch(console.error);