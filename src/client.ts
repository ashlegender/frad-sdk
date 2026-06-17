import { apiFetch, RequestOptions, FradApiError } from "./http";
import { signSession } from "./auth";
import type { Signer } from "./signer";
import { FradChain } from "./chain";
import * as swap from "./swap";
import { signalHashHex } from "./canonical";
import type { ProtocolConfig, Provider, Signal, SignalVerification, Stats, Price, TokenInfo, ProviderAudit, SignalCheck, ProviderStats } from "./types";

export interface FradClientOptions {
  apiUrl: string;
  swapUrl?: string;
  rpcUrl?: string;
  signer?: Signer;
  sessionToken?: string;
  // Override the program id baked into the IDL (e.g. a distinct mainnet id).
  programId?: string;
}

export class FradClient {
  apiUrl: string;
  swapUrl?: string;
  rpcUrl?: string;
  signer?: Signer;
  sessionToken?: string;
  programId?: string;
  private _chain?: FradChain;

  constructor(o: FradClientOptions) {
    this.apiUrl = o.apiUrl.replace(/\/$/, "");
    this.swapUrl = o.swapUrl;
    this.rpcUrl = o.rpcUrl;
    this.signer = o.signer;
    this.sessionToken = o.sessionToken;
    this.programId = o.programId;
  }

  private authOpts(): RequestOptions {
    return this.sessionToken ? { sessionToken: this.sessionToken } : { signer: this.signer };
  }
  private get = (path: string) => apiFetch(this.apiUrl, "GET", path, null, {});

