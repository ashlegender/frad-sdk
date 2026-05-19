import { Keypair, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

// Minimal message signer — abstracts a Node Keypair vs a browser wallet adapter.
export interface Signer {
  publicKey: PublicKey;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

export function keypairSigner(kp: Keypair): Signer {
  return {
    publicKey: kp.publicKey,
    async signMessage(m) {
      return nacl.sign.detached(m, kp.secretKey);
    },
  };
}

// Wallet-adapter style object: { publicKey, signMessage }
export function walletSigner(wallet: {
  publicKey: PublicKey | null;
  signMessage?: (m: Uint8Array) => Promise<Uint8Array>;
}): Signer {
  return {
    get publicKey() {
      if (!wallet.publicKey) throw new Error("wallet not connected");
      return wallet.publicKey;
    },
    async signMessage(m) {
      if (!wallet.signMessage) throw new Error("wallet does not support signMessage");
      return wallet.signMessage(m);
    },
  } as Signer;
}
