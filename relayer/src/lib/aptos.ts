import { AptosAccount, AptosClient } from "aptos";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const NODE = process.env.DESTINATION_NODE 
const MODULE_ADDRESS = process.env.MODULE_ADDRESS;

let account: AptosAccount | null = null;
let userAccount: AptosAccount | null = null;

if (process.env.PRIVKEY && process.env.ADDR) {
  try {
    account = AptosAccount.fromAptosAccountObject({
      privateKeyHex: process.env.PRIVKEY as string,
      address: process.env.ADDR as string,
    });
  } catch (error) {
    console.error("Failed to create account:", error);
  }
}

if (process.env.USER_PRIVKEY && process.env.USER_ADDR) {
  try {
    userAccount = AptosAccount.fromAptosAccountObject({
      privateKeyHex: process.env.USER_PRIVKEY as string,
      address: process.env.USER_ADDR as string,
    });
  } catch (error) {
    console.error("Failed to create userAccount:", error);
  }
}

const client = new AptosClient(NODE);

type FundSrcEscrowParams = {
  srcAmount: number;
  minDstAmount: number;
  expiresInSecs: number;
  secretHashHex: Uint8Array;
  signature: string;
  resolverAccount?: AptosAccount; 
};

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
          console.log(` Next available order ID: ${counter}`);
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

async function getOrderDetails(orderId: number): Promise<any> {
  try {
    const orderDetails = await client.view({
      function: `${MODULE_ADDRESS}::swap_v3::get_order_details`,
      type_arguments: [],
      arguments: [orderId.toString()],
    });
    return orderDetails;
  } catch (error: any) {
    console.log(` Cannot get order ${orderId} details:`, error.message);
    return null;
  }
}

async function signAndSubmit(payload: any, description?: string, acc?: AptosAccount): Promise<boolean> {
  try {
    if (description) {
      console.log(` ${description}...`);
    }

    let aptosAccount = acc ?? account;
    
    if (!aptosAccount) {
      console.error(" No Aptos account available. Please check your environment variables.");
      return false;
    }

    console.log("payload", payload);
    const rawTxn = await client.generateTransaction(aptosAccount.address(), payload);
    console.log("rawTxn", rawTxn.payload);
    const bcsTxn = AptosClient.generateBCSTransaction(aptosAccount, rawTxn);
    const pending = await client.submitSignedBCSTransaction(bcsTxn);
    console.log("pending", pending);

    await client.waitForTransaction(pending.hash);

    const transaction: any = await client.getTransactionByHash(pending.hash);

    if (transaction.success) {
      console.log("  Success!");
      console.log("🔗 Explorer:", `https://explorer.aptoslabs.com/txn/${pending.hash}?network=testnet`);
      return true;
    } else {
      console.log(" Failed:", transaction.vm_status);
      return false;
    }

  } catch (error: any) {
    console.error("Error:", error.message);
    return false;
  }
}

