export type SignalStatus = "pending" | "win" | "loss" | "expired" | "void";

export interface ProtocolConfig {
  programId: string;
  mint: string;
  operator: string;
  minStakeRaw: string;
  tokenTicker: string;
  paymentTicker: string;
  swapUrl: string;
}

export interface Provider {
  id: string; // uuid
  wallet: string;
  name: string;
  description: string;
  assetClasses: string[];
  timeframe: string;
  methodology: string;
  priceSol: number;
  payoutWallet: string;
  stakedRaw: string;
  tier: "benchmarking" | "standard" | "preferred" | "elite";
  cageScore: number | null;
  active: boolean;
  registeredAt: string;
  signalCount?: number;
  wins: number;
  losses: number;
  expired?: number;
  resolved: number;
}

export interface Signal {
  id: number;
  hash: string;
  providerId: string; // uuid
  providerName?: string;
  idx: number;
  asset: string; // Solana mint address
  assetSymbol?: string | null; // display ticker (e.g. SOL)
  assetLogo?: string | null; // display icon URL
  direction: "long" | "short" | null; // null = masked until purchased
  entry: number | null;
  target: number | null;
  stop: number | null;
  horizonHours: number | null;
  status: SignalStatus;
  locked: boolean;
  txSig: string | null;
  publishedAt: string;
  resolvesAt: string;
  resolvedAt: string | null;
  outcome: any;
  returnPct: number | null;
}

export interface SignalVerification {
  signal: Signal;
  provider: { id: string; name: string; wallet: string };
  chain: { found: boolean; txSig: string | null; hash: string };
}

export interface Price {
  mint: string;
  tokensPerSol: number;
  priceInSol: number;
}

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  icon: string | null;
  decimals: number;
}

export interface Stats {
  providers: number;
  signals: number;
  wins: number;
  losses: number;
  avgCageScore: number;
  burned?: string;
}

// One signal's verification result against the chain.
export interface SignalCheck {
  hash: string;
  idx: number;
  status: SignalStatus;
  // the signal's hash is actually recorded on-chain (committed before the outcome)
  onChain: boolean;
  // recomputed hash of the revealed fields matches the on-chain hash;
  // null = the signal is still masked, so its content can't be checked yet
  contentMatch: boolean | null;
}

// Result of auditing a provider's whole track record against Solana.
export interface ProviderAudit {
  provider: { id: string; wallet: string; name: string };
  total: number;
  onChain: number;          // how many signal hashes are on-chain
  contentVerified: number;  // revealed signals whose content matches its hash
  masked: number;           // signals still masked (content not checkable yet)
  ok: boolean;              // every hash on-chain and no content mismatch
  mismatches: SignalCheck[];
  checks: SignalCheck[];
}

// Per-asset slice of a provider's record.
export interface AssetBreakdown {
  asset: string;
  assetSymbol: string | null;
  total: number;
  wins: number;
  losses: number;
}

// Performance analytics computed client-side from a provider's signals.
export interface ProviderStats {
  provider: { id: string; wallet: string; name: string };
  total: number;
  resolved: number;            // decided outcomes (win + loss + expired)
  wins: number;
  losses: number;
  expired: number;
  pending: number;
  voided: number;
  winRate: number | null;      // wins / (wins + losses), null if nothing decided
  avgReturnPct: number | null; // mean returnPct over signals that have one
  bestStreak: number;          // longest run of consecutive wins
  currentStreak: number;       // consecutive wins ending at the latest resolved signal
  byAsset: AssetBreakdown[];
}
