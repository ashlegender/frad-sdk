import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import idl from "./idl/faraday_cage.json";

// Default program id for the published SDK: Faraday on Solana **mainnet**. The
// bundled IDL is treated as layout-only; the address lives here so a cold
// `npm install` targets mainnet out of the box. Pass `programId` (or
// `FradClient({ programId })`) to point at devnet or any other deployment.
export const DEFAULT_PROGRAM_ID = "AC1yXTwKGRdWCr1DUK9LCwwozYMDCav9Ez38SVoNs7r";

// Browser-safe chain helper. anchor.Wallet is Node-only, so we feed AnchorProvider
// an inline dummy wallet — we only build/read; the real wallet signs + sends.
export class FradChain {
  readonly connection: Connection;
  readonly programId: PublicKey;
  readonly program: anchor.Program;

  // `programId` overrides the address baked into the committed IDL, so the same
  // IDL works on devnet and mainnet (different program ids, identical layout).
  constructor(rpcUrl: string, programId?: string) {
    this.connection = new Connection(rpcUrl, "confirmed");
    const resolvedIdl = { ...(idl as any), address: programId || DEFAULT_PROGRAM_ID };
    this.programId = new PublicKey(resolvedIdl.address);
    const dummy = {
      publicKey: Keypair.generate().publicKey,
      signTransaction: async <T>(t: T) => t,
      signAllTransactions: async <T>(t: T[]) => t,
    };
    const provider = new anchor.AnchorProvider(this.connection, dummy as any, { commitment: "confirmed" });
    this.program = new anchor.Program(resolvedIdl as anchor.Idl, provider);
  }

  configPda = () => PublicKey.findProgramAddressSync([Buffer.from("config")], this.programId)[0];
  providerPda = (w: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("provider"), w.toBuffer()], this.programId)[0];
  vaultPda = (w: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("vault"), w.toBuffer()], this.programId)[0];

  readConfig = () => (this.program.account as any).config.fetch(this.configPda());
  readProvider = (w: PublicKey) => (this.program.account as any).provider.fetchNullable(this.providerPda(w));

  async buildStakeTx(wallet: PublicKey, mint: PublicKey, amountRaw: bigint): Promise<Transaction> {
    const ix = await this.program.methods
      .stake(new anchor.BN(amountRaw.toString()))
      .accountsPartial({
        config: this.configPda(),
        provider: this.providerPda(wallet),
        vault: this.vaultPda(wallet),
        mint,
        walletTokenAccount: getAssociatedTokenAddressSync(mint, wallet),
        wallet,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    return new Transaction().add(ix);
  }

  async buildUnstakeTx(wallet: PublicKey, mint: PublicKey, amountRaw: bigint): Promise<Transaction> {
    const ix = await this.program.methods
      .unstake(new anchor.BN(amountRaw.toString()))
      .accountsPartial({
        config: this.configPda(),
        provider: this.providerPda(wallet),
        vault: this.vaultPda(wallet),
        mint,
        walletTokenAccount: getAssociatedTokenAddressSync(mint, wallet),
        wallet,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    return new Transaction().add(ix);
  }

  // Per-signal payment straight to the provider (no escrow).
  buildSolPaymentTx(from: PublicKey, toWallet: PublicKey, lamports: number): Transaction {
    return new Transaction().add(
      SystemProgram.transfer({ fromPubkey: from, toPubkey: toWallet, lamports })
    );
  }

  buildFradPaymentTx(from: PublicKey, toWallet: PublicKey, mint: PublicKey, rawAmount: bigint): Transaction {
    const fromAta = getAssociatedTokenAddressSync(mint, from);
    const toAta = getAssociatedTokenAddressSync(mint, toWallet);
    return new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(from, toAta, toWallet, mint),
      createTransferInstruction(fromAta, toAta, from, rawAmount)
    );
  }
}
