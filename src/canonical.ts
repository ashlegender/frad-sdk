import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

export interface SignalContent {
  asset: string;
  direction: "long" | "short";
  entry: number;
  target: number;
  stop: number;
  horizonHours: number;
}

// Byte-identical to backend/src/lib/canonical.ts — the asset is a Solana mint
// address (base58, case-sensitive), so we only trim.
export function normalizeAsset(asset: string): string {
  return (asset || "").trim();
}

// Byte-identical to backend/src/lib/canonical.ts — lets anyone recompute a
// signal's hash in the browser and check it against the on-chain record.
export function canonicalString(c: SignalContent): string {
  return [
    "frad-signal-v1",
    normalizeAsset(c.asset),
    c.direction,
    String(Number(c.entry)),
    String(Number(c.target)),
    String(Number(c.stop)),
    String(Number(c.horizonHours)),
  ].join("|");
}

export function signalHashHex(c: SignalContent): string {
  return bytesToHex(sha256(new TextEncoder().encode(canonicalString(c))));
}
