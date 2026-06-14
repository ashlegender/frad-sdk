<div align="center">

<h1>Faraday&nbsp;Analysis&nbsp;SDK</h1>

<p><strong>A verified trading-signal marketplace on Solana.<br/>Every signal's hash is committed on-chain before the outcome is known — so track records can't be faked.</strong></p>

<p>
  <a href="https://www.npmjs.com/package/@fradanalysis/sdk"><img src="https://img.shields.io/npm/v/@fradanalysis/sdk?style=flat-square&color=CB3837&label=npm&logo=npm&logoColor=white" alt="npm version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="license"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-3C873A?style=flat-square&logo=node.js&logoColor=white" alt="node >=18">
  <img src="https://img.shields.io/badge/Solana-mainnet--beta-9945FF?style=flat-square&logo=solana&logoColor=white" alt="solana">
  <img src="https://img.shields.io/badge/swaps-Jupiter-22D1A8?style=flat-square" alt="jupiter">
  <img src="https://img.shields.io/badge/types-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="typescript">
</p>

<p>
  <a href="https://github.com/ashlegender/frad-sdk"><img src="https://img.shields.io/badge/GitHub-View_source-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub"></a>
  &nbsp;
  <a href="https://www.npmjs.com/package/@fradanalysis/sdk"><img src="https://img.shields.io/badge/npm-Install-CB3837?style=for-the-badge&logo=npm&logoColor=white" alt="npm"></a>
  &nbsp;
  <a href="https://jup.ag"><img src="https://img.shields.io/badge/Powered_by-Jupiter-22D1A8?style=for-the-badge&logoColor=white" alt="Jupiter"></a>
</p>

</div>

---

Faraday turns trading signals into a **provably honest** marketplace. A provider
stakes **$FRAD**, then publishes a signal whose **SHA-256 hash is written
on-chain the moment it's created** — before anyone knows if it wins. The
direction stays masked until a buyer pays, and outcomes resolve automatically
from on-chain prices. The result is a track record that is **tamper-proof,
verifiable by anyone, and skin-in-the-game backed**.

This SDK is the thin client. One `FradClient` class works for both **bots /
servers** (a Solana keypair) and **apps** (a browser wallet adapter), and covers
the whole flow: browse the marketplace, stake, publish, and buy signals.

## Contents

