export { FradClient } from "./client";
export type { FradClientOptions } from "./client";
export { FradChain, DEFAULT_PROGRAM_ID } from "./chain";
export { FradApiError } from "./http";
export { keypairSigner, walletSigner } from "./signer";
export type { Signer } from "./signer";
export { signalHashHex, canonicalString } from "./canonical";
export type { SignalContent } from "./canonical";
export * from "./types";

// raw token math helpers
export const tokensToRaw = (amount: number, decimals: number): bigint =>
  BigInt(Math.round(amount * 10 ** decimals));
export const rawToTokens = (raw: bigint | string, decimals: number): number =>
  Number(raw) / 10 ** decimals;
