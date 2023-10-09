import { IAuthenticatedResource } from "./resources.js";
import { DIDPkh } from "./common.js";
import { SupportedChains } from "./providers.js";
import {
  AccessControlConditions,
  SolRpcConditions,
  UnifiedAccessControlConditions,
} from "@lit-protocol/types";

/**
 *
 * Rules (Lit)
 *
 */

type StandardTokenEncryptionRule = {
  type: "token-gated";
  chain: SupportedChains.evm | SupportedChains.solana;
  contractType: "ERC20" | "ERC721" | "SolanaContract";
  contractAddress: string;
  minTokenBalance: string;
};

type ERC1155EncryptionRule = {
  type: "token-gated";
  chain: SupportedChains.evm;
  contractType: "ERC1155";
  contractAddress: string;
  minTokenBalance: string;
  tokenId: string;
};

export type TokenGatedEncryptionRule =
  | StandardTokenEncryptionRule
  | ERC1155EncryptionRule;

export type CustomEncryptionRule = {
  type: "custom";
  accessControlConditions: UnifiedAccessControlConditions;
};

export type DidEncryptionRule = {
  type: "dids";
  dids: Array<DIDPkh>;
};

export type OrbisEncryptionRulesOperator = { operator: "and" | "or" };

export type OrbisEncryptionRules =
  | TokenGatedEncryptionRule
  | DidEncryptionRule
  | CustomEncryptionRule;

/**
 *
 * Encryption Interface (Lit)
 * TODO: If we add another client make "client" mandatory to identify encryptionClient (default to Lit)
 *
 */

type FileContentMetadata = {
  name: string;
  type: string;
};

export type OrbisEncryptionClients = "lit"; // | otherClient

export type IndexedEncryptedString = {
  client?: OrbisEncryptionClients;
  encryptedString?: string;
  encryptedSymmetricKey?: string;
  accessControlConditions?: string;
  solRpcConditions?: string;
  unifiedControlConditions?: string;
  contentMetadata?: FileContentMetadata;
};

export type EncryptStringParams = {
  string: string;
  encryptionRules: Array<OrbisEncryptionRules | OrbisEncryptionRulesOperator>;
};

export type EncryptFileParams = {
  file: File;
  encryptionRules: Array<OrbisEncryptionRules | OrbisEncryptionRulesOperator>;
};

type LitEncryptionMetadata = {
  encryptedSymmetricKey: string;
  encryptionRules?: UnifiedAccessControlConditions;
  evmEncryptionRules?: AccessControlConditions;
  solEncryptionRules?: SolRpcConditions;
};

export type EncryptionMetadata = {
  client?: OrbisEncryptionClients;
} & LitEncryptionMetadata;

export type EncryptedString = {
  encryptedContent: string;
  encryptionMetadata: EncryptionMetadata;
};

export type EncryptedFile = EncryptedString & {
  contentMetadata: FileContentMetadata;
};

export type DecryptedString = {
  decryptedContent: string;
};

export type DecryptedFile = {
  decryptedContent: File;
};

// TODO: bulkEncrypt with a single key
export interface IOrbisEncryptionClient extends IAuthenticatedResource {
  encryptString(params: EncryptStringParams): Promise<EncryptedString>;
  decryptString(encrypted: EncryptedString): Promise<DecryptedString>;

  encryptFile(params: EncryptFileParams): Promise<EncryptedFile>;
  decryptFile(params: EncryptedFile): Promise<DecryptedFile>;
}
