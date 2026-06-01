import { VersionedTransaction } from "@solana/web3.js";
import type { Price } from "./types";

const trim = (u: string) => u.replace(/\/$/, "");

export async function getPrice(swapUrl: string, mint: string): Promise<Price> {
  const r = await fetch(`${trim(swapUrl)}/price?mint=${mint}`);
  if (!r.ok) throw new Error(`/price -> ${r.status}`);
  return r.json();
}

export async function getQuote(
  swapUrl: string,
  inputMint: string,
  outputMint: string,
  amount: string | number,
  slippageBps = 100
): Promise<any> {
  const r = await fetch(
    `${trim(swapUrl)}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`
  );
  if (!r.ok) throw new Error(`/quote -> ${r.status}`);
  return r.json();
}

export async function buildSwapTx(swapUrl: string, quote: any, userPublicKey: string): Promise<{ swapTransaction: string }> {
  const r = await fetch(`${trim(swapUrl)}/swap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ quoteResponse: quote, userPublicKey }),
  });
  if (!r.ok) throw new Error(`/swap -> ${r.status}`);
  return r.json();
}

function b64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array((globalThis as any).Buffer.from(b64, "base64"));
}

export function deserializeSwapTx(b64: string): VersionedTransaction {
  return VersionedTransaction.deserialize(b64ToBytes(b64));
}
