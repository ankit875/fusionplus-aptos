import { CrossChainSwapClient } from './ws-client-sdk';

async function testClient() {
  console.log('🧪 Starting WebSocket Test Client...\n');

  const client = new CrossChainSwapClient('ws://localhost:8080');

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Test 1: Ping
    console.log('1️⃣ Testing ping...');
    const pong = await client.ping();
    console.log('✅ Pong received:', pong.timestamp);

    // Test 2: Get Quote
    console.log('\n2️⃣ Testing quote...');
    const quote = await client.getQuote(
      'ETH::1',
      'APTOS::1',
      '0x8EB8a3b98659Cce290402893d0123abb75E3ab28', // WETH
      '0x1::coin::USDC', // USDC on Aptos
      '1000000000000000000' // 1 ETH
    );
    console.log('✅ Quote received:');
    console.log(`   📊 ${quote.srcAmount} WETH → ${quote.dstAmount} USDC`);
    console.log(`   💱 Rate: ${quote.exchangeRate}`);
    console.log(`   ⏰ Valid until: ${quote.validUntil}`);

    // Test 3: Create Order
    console.log('\n3️⃣ Testing order creation...');
    const order = await client.createOrder({
      maker: '0x1234567890123456789012345678901234567890',
      makingAmount: quote.srcAmount,
      takingAmount: quote.dstAmount,
      makerAsset: quote.srcTokenAddress,
      takerAsset: quote.dstTokenAddress,
      receiver: 'aptos_receiver_address_here',
      secret: 'my_secret_password_for_swap_test',
      srcChainId: quote.srcChainId,
      dstChainId: quote.dstChainId
    });
    console.log('✅ Order created:');
    console.log(`   🆔 Hash: ${order.orderHash}`);
    console.log(`   📊 Status: ${order.status}`);

    // Test 4: Get Active Orders
    console.log('\n4️⃣ Testing active orders...');
    const activeOrders = await client.getActiveOrders();
    console.log('✅ Active orders:', activeOrders.total);
    if (activeOrders.orders.length > 0) {
      console.log(`   📋 Latest order: ${activeOrders.orders[0].orderHash}`);
    }

    console.log('\n🎉 All tests passed! System is working correctly.\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  // Keep client alive to receive events
  console.log('👂 Listening for order events... (Press Ctrl+C to exit)\n');
  
  client.wsApi.order.onOrderCreated((data) => {
    console.log('📢 Order Created Event:', data.orderHash);
  });

  client.wsApi.order.onOrderFilled((data) => {
    console.log('📢 Order Filled Event:', data.orderHash);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down test client...');
    client.close();
    process.exit(0);
  });
}

testClient().catch(console.error);