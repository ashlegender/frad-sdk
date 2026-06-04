import { apiFetch, RequestOptions, FradApiError } from "./http";
import { signSession } from "./auth";
import type { Signer } from "./signer";
import { FradChain } from "./chain";
import * as swap from "./swap";
import { signalHashHex } from "./canonical";
import type { ProtocolConfig, Provider, Signal, SignalVerification, Stats, Price, TokenInfo } from "./types";

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

  chain(): FradChain {
    if (!this.rpcUrl) throw new Error("rpcUrl required for chain ops");
    return (this._chain ??= new FradChain(this.rpcUrl, this.programId));
  }
}

export { FradApiError };
