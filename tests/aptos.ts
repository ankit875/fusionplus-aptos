import { AptosAccount, AptosClient, TxnBuilderTypes, BCS } from "aptos";
import * as dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const NODE = "https://fullnode.testnet.aptoslabs.com/v1";
const MODULE_ADDRESS = "0x6a33e62028e210d895c22c631c17c856cf774c887785357672636db8530e6226";

const privateKey = process.env.PRIVKEY
const address = process.env.ADDR
console.log({ privateKey, address })

// Use the SAME private key you used with the CLI
const account = AptosAccount.fromAptosAccountObject({
  privateKeyHex: process.env.PRIVKEY as string,
  address: process.env.ADDR as string,
});

export const userAccount = AptosAccount.fromAptosAccountObject({
  privateKeyHex: process.env.USER_PRIVKEY as string,
  address: process.env.USER_ADDR as string,
});

const client = new AptosClient(NODE);

// ✅ ADDED: Get next available order ID for accurate predictions
async function getNextOrderId(): Promise<number> {
  try {
    let counter = 0;

    while (counter < 5000) { // Safety limit
      try {
        await client.view({
          function: `${MODULE_ADDRESS}::swap_v3::get_order_details`,
          type_arguments: [],
          arguments: [counter.toString()],
        });
        counter++;
      } catch (error: any) {
        if (error.message.includes("EORDER_DOES_NOT_EXIST")) {
          console.log(`📋 Next available order ID: ${counter}`);
          return counter;
        } else {
          console.log("Error checking order:", error.message);
          break;
        }
      }
    }

    console.log("Could not determine next order ID, using fallback");
    return counter;
  } catch (error: any) {
    console.log("Could not get next order ID, assuming 0:", error.message);
    return 0;
  }
}

// ✅ ADDED: Get order details for debugging
async function getOrderDetails(orderId: number): Promise<any> {
  try {
    const orderDetails = await client.view({
      function: `${MODULE_ADDRESS}::swap_v3::get_order_details`,
      type_arguments: [],
      arguments: [orderId.toString()],
    });
    return orderDetails;
  } catch (error: any) {
    console.log(`❌ Cannot get order ${orderId} details:`, error.message);
    return null;
  }
}

