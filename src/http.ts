import bs58 from "bs58";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import type { Signer } from "./signer";
import { requestMessage } from "./auth";

export interface RequestOptions {
  signer?: Signer; // per-request signature (bots)
  sessionToken?: string; // bearer session (browser) — wins over signer
}

export class FradApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// One authed/unauthed JSON call. `path` may include a query string; the
// signature covers only the pathname (matches the backend).
export async function apiFetch(
  apiUrl: string,
  method: string,
  path: string,
  body: any,
  opts: RequestOptions = {}
): Promise<any> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const raw = body != null ? JSON.stringify(body) : undefined;

  if (opts.sessionToken) {
    headers["x-frad-session"] = opts.sessionToken;
  } else if (opts.signer) {
    const ts = String(Date.now());
    const bodyHash = raw ? bytesToHex(sha256(new TextEncoder().encode(raw))) : "-";
    const signPath = path.split("?")[0];
    const msg = requestMessage(method, signPath, ts, bodyHash);
    headers["x-frad-wallet"] = opts.signer.publicKey.toBase58();
    headers["x-frad-ts"] = ts;
    headers["x-frad-sig"] = bs58.encode(await opts.signer.signMessage(new TextEncoder().encode(msg)));
  }

  const res = await fetch(`${apiUrl}${path}`, { method, headers, body: raw });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new FradApiError(json.error || `${method} ${path} -> ${res.status}`, res.status);
  return json;
}
