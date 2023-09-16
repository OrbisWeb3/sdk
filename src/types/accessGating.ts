import { DIDAny } from "./common.js";

export type TokenGatingRule = {
  type: "token";
  requiredToken: {
    chain: string;
    symbol: string;
    address: string;
    decimals: number | null;
    minBalance: string;
    token_id?: string;
    contract_type: "erc20" | "erc721" | "erc1155";
    attributes_required?: Array<Record<string, string>>;
  };
};

export type DIDGatingRule = {
  type: "did";
  authorizedUsers: Array<{ did: DIDAny; [k: string]: unknown }>;
};

export type CredentialGatingRule = {
  type: "credential";
  requiredCredentials: Array<{ identifier: string; [k: string]: unknown }>;
};

export type POAPGatingRule = {
  type: "poap";
  requiredPoap: {
    event_id: number;
  };
};

export type GatingRuleOperators = { operator: "or" };

export type AccessGatingRules =
  | TokenGatingRule
  | DIDGatingRule
  | CredentialGatingRule
  | POAPGatingRule
  | GatingRuleOperators;