// ✅ ENHANCED: Better error handling and success tracking
async function signAndSubmit(payload: any, description?: string, acc?: AptosAccount): Promise<boolean> {
  try {
    if (description) {
      console.log(`📤 ${description}...`);
    }

    let aptosAccount = acc ?? account;

    console.log("payload", payload);
    const rawTxn = await client.generateTransaction(aptosAccount.address(), payload);
    console.log("rawTxn", rawTxn.payload);
    const bcsTxn = AptosClient.generateBCSTransaction(aptosAccount, rawTxn);
    const pending = await client.submitSignedBCSTransaction(bcsTxn);
    console.log("pending", pending);

    await client.waitForTransaction(pending.hash);

    // ✅ ADDED: Check transaction success
    const transaction: any = await client.getTransactionByHash(pending.hash);

    if (transaction.success) {
      console.log("✅ Success!");
      console.log("🔗 Explorer:", `https://explorer.aptoslabs.com/txn/${pending.hash}?network=testnet`);
      return true;
    } else {
      console.log("❌ Failed:", transaction.vm_status);
      return false;
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return false;
  }
}

async function getBalance() {
  try {
    console.log("🔍 Checking address:", MODULE_ADDRESS);

    // Check if account exists
    const accountInfo = await client.getAccount(MODULE_ADDRESS);
    console.log("✅ Account exists! Sequence number:", accountInfo.sequence_number, accountInfo);

    // Alternative: Check account balance using view function
    try {
      const [balance] = await client.view({
        function: "0x1::coin::balance",
        type_arguments: ["0x1::aptos_coin::AptosCoin"],
        arguments: [MODULE_ADDRESS],
      });
      console.log("✅ APT Balance (View function):", balance, "octas");
      console.log("✅ APT Balance (View function):", (Number(balance) / 100000000).toFixed(8), "APT");
    } catch (viewError: any) {
      console.log("ℹ️  View function returned error (likely no balance):", viewError.message);
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

async function check_token_initialized() {
  try {
    const resource = await client.getAccountResource(
      `${MODULE_ADDRESS}`,
      `${MODULE_ADDRESS}::my_token::Capabilities`
    );
    console.log("✅ Token is initialized:", resource);
    return true;
  } catch (error) {
    console.log("❌ Token not initialized yet");
    return false;
  }
}

// Register account to hold the token
async function register_token() {
  const payload = {
    type: "entry_function_payload",
    function: `${MODULE_ADDRESS}::my_token::register`,
    type_arguments: [],
    arguments: [],
  };

  console.log("📝 Registering account for token...");
  return await signAndSubmit(payload, "Registering token");
}

// Mint tokens to your account
async function mint_tokens() {
  const amount = "1000000000"; // 10 tokens with 8 decimals

  const payload = {
    type: "entry_function_payload",
    function: `${MODULE_ADDRESS}::my_token::mint`,
    type_arguments: [],
    arguments: [
      account.address().hex(), // to: address
      amount                   // amount: u64
    ],
  };

  console.log("💰 Minting tokens...");
  return await signAndSubmit(payload, "Minting tokens");
}

async function checkTokenBalance() {
  console.log("🏦 Checking current token balance...");
  const FUNGIBLE_STORE_ADDRESS = "0xc0dd53845349ec6de0d6bb410a45e4eddfe80161bceb60fe4bcd551ae5aa3133";

  try {
    const resources = await client.getAccountResources(FUNGIBLE_STORE_ADDRESS);
    const fungibleStore = resources.find(r => r.type.includes('fungible_asset::FungibleStore'));

    if (fungibleStore) {
      const balance = (fungibleStore.data as any)?.balance || '0';
      console.log("✅ Current balance:", balance, "units");
      console.log("✅ Current balance:", (Number(balance) / 100000000).toFixed(8), "tokens");
      return balance;
    } else {
      console.log("❌ No fungible store found");
      return "0";
    }
  } catch (error: any) {
    console.error("❌ Error checking balance:", error.message);
    return "0";
  }
}
// ✅ ENHANCED: Initialize swap ledger with dynamic coin type
async function initialize_swap_ledger() {
  const SRC_COIN_TYPE =
    `${MODULE_ADDRESS}::my_token::SimpleToken`;

  const payload = {
    type: "entry_function_payload",
    function:
      `${MODULE_ADDRESS}::swap_v3::initialize_swap_ledger`,
    type_arguments: [SRC_COIN_TYPE],
    arguments: [],
  };
  return await signAndSubmit(payload, "Initializing swap ledger");
}

// ✅ ENHANCED: With order ID prediction
async function anounce_order() {
  const SRC_COIN_TYPE =
    `${MODULE_ADDRESS}::my_token::SimpleToken`;
  const srcAmount = 1e8;
  const minDstAmount = 1e8;
  const expiresInSecs = 3_600; // 1 hour

  const stringBytes = ethers.toUtf8Bytes("my_secret_password_for_swap_test");
  const secretHashHex = hexToUint8Array(ethers.keccak256(stringBytes));

  // ✅ ADDED: Predict order ID
  const nextOrderId = await getNextOrderId();
  console.log(`📋 announce_order will create order ID: ${nextOrderId}`);

  const payload = {
    type: "entry_function_payload",
    function: `${MODULE_ADDRESS}::swap_v3::announce_order`,
    type_arguments: [SRC_COIN_TYPE],
    arguments: [
      srcAmount.toString(),
      minDstAmount.toString(),
      expiresInSecs.toString(),
      secretHashHex,
    ],
  };

  const success = await signAndSubmit(payload, "Announcing order");

  if (success) {
    console.log(`✅ Order ${nextOrderId} announced successfully`);
    return nextOrderId;
  } else {
    console.log("❌ Failed to announce order");
    return -1;
  }
}

// ✅ ENHANCED: With order ID prediction
async function fund_dst_escrow() {
  const SRC_COIN_TYPE =
    `${MODULE_ADDRESS}::my_token::SimpleToken`;

  const dst_amount = 1e8;
  const expiration_duration_secs = Math.floor(Date.now() / 1000) + 3600;
  const secret = ethers.toUtf8Bytes("my_secret_password_for_swap_test");
  const secret_hash = hexToUint8Array(ethers.keccak256(secret));

  // ✅ ADDED: Predict order ID
  const nextOrderId = await getNextOrderId();
  console.log(`📋 fund_dst_escrow will create order ID: ${nextOrderId}`);

  const payload = {
    type: "entry_function_payload",
    function:
      `${MODULE_ADDRESS}::swap_v3::fund_dst_escrow`,
    type_arguments: [SRC_COIN_TYPE],
    arguments: [
      dst_amount.toString(),
      expiration_duration_secs.toString(),
      secret_hash,
    ],
  };

  const success = await signAndSubmit(payload, "Funding destination escrow");

  if (success) {
    console.log(`✅ Order ${nextOrderId} funded successfully`);
    return nextOrderId;
  } else {
    console.log("❌ Failed to fund destination escrow");
    return -1;
  }
}

// ✅ ENHANCED: Dynamic order ID and better error handling
async function claim_funds(orderId: number, account?: AptosAccount) {
  const SRC_COIN_TYPE =
    `${MODULE_ADDRESS}::my_token::SimpleToken`;

  const secret = ethers.toUtf8Bytes("my_secret_password_for_swap_test");

  console.log(`📋 Attempting to claim from order ID: ${orderId}`);

  // ✅ ADDED: Show order details before claiming
  const orderDetails = await getOrderDetails(orderId);
  if (orderDetails) {
    console.log("📋 Order details:", JSON.stringify(orderDetails, null, 2));
  }

  const payload = {
    type: "entry_function_payload",
    function:
      `${MODULE_ADDRESS}::swap_v3::claim_funds`,
    type_arguments: [SRC_COIN_TYPE],
    arguments: [orderId.toString(), secret],
  };

  return await signAndSubmit(payload, `Claiming funds from order ${orderId}`, account);
}

// ✅ ENHANCED: Dynamic order ID and better error handling
async function cancel_swap(orderId: number) {
  const SRC_COIN_TYPE =
    `${MODULE_ADDRESS}::my_token::SimpleToken`;

  console.log(`📋 Attempting to cancel order ID: ${orderId}`);

  // ✅ ADDED: Show order details before cancelling
  const orderDetails = await getOrderDetails(orderId);
  if (orderDetails) {
    console.log("📋 Order details:", JSON.stringify(orderDetails, null, 2));
  }

  const payload = {
    type: "entry_function_payload",
    function:
      `${MODULE_ADDRESS}::swap_v3::cancel_swap`,
    type_arguments: [SRC_COIN_TYPE],
    arguments: [orderId.toString()],
  };

  const success = await signAndSubmit(payload, `Cancelling order ${orderId}`);

  if (!success) {
    console.log("❌ Cancel swap failed - possible reasons:");
    console.log("  - Order hasn't expired yet (check expiration_timestamp_secs)");
    console.log("  - You're not the original maker (check maker_address)");
    console.log("  - Order has already been completed or cancelled (check revealed_secret)");
    console.log("  - Wrong coin type");
  }

  return success;
}

// ✅ ADDED: Complete flow test
async function testCompleteFlow() {
  console.log("\n🧪 TESTING COMPLETE SWAP FLOW");
  console.log("=".repeat(60));

  // Step 1: Announce order
  console.log("\n🎯 Step 1: Announce Order");
  const announceOrderId = await anounce_order();
  if (announceOrderId === -1) {
    console.log("❌ Failed at announce order");
    return;
  }

  // Step 2: Fund destination escrow
  console.log("\n🎯 Step 2: Fund Destination Escrow");
  const fundOrderId = await fund_dst_escrow();
  if (fundOrderId === -1) {
    console.log("❌ Failed at fund destination escrow");
    return;
  }

  // Step 3: Claim funds
  console.log("\n🎯 Step 3: Claim Funds");
  const claimSuccess = await claim_funds(fundOrderId);

  if (claimSuccess) {
    console.log("\n🎉 SUCCESS! COMPLETE FLOW WORKED!");
    console.log(`✅ announce_order created order ID: ${announceOrderId}`);
    console.log(`✅ fund_dst_escrow created order ID: ${fundOrderId}`);
    console.log(`✅ claim_funds successfully claimed from order ID: ${fundOrderId}`);

    // Step 4: Test cancel on announce order (optional)
    console.log("\n🎯 Step 4: Test Cancel Swap (on announce order)");
    console.log("⚠️  Note: This might fail if the order hasn't expired yet");
    await cancel_swap(announceOrderId);

  } else {
    console.log("\n❌ CLAIM FAILED");
    console.log("📋 Debugging info:");
    console.log(`- Announce order ID: ${announceOrderId}`);
    console.log(`- Fund order ID: ${fundOrderId}`);
    console.log(`- Attempted claim order ID: ${fundOrderId}`);
  }
}

// ✅ ADDED: Command line interface
async function main() {
  // Setup functions
  // await getBalance();
  // await check_token_initialized();
  // await register_token();
  // await mint_tokens();
  // await checkTokenBalance();
  // await initialize_swap_ledger();

  // Swap functions
  // await anounce_order();
  // await fund_dst_escrow();

  // Dynamic functions with order IDs
  // await claim_funds(24); // Replace 8 with your order ID
  // await cancel_swap(23); // Replace 7 with your order ID
  // await getOrderDetails(5); // Replace 5 with your order ID

  // Utility functions
  // await getNextOrderId();

  // Complete flow test
  // await testCompleteFlow();

  // 🎯 YOUR CURRENT SELECTION:
  // await fund_dst_escrow();
}

// Run the script
// main().catch(console.error);

function hexToUint8Array(hex: string): Uint8Array {
  if (hex.startsWith("0x")) {
    hex = hex.substring(2);
  }
  if (hex.length % 2 !== 0) {
    throw new Error(
      "Hex string must have an even number of characters for byte conversion."
    );
  }
  const byteArray = new Uint8Array(hex.length / 2);
  for (let i = 0; i < byteArray.length; i++) {
    byteArray[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return byteArray;
}

export {
  fund_dst_escrow,
  claim_funds,
  cancel_swap,
  anounce_order,
  initialize_swap_ledger,
  getOrderDetails,
  getNextOrderId,
  testCompleteFlow
}
