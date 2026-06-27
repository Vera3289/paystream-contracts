/**
 * PayStream JavaScript example — create a stream, poll claimable, withdraw.
 *
 * Run:
 *   npm install @stellar/stellar-sdk
 *   node stream.js
 *
 * Set env vars before running:
 *   EMPLOYER_SECRET   — employer Stellar secret key (S...)
 *   EMPLOYEE_PUBLIC   — employee Stellar public key (G...)
 *   TOKEN_CONTRACT_ID — SEP-41 token contract ID
 *   STREAM_CONTRACT_ID — PayStream stream contract ID
 */

const {
  Keypair,
  Contract,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Address,
  nativeToScVal,
  scValToNative,
  rpc,
} = require("@stellar/stellar-sdk");

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK = Networks.TESTNET;

const server = new rpc.Server(RPC_URL);

const employer = Keypair.fromSecret(process.env.EMPLOYER_SECRET);
const employeePublicKey = process.env.EMPLOYEE_PUBLIC;
const tokenId = process.env.TOKEN_CONTRACT_ID;
const streamContractId = process.env.STREAM_CONTRACT_ID;

const contract = new Contract(streamContractId);

async function invoke(sourceKeypair, method, ...args) {
  const account = await server.getAccount(sourceKeypair.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(sourceKeypair);
  const result = await server.sendTransaction(prepared);
  if (result.status === "ERROR") throw new Error(`${method} failed`);
  // Poll for confirmation
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const tx = await server.getTransaction(result.hash);
    if (tx.status === "SUCCESS") return tx.returnValue ? scValToNative(tx.returnValue) : null;
    if (tx.status === "FAILED") throw new Error(`${method} transaction failed`);
  }
  throw new Error("Timeout waiting for confirmation");
}

async function simulate(method, ...args) {
  const account = await server.getAccount(employer.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`Simulation error: ${sim.error}`);
  return scValToNative(sim.result.retval);
}

async function main() {
  console.log("Creating stream...");
  const streamId = await invoke(
    employer,
    "create_stream",
    new Address(employer.publicKey()).toScVal(),
    new Address(employeePublicKey).toScVal(),
    new Address(tokenId).toScVal(),
    nativeToScVal(3600n, { type: "i128" }),   // 3600 stroops deposit
    nativeToScVal(1n, { type: "i128" }),       // 1 stroop/second
    nativeToScVal(0n, { type: "u64" })         // no stop time
  );
  console.log("Stream ID:", streamId);

  const stream = await simulate("get_stream", nativeToScVal(BigInt(streamId), { type: "u64" }));
  console.log("Stream state:", stream);

  const claimable = await simulate("claimable", nativeToScVal(BigInt(streamId), { type: "u64" }));
  console.log("Claimable now:", claimable);
}

main().catch(console.error);
