import { SupportedChains } from "../index.js";
import { AuthUserInformation, IKeyDidAuth } from "../types/auth.js";
import { DID } from "dids";
import { DIDAny } from "../types/common.js";
import { createDIDKey } from "did-session";

const hexToUint8Array = (hex: string) =>
  new Uint8Array(
    (hex.match(/[\da-f]{2}/gi) as RegExpMatchArray).map((h: string) =>
      parseInt(h, 16)
    )
  );

const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

export class KeyDidSession {
  #seed: string;

  constructor(seed: Uint8Array | string) {
    this.#seed = typeof seed === "string" ? seed : toHexString(seed);
  }

  get seed() {
    return this.#seed;
  }

  static fromSession(session: string) {
    const seed = session.replace("did:key:session:", "");
    return new KeyDidSession(seed);
  }

  serialize() {
    return "did:key:session:" + this.#seed;
  }
}

export class KeyDidAuth implements IKeyDidAuth {
  orbisAuthId: "ceramic-did" = "ceramic-did";
  chain = SupportedChains.ethereum;

  #did: DID;
  #seed: Uint8Array;

  constructor(did: DID, seed: Uint8Array) {
    this.#seed = seed;
    this.#did = did;
  }

  static async generateSeed(format: "hex" | "uint8" = "uint8") {
    const buffer = new Uint8Array(32);
    const seed = crypto.getRandomValues(buffer);

    if (format === "uint8") {
      return seed;
    }
    return toHexString(seed);
  }

  static async fromSession(session: string) {
    const sess = KeyDidSession.fromSession(session);
    return this.fromSeed(sess.seed);
  }

  static async fromSeed(seed: string | Uint8Array): Promise<IKeyDidAuth> {
    const parsedSeed = typeof seed === "string" ? hexToUint8Array(seed) : seed;
    const did = await createDIDKey(parsedSeed);

    return new KeyDidAuth(did, parsedSeed);
  }

  async getUserInformation(): Promise<AuthUserInformation> {
    return {
      did: this.#did.id as DIDAny,
      chain: this.chain,
      metadata: {},
    };
  }

  async authenticateDid(): Promise<{ did: DID; session: KeyDidSession }> {
    return {
      did: this.#did,
      session: new KeyDidSession(this.#seed),
    };
  }
}
