import { JsonRpcProvider } from "ethers";
export const provider = new JsonRpcProvider("https://sepolia.infura.io/v3/eefe96c240bc4745a6d895d83d3968b4", 11155111)

export const CHAIN_IDS_CONFIG = {
  11155111: 1,
  8453: 8453, // Aptos
} as const;

export const CHAIN_IDS = {
  ETHEREUM: 1,
  SEPOLIA: 11155111,
  APTOS: 8453,
} as const;