  public = {
    config: (): Promise<ProtocolConfig> => this.get("/api/config"),
    stats: (): Promise<Stats> => this.get("/api/stats"),
    tokens: (q: string): Promise<{ tokens: TokenInfo[] }> =>
      this.get(`/api/tokens?q=${encodeURIComponent(q)}`),
    providers: (q: { asset?: string; sort?: string; q?: string; limit?: number; offset?: number } = {}): Promise<{
      providers: Provider[];
      total: number;
    }> => {
      const p = new URLSearchParams(
        Object.entries(q).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString();
      return this.get(`/api/providers${p ? `?${p}` : ""}`);
    },
    provider: (id: string): Promise<Provider> => this.get(`/api/providers/${id}`),
    signals: (providerId: string, opts: { status?: string } = {}): Promise<{ signals: Signal[]; unmasked: boolean }> => {
      const p = new URLSearchParams({ providerId: String(providerId), ...(opts.status ? { status: opts.status } : {}) }).toString();
      return apiFetch(this.apiUrl, "GET", `/api/signals?${p}`, null, this.authOpts());
    },
    signal: (hash: string): Promise<SignalVerification> => this.get(`/api/signals/${hash}`),
    verifyContentHash: (content: any, hash: string): boolean => signalHashHex(content) === hash,
  };

  auth = {
    createSession: async (): Promise<{ token: string; expiresAt: string }> => {
      if (!this.signer) throw new Error("signer required to create a session");
      const body = await signSession(this.signer);
      const r = await apiFetch(this.apiUrl, "POST", "/api/auth/session", body, {});
      this.sessionToken = r.token;
      return r;
    },
    setSessionToken: (t: string) => (this.sessionToken = t),
    clearSessionToken: () => (this.sessionToken = undefined),
    hasSession: () => !!this.sessionToken,
  };

  provider = {
    me: (): Promise<{ provider: Provider | null }> => apiFetch(this.apiUrl, "GET", "/api/providers/me", null, this.authOpts()),
    register: (b: {
      name: string;
      description?: string;
      assetClasses?: string[];
      timeframe?: string;
      methodology?: string;
      priceSol: number;
    }): Promise<{ provider: Provider }> => apiFetch(this.apiUrl, "PUT", "/api/providers/me", b, this.authOpts()),
    publish: (b: {
      asset: string; // Solana mint address
      direction: "long" | "short";
      entry: number;
      target: number;
      stop: number;
      horizonHours: number;
      assetSymbol?: string; // display only (not hashed)
      assetLogo?: string; // display only (not hashed)
    }): Promise<{ signal: Signal; txSig: string; idx: number }> =>
      apiFetch(this.apiUrl, "POST", "/api/signals", b, this.authOpts()),
    mySignals: (): Promise<{ signals: Signal[] }> => apiFetch(this.apiUrl, "GET", "/api/signals/mine", null, this.authOpts()),
  };

  consumer = {
    purchase: (b: { signalId: number; txSig: string; currency: "native" | "token" }): Promise<{ signal: Signal }> =>
      apiFetch(this.apiUrl, "POST", "/api/purchases", b, this.authOpts()),
    purchases: (): Promise<{ purchases: any[] }> => apiFetch(this.apiUrl, "GET", "/api/purchases", null, this.authOpts()),
    feed: (): Promise<{ signals: Signal[] }> => apiFetch(this.apiUrl, "GET", "/api/feed", null, this.authOpts()),
  };

  swap = {
    price: (mint: string): Promise<Price> => swap.getPrice(this.swapUrl!, mint),
    quote: (inputMint: string, outputMint: string, amount: string | number, slippageBps?: number) =>
      swap.getQuote(this.swapUrl!, inputMint, outputMint, amount, slippageBps),
    buildSwapTx: (quote: any, userPublicKey: string) => swap.buildSwapTx(this.swapUrl!, quote, userPublicKey),
    deserialize: (b64: string) => swap.deserializeSwapTx(b64),
  };

  /**
   * Trustless audit of a provider's entire track record against Solana.
   *
   * For every signal it confirms the hash is actually committed on-chain (proving
   * it was recorded before the outcome was known), and for any signal whose fields
   * are revealed it recomputes the canonical hash and checks it matches — proving
   * the revealed call is byte-for-byte what was committed. Masked signals can only
   * be checked for on-chain presence until their content is revealed.
   *
   * Everything is verified independently against the chain — you don't have to
   * trust the backend's win/loss numbers.
   */
  async verifyProvider(id: string): Promise<ProviderAudit> {
    const [provider, { signals }] = await Promise.all([
      this.public.provider(id),
      this.public.signals(id),
    ]);

    const checks: SignalCheck[] = await Promise.all(
      signals.map(async (s): Promise<SignalCheck> => {
        let onChain = false;
        let contentMatch: boolean | null = null;
        try {
          const v = await this.public.signal(s.hash);
          onChain = v.chain.found && v.chain.hash === s.hash;
          const sig = v.signal;
          // only revealed signals expose the fields needed to recompute the hash
          if (
            sig.direction != null &&
            sig.entry != null &&
            sig.target != null &&
            sig.stop != null &&
            sig.horizonHours != null
          ) {
            contentMatch =
              signalHashHex({
                asset: sig.asset,
                direction: sig.direction,
                entry: sig.entry,
                target: sig.target,
                stop: sig.stop,
                horizonHours: sig.horizonHours,
              }) === s.hash;
          }
        } catch {
          onChain = false;
        }
        return { hash: s.hash, idx: s.idx, status: s.status, onChain, contentMatch };
      })
    );

    const mismatches = checks.filter((c) => !c.onChain || c.contentMatch === false);
    return {
      provider: { id: provider.id, wallet: provider.wallet, name: provider.name },
      total: checks.length,
      onChain: checks.filter((c) => c.onChain).length,
      contentVerified: checks.filter((c) => c.contentMatch === true).length,
      masked: checks.filter((c) => c.contentMatch === null).length,
      ok: mismatches.length === 0,
      mismatches,
      checks,
    };
  }

  /**
   * Performance analytics for a provider, computed client-side from public
   * signal data — win rate, average return, win streaks and a per-asset
   * breakdown. Pairs with `verifyProvider`: audit the record, then measure it.
   */
  async providerStats(id: string): Promise<ProviderStats> {
    const [provider, { signals }] = await Promise.all([
      this.public.provider(id),
      this.public.signals(id),
    ]);

    const count = (s: Signal["status"]) => signals.filter((x) => x.status === s).length;
    const wins = count("win");
    const losses = count("loss");
    const decided = wins + losses;

    const returns = signals.map((s) => s.returnPct).filter((r): r is number => r != null);
    const avgReturnPct = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : null;

    // chronological order for streaks (oldest → newest)
    const ordered = [...signals].sort((a, b) => a.idx - b.idx);
    let bestStreak = 0;
    let run = 0;
    let currentStreak = 0;
    for (const s of ordered) {
      if (s.status === "win") {
        run += 1;
        bestStreak = Math.max(bestStreak, run);
      } else if (s.status === "loss" || s.status === "expired") {
        run = 0;
      }
    }
    // current streak = trailing wins up to the latest decided signal
    for (let i = ordered.length - 1; i >= 0; i--) {
      const st = ordered[i].status;
      if (st === "win") currentStreak += 1;
      else if (st === "loss" || st === "expired") break;
    }

    const byAssetMap = new Map<string, ProviderStats["byAsset"][number]>();
    for (const s of signals) {
      const a = byAssetMap.get(s.asset) ?? {
        asset: s.asset,
        assetSymbol: s.assetSymbol ?? null,
        total: 0,
        wins: 0,
        losses: 0,
      };
      a.total += 1;
      if (s.status === "win") a.wins += 1;
      if (s.status === "loss") a.losses += 1;
      byAssetMap.set(s.asset, a);
    }

    return {
      provider: { id: provider.id, wallet: provider.wallet, name: provider.name },
      total: signals.length,
      resolved: wins + losses + count("expired"),
      wins,
      losses,
      expired: count("expired"),
      pending: count("pending"),
      voided: count("void"),
      winRate: decided ? wins / decided : null,
      avgReturnPct,
      bestStreak,
      currentStreak,
      byAsset: [...byAssetMap.values()].sort((a, b) => b.total - a.total),
    };
  }

  chain(): FradChain {
    if (!this.rpcUrl) throw new Error("rpcUrl required for chain ops");
    return (this._chain ??= new FradChain(this.rpcUrl, this.programId));
  }
}

export { FradApiError };
