/**
 * Example: browse the Faraday marketplace from code (not the website) and
 * verify a signal's on-chain hash. Read-only — no wallet or funds required.
 *
 * Needs a running Faraday backend.
 *   FRAD_API=https://your-frad-backend \
 *   FRAD_RPC=https://api.mainnet-beta.solana.com \
 *   npx tsx examples/bot.ts
 */
import { FradClient, signalHashHex } from "../src/index";

async function main() {
  const frad = new FradClient({
    apiUrl: process.env.FRAD_API || "http://localhost:3001",
    rpcUrl: process.env.FRAD_RPC || "https://api.devnet.solana.com",
  });

  const cfg = await frad.public.config();
  console.log("program:", cfg.programId);
  console.log("mint:   ", cfg.mint, `(${cfg.tokenTicker})`);

  const stats = await frad.public.stats();
  console.log(`stats -> ${stats.providers} providers, ${stats.signals} signals, ` +
    `${stats.wins}W/${stats.losses}L, avg Cage Score ${stats.avgCageScore}`);

  const { providers } = await frad.public.providers({ sort: "cageScore", limit: 5 });
  if (!providers.length) {
    console.log("no providers yet — publish one from the app, then re-run.");
    return;
  }
  const top = providers[0];
  console.log(`top provider: ${top.name} (${top.tier}, Cage Score ${top.cageScore ?? "—"})`);

  const { signals } = await frad.public.signals(top.id);
  console.log(`${signals.length} signal(s); newest: ${signals[0]?.hash ?? "—"}`);

  // Anyone can recompute the canonical hash of a *resolved/purchased* signal and
  // check it against what was committed on-chain at publish time.
  const revealed = signals.find((s) => s.direction != null);
  if (revealed) {
    const recomputed = signalHashHex({
      asset: revealed.asset,
      direction: revealed.direction!,
      entry: revealed.entry!,
      target: revealed.target!,
      stop: revealed.stop!,
      horizonHours: revealed.horizonHours!,
    });
    const onchain = await frad.public.signal(revealed.hash);
    const ok = recomputed === onchain.signal.hash && onchain.chain.found;
    console.log(`hash check for ${revealed.hash.slice(0, 8)}… -> ${ok ? "✓ verified" : "✗ mismatch"}`);
  } else {
    console.log("no revealed signals to verify (all masked until purchased).");
  }

  console.log("\n✓ example OK");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("example failed:", e);
  process.exit(1);
});
