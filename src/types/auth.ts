import { SiwxMessage } from "@didtools/cacao";
import { SupportedChains } from "./providers.js";
import { SignedSiwxMessage } from "./siwx.js";
import { OrbisResources } from "./resources.js";
import { DIDAny } from "./common.js";
import { DID } from "dids";
import { KeyDidSession } from "../auth/keyDid.js";

export type AuthError = { error: string; details?: any };

export type OrbisSession = {
  did: string;
  chain: SupportedChains;
  siwx: {
    message: SignedSiwxMessage;
    resources: Array<OrbisResources>;
    serialized: string;
    signature: string;
  };
};

export type AuthResource = {
  userFriendlyName: string;
  siwxResources: Array<string>;
  resourceType: OrbisResources;
};

export type AuthOptions = {
  resources: Array<AuthResource>;
  params?: any;
  siwxOverwrites?: Partial<SiwxMessage>;
};

export type AuthUserInformation = {
  did: DIDAny;
  chain: SupportedChains;
  metadata: Record<string, any>;
};

export interface IOrbisAuth {
  readonly orbisAuthId: string;
  readonly chain: SupportedChains;

  getUserInformation(): Promise<AuthUserInformation>;
  authenticateSiwx({
    resources,
    siwxOverwrites,
    params,
  }: AuthOptions): Promise<OrbisSession>;
}

export interface IKeyDidAuth {
  readonly orbisAuthId: "ceramic-did";
  readonly chain: SupportedChains;

  getUserInformation(): Promise<AuthUserInformation>;
  authenticateDid: () => Promise<{ did: DID; session: KeyDidSession }>;
}