async function getBalance(module_address: string) {
  try {
    console.log("Checking address:", module_address);

    const accountInfo = await client.getAccount(module_address);
    console.log("  Account exists! Sequence number:", accountInfo.sequence_number, accountInfo);

    try {
      const [balance] = await client.view({
        function: "0x1::coin::balance",
        type_arguments: [process.env.TOKEN_TYPE!],
        arguments: [module_address],
      });
      console.log("  APT Balance (View function):", balance, "octas");
      console.log("  APT Balance (View function):", (Number(balance) / 100000000).toFixed(8), "APT");
    } catch (viewError: any) {
      console.log("View function returned error (likely no balance):", viewError.message);
    }

  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

async function check_token_initialized() {
  try {
    const resource = await client.getAccountResource(
      `${MODULE_ADDRESS}`,
      `${MODULE_ADDRESS}::my_token::Capabilities`
    );
    console.log("  Token is initialized:", resource);
    return true;
  } catch (error) {
    console.log("Token not initialized yet");
    return false;
  }
}

async function register_token() {
  const payload = {
    type: "entry_function_payload",
    function: `${MODULE_ADDRESS}::my_token::register`,
    type_arguments: [],
    arguments: [],
  };

  console.log("Registering account for token...");
  return await signAndSubmit(payload, "Registering token");
}

async function mint_tokens() {
  if (!account) {
    console.error(" No account available for minting. Please check your environment variables.");
    return false;
  }

  const amount = "1000000000000000"; // 10 tokens with 8 decimals

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
  console.log(" Checking current token balance...");
  const FUNGIBLE_STORE_ADDRESS = "0xc0dd53845349ec6de0d6bb410a45e4eddfe80161bceb60fe4bcd551ae5aa3133";

  try {
    const resources = await client.getAccountResources(FUNGIBLE_STORE_ADDRESS);
    const fungibleStore = resources.find(r => r.type.includes('fungible_asset::FungibleStore'));

    if (fungibleStore) {
      const balance = (fungibleStore.data as any)?.balance || '0';
      console.log("  Current balance:", balance, "units");
      console.log("  Current balance:", (Number(balance) / 100000000).toFixed(8), "tokens");
      return balance;
    } else {
      console.log(" No fungible store found");
      return "0";
    }
  } catch (error: any) {
    console.error(" Error checking balance:", error.message);
    return "0";
  }
}
async function initialize_swap_ledger() {
  const SRC_COIN_TYPE =
    `${process.env.TOKEN_TYPE}`;

  const payload = {
    type: "entry_function_payload",
    function:
      `${MODULE_ADDRESS}::swap_v3::initialize_swap_ledger`,
    type_arguments: [SRC_COIN_TYPE],
    arguments: [],
  };
  return await signAndSubmit(payload, "Initializing swap ledger");
}

async function fund_src_escrow({srcAmount, minDstAmount, expiresInSecs, secretHashHex, signature, resolverAccount}: FundSrcEscrowParams) {
  const SRC_COIN_TYPE =
    `${process.env.TOKEN_TYPE}`;

  const nextOrderId = await getNextOrderId();
  console.log(` announce_order will create order ID: ${nextOrderId}`);

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

  const success = await signAndSubmit(payload, "Announcing order", resolverAccount);

  if (success) {
    console.log(` Order ${nextOrderId} announced successfully`);
    return nextOrderId;
  } else {
    console.log(" Failed to announce order");
    return -1;
  }
}

type FundDstEscrowParams = {cointype: string, dstAmount: number, duration: number, secret_hash: Uint8Array, recieverAddress: string }
//   ENHANCED: With order ID prediction
async function fund_dst_escrow({ cointype, dstAmount, duration, secret_hash,recieverAddress }: FundDstEscrowParams) {

  // const SRC_COIN_TYPE =
  //   `${MODULE_ADDRESS}::my_token::SimpleToken`;

  // const dst_amount = 1e8;
  // const expiration_duration_secs = Math.floor(Date.now() / 1000) + 3600;
  // const secret = ethers.toUtf8Bytes("my_secret_password_for_swap_test");
  // const secret_hash = hexToUint8Array(ethers.keccak256(secret));
  // //   ADDED: Predict order ID
  const nextOrderId = await getNextOrderId();
  console.log(` fund_dst_escrow will create order ID: ${nextOrderId}`);

  const payload = {
    type: "entry_function_payload",
    function:
      `${MODULE_ADDRESS}::swap_v3::fund_dst_escrow`,
    type_arguments: [cointype],
    arguments: [
      dstAmount.toString(),
      duration.toString(),
      secret_hash,
      recieverAddress,
    ],
  };

  const success = await signAndSubmit(payload, "Funding destination escrow");

  if (success) {
    console.log(`  Order  funded successfully`);
    return nextOrderId;
  } else {
    console.log("❌ Failed to fund destination escrow");
    return -1;
  }
  
}

async function claim_funds(orderId: number, secret: Uint8Array, account?: AptosAccount) {
  const SRC_COIN_TYPE =
    `${process.env.TOKEN_TYPE}`;


  console.log(`📋 Attempting to claim from order ID: ${orderId}`);

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

  return await signAndSubmit(payload, `Claiming funds from order ${orderId}`, account || userAccount || undefined);
}

async function cancel_swap(orderId: number) {
  const SRC_COIN_TYPE =
    `${MODULE_ADDRESS}::my_token::SimpleToken`;

  console.log(`📋 Attempting to cancel order ID: ${orderId}`);

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
    console.log("Cancel swap failed - possible reasons:");
    console.log("  - Order hasn't expired yet (check expiration_timestamp_secs)");
    console.log("  - You're not the original maker (check maker_address)");
    console.log("  - Order has already been completed or cancelled (check revealed_secret)");
    console.log("  - Wrong coin type");
  }

  return success;
}

async function testCompleteFlow() {
  console.log("\n🧪 TESTING COMPLETE SWAP FLOW");
  console.log("=".repeat(60));

  console.log("\n🎯 Step 1: Announce Order");
  const announceOrderId = await fund_src_esrcow();
  if (announceOrderId === -1) {
    console.log(" Failed at announce order");
    return;
  }

  console.log("\n🎯 Step 2: Fund Destination Escrow");
  const fundOrderId = await fund_dst_escrow();
  if (fundOrderId === -1) {
    console.log(" Failed at fund destination escrow");
    return;
  }

  console.log("\n🎯 Step 3: Claim Funds");
  const claimSuccess = await claim_funds(fundOrderId);

  if (claimSuccess) {
    console.log("\n🎉 SUCCESS! COMPLETE FLOW WORKED!");
    console.log(`  announce_order created order ID: ${announceOrderId}`);
    console.log(`  fund_dst_escrow created order ID: ${fundOrderId}`);
    console.log(`  claim_funds successfully claimed from order ID: ${fundOrderId}`);

    console.log("\n🎯 Step 4: Test Cancel Swap (on announce order)");
    console.log("  Note: This might fail if the order hasn't expired yet");
    await cancel_swap(announceOrderId);

  } else {
    console.log("\n CLAIM FAILED");
    console.log("📋 Debugging info:");
    console.log(`- Announce order ID: ${announceOrderId}`);
    console.log(`- Fund order ID: ${fundOrderId}`);
    console.log(`- Attempted claim order ID: ${fundOrderId}`);
  }
}

async function main() {
  // Setup functions
  // await getBalance();
  // await check_token_initialized();
  // await register_token();
  // await mint_tokens();
  // await checkTokenBalance();
  // await initialize_swap_ledger();

  // Swap functions
  // await fund_src_esrcow();
  // await fund_src_escrow(
  // const dst_amount = 1e8;
  // const expiration_duration_secs = Math.floor(Date.now() / 1000) + 3600;
  // const secret = ethers.toUtf8Bytes("my_secret_password_for_swap_test");
  // const secret_hash = hexToUint8Array(ethers.keccak256(secret));
  // await fund_dst_escrow({cointype:aptosconfig.tokenType,dstAmount: dst_amount,duration: expiration_duration_secs, secret_hash });

  // Dynamic functions with order IDs
  // await claim_funds(83); // Replace 8 with your order ID
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

function areAccountsConfigured(): boolean {
  return account !== null && userAccount !== null;
}

//   ADDED: Function to get account info
function getAccountInfo() {
  return {
    account: account ? account.address().hex() : null,
    userAccount: userAccount ? userAccount.address().hex() : null,
    configured: areAccountsConfigured()
  };
}

export {
  fund_dst_escrow,
  claim_funds,
  cancel_swap,
  initialize_swap_ledger,
  getOrderDetails,
  getNextOrderId,
  testCompleteFlow,
  account,
  userAccount,
  hexToUint8Array,
  areAccountsConfigured,
  getAccountInfo,
  getBalance,
  fund_src_escrow
}
