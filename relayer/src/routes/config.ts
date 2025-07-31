import { JsonRpcProvider } from "ethers";
export const provider = new JsonRpcProvider("https://sepolia.infura.io/v3/eefe96c240bc4745a6d895d83d3968b4", 11155111)

export const aptosconfig = {
    "moduleAddress": "0x6a33e62028e210d895c22c631c17c856cf774c887785357672636db8530e6226",
    "aptosNodeUrl": "https://fullnode.testnet.aptoslabs.com/v1",
    'tokenType': '0x6a33e62028e210d895c22c631c17c856cf774c887785357672636db8530e6226::my_token::SimpleToken',
    "node": "https://fullnode.testnet.aptoslabs.com/v1",
  }