- [Why](#why)
- [Install](#install)
- [Quick start](#quick-start)
- [How a signal stays honest](#how-a-signal-stays-honest)
- [API](#api)
- [Marketplace &amp; payments](#marketplace--payments)
- [Verifying a signal](#verifying-a-signal)
- [Wallets &amp; sessions](#wallets--sessions)
- [Configuration](#configuration)
- [Requirements](#requirements)
- [License](#license)

## Why

- **Provable, not promised** — each signal commits its hash on-chain at publish
  time, so a provider can't rewrite history or cherry-pick winners.
- **Skin in the game** — providers must stake **$FRAD** to publish; quality is
  scored (the Cage Score) and stake is at risk.
- **Masked until paid** — the direction (long/short) and levels are hidden until
  a buyer purchases, so signals can't be front-run or leaked for free.
- **Auto-resolved** — outcomes are settled from **Jupiter** spot-price sampling
  (target / stop crossing), not a human calling the result.
- **Monetizable** — buyers pay in **$FRAD**; paying in SOL auto-swaps to $FRAD
  through **Jupiter** first, so settlement always lands in the token.

## Install

```bash
npm install @fradanalysis/sdk
```

## Quick start

```ts
import { FradClient, keypairSigner } from '@fradanalysis/sdk';
import { Keypair } from '@solana/web3.js';

const frad = new FradClient({
  apiUrl: 'https://your-frad-backend',
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  swapUrl: 'https://your-frad-backend/swap', // SOL -> $FRAD quotes (Jupiter)
  signer: keypairSigner(myKeypair),          // server/bot — or walletSigner(adapter)
});

// Deployment config (program id, $FRAD mint, operator, min stake) — nothing hardcoded
const cfg = await frad.public.config();

// Browse the marketplace
const { providers } = await frad.public.providers({ sort: 'cageScore', limit: 10 });
const { signals } = await frad.public.signals(providers[0].id);

// Buy access to a signal, paying directly in $FRAD
await frad.auth.createSession();
const txSig = await payProviderInFrad(/* ... build + send from frad.chain() ... */);
await frad.consumer.purchase({ signalId: signals[0].id, txSig, currency: 'token' });
```

In the browser, pass a wallet adapter instead of a keypair:

```ts
import { useWallet } from '@solana/wallet-adapter-react';
import { FradClient, walletSigner } from '@fradanalysis/sdk';

const wallet = useWallet();
const frad = new FradClient({ apiUrl, rpcUrl, swapUrl, signer: walletSigner(wallet) });
```

> The protocol config (program id, $FRAD mint, operator, min stake, tickers) is
> served by the backend via `frad.public.config()` — nothing is hardcoded in
> your app.

## How a signal stays honest

1. **Stake** — a provider stakes $FRAD into a vault PDA (`buildStakeTx`).
2. **Publish** — the signal's canonical fields are hashed (`signalHashHex`) and
   the hash is committed on-chain in the same publish call. The direction and
   levels are stored masked.
3. **Sell** — the signal is listed at a SOL price; buyers pay in $FRAD (or SOL →
   $FRAD via Jupiter). Only after payment is the direction revealed to that buyer.
4. **Resolve** — the operator samples Jupiter spot prices each tick; when target
   or stop is crossed (or the horizon expires) the outcome is recorded as
   `win` / `loss` / `expired`, and the Cage Score updates.

Because the hash was on-chain *before* the outcome, anyone can later recompute it
from the revealed fields and confirm the provider didn't change the call.

## API

```ts
const frad = new FradClient({ apiUrl, rpcUrl, swapUrl, signer });
```

### `public` — no signature required

| Method | Description |
| --- | --- |
| `public.config()` | Deployment config: program id, $FRAD mint, operator, min stake, tickers. |
| `public.stats()` | Protocol stats — providers, signals, wins/losses, avg Cage Score, $FRAD burned. |
| `public.tokens(q)` | Search Solana tokens by symbol/name/mint (for the asset picker). |
| `public.providers(query)` | Browse providers — filter by asset class, sort, paginate. |
| `public.provider(id)` | A single provider by UUID. |
| `public.signals(providerId, opts?)` | A provider's signals (direction masked unless you have access). |
| `public.signal(hash)` | Verify one signal against its on-chain record. |
| `public.verifyContentHash(content, hash)` | Recompute the canonical hash locally and compare. |

### `auth` — wallet session

| Method | Description |
| --- | --- |
| `auth.createSession()` | Sign a challenge with the wallet and open a session token. |
| `auth.setSessionToken(t)` / `clearSessionToken()` | Reuse / drop an existing session token. |
| `auth.hasSession()` | Is a session token set? |

### `provider` — publish side (auth required)

| Method | Description |
| --- | --- |
| `provider.me()` | The connected wallet's provider profile (or `null`). |
| `provider.register(body)` | Create / update the provider profile (name, asset classes, price in SOL). |
| `provider.publish(body)` | Publish a signal — hash committed on-chain; returns the signal + tx signature. |
| `provider.mySignals()` | All of the provider's own signals (unmasked). |

### `consumer` — buy side (auth required)

| Method | Description |
| --- | --- |
| `consumer.purchase({ signalId, txSig, currency })` | Record a payment (`'token'` or `'native'`) and unlock the signal. |
| `consumer.purchases()` | Everything the wallet has bought (unmasked). |
| `consumer.feed()` | The buyer's unlocked signal feed. |

### `swap` — SOL ↔ $FRAD (Jupiter)

| Method | Description |
| --- | --- |
| `swap.price(mint)` | Current price (tokens per SOL / price in SOL). |
| `swap.quote(inputMint, outputMint, amount, slippageBps?)` | A Jupiter swap quote. |
| `swap.buildSwapTx(quote, userPublicKey)` / `swap.deserialize(b64)` | Build / deserialize the swap transaction. |

### `chain()` — on-chain transaction builders

`frad.chain()` returns a browser-safe helper for building (unsigned) transactions
you then sign and send with your wallet:

| Method | Description |
| --- | --- |
| `buildStakeTx(wallet, mint, amountRaw)` | Stake $FRAD into the provider vault. |
| `buildUnstakeTx(wallet, mint, amountRaw)` | Unstake (partial ≥ min, or full to sweep + close). |
| `buildFradPaymentTx(from, toWallet, mint, rawAmount)` | Pay a provider directly in $FRAD. |
| `buildSolPaymentTx(from, toWallet, lamports)` | Raw SOL transfer helper. |
| `readConfig()` / `readProvider(wallet)` | Read on-chain accounts directly. |

Every method is fully typed; shared shapes (`ProtocolConfig`, `Provider`,
`Signal`, `SignalVerification`, `Price`, `TokenInfo`, `Stats`, `Signer`,
`SignalContent`, …) are exported from the package, along with the
`tokensToRaw` / `rawToTokens` helpers.

## Marketplace & payments

Signals are priced in **SOL**, but the provider is **always paid in $FRAD** — so
demand for signals creates buy pressure on the token.

- **Pay in $FRAD** (`currency: 'token'`) — transfer $FRAD straight to the
  provider with `chain().buildFradPaymentTx(...)`, then record it with
  `consumer.purchase`.
- **Pay in SOL** (`currency: 'native'`) — swap the sticker SOL → $FRAD through
  **Jupiter** first (`swap.quote` + `swap.buildSwapTx`), pay the provider the
  swap output in $FRAD, then record the purchase. The buyer spends SOL; the
  provider still receives the token.

Swaps go through the configured swap server, which proxies the public **Jupiter**
API on mainnet.

## Verifying a signal

Anyone can confirm a provider didn't rewrite a call after the fact:

```ts
import { signalHashHex } from '@fradanalysis/sdk';

// the revealed canonical fields of a purchased/resolved signal
const recomputed = signalHashHex({
  asset: signal.asset,        // Solana mint address (base58)
  direction: signal.direction!,
  entry: signal.entry!,
  target: signal.target!,
  stop: signal.stop!,
  horizonHours: signal.horizonHours!,
});

// compare against the hash committed on-chain at publish time
const onchain = await frad.public.signal(signal.hash);
console.log(recomputed === onchain.signal.hash && onchain.chain.found);
```

The hashing is **byte-identical** to the backend, so a hash you compute in the
browser matches the one stored on Solana.

## Wallets & sessions

`Signer` is satisfied by:

- a **browser wallet adapter** — `walletSigner(useWallet())`, or
- **`keypairSigner(keypair)`** for servers, bots, and CI.

```ts
import { keypairSigner, walletSigner } from '@fradanalysis/sdk';

const serverSigner  = keypairSigner(myKeypair);
const browserSigner = walletSigner(walletAdapter);
```

Authenticated calls need a session: `await frad.auth.createSession()` signs a
challenge with the wallet and stores the token on the client. You can also pass a
previously issued `sessionToken` in the constructor.

## Configuration

```ts
new FradClient({
  apiUrl,         // required — Faraday backend base URL
  rpcUrl?,        // Solana RPC endpoint (required for chain() builders)
  swapUrl?,       // swap/price server (Jupiter proxy) — required for swap.*
  signer?,        // keypairSigner() or walletSigner() — required for auth'd calls
  sessionToken?,  // reuse an existing session token instead of signing again
  programId?,     // override the program id (defaults to mainnet — DEFAULT_PROGRAM_ID)
});
```

The SDK targets **Solana mainnet** by default (`DEFAULT_PROGRAM_ID`, exported from
the package). To point at devnet or another deployment, pass `programId`:

```ts
import { FradClient, DEFAULT_PROGRAM_ID } from '@fradanalysis/sdk';

const frad = new FradClient({ apiUrl, rpcUrl, programId: '<devnet program id>' });
```

## Requirements

- **Node.js >= 18** (a global `fetch`) for server/bot usage, or any modern
  browser for app usage.
- A running **Faraday backend** (marketplace API + operator keepers) reachable at
  `apiUrl`, and a **swap server** (Jupiter proxy) at `swapUrl` for SOL payments.

## License

[MIT](./LICENSE) © Faraday Analysis
