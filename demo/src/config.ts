import { Networks } from "@stellar/stellar-sdk";

export const CONFIG = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
  // Replace with your deployed contract ID after running deploy-testnet.sh
  contractId: import.meta.env.VITE_CONTRACT_ID ?? "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
};
