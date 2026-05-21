import bs58 from "bs58";
import type { Signer } from "./signer";

export const sessionMessage = (wallet: string, ts: string) => `frad-session:${wallet}:${ts}`;
export const requestMessage = (method: string, path: string, ts: string, bodyHash: string) =>
  `frad:${method.toUpperCase()}:${path}:${ts}:${bodyHash}`;

// Sign the one-per-24h session message — feeds POST /api/auth/session.
export async function signSession(signer: Signer): Promise<{ wallet: string; ts: string; sig: string }> {
  const wallet = signer.publicKey.toBase58();
  const ts = String(Date.now());
  const sig = bs58.encode(await signer.signMessage(new TextEncoder().encode(sessionMessage(wallet, ts))));
  return { wallet, ts, sig };
}
