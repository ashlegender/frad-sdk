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
