import { SiwxSession } from "../../types/auth.js";
import { SupportedChains } from "../../index.js";
import {
  OrbisEncryptionRules,
  OrbisEncryptionRulesOperator,
  TokenGatedEncryptionRule,
} from "../../types/encryption.js";
import {
  AccsDefaultParams,
  AccsSOLV2Params,
  UnifiedAccessControlConditions,
} from "@lit-protocol/types";
import { DIDPkh } from "../../types/common.js";
import { didToAddress } from "../../util/common.js";
import { OrbisError } from "../../util/results.js";
import { SignedSiwxMessage } from "../../types/siwx.js";

export const derivationMethods: Record<string, string> = {
  [SupportedChains.evm]: "web3.eth.personal.sign",
  [SupportedChains.solana]: "solana.signMessage",
};

export class LitSession {
  sig: string;
  derivedVia: string;
  signedMessage: string;
  address: string;
  chain: SupportedChains;

  constructor(params: SiwxSession) {
    const { siwx, chain } = params;
    this.derivedVia = derivationMethods[chain] || "unknown";
    this.sig = siwx.signature;
    this.address = siwx.message.address;
    this.signedMessage = siwx.serialized;
    this.chain = chain;
  }

  static fromSession(session: string) {
    const parsedSession: any = JSON.parse(session);

    const chain = Object.entries(derivationMethods).find(
      ([k, v]) => v === parsedSession.derivedVia
    );

    if (!chain?.length)
      throw new OrbisError(
        "Unknown derivation method " + parsedSession.derivedVia
      );

    return new LitSession({
      did: "",
      chain: chain[0] as SupportedChains,
      siwx: {
        serialized: parsedSession.signedMessage,
        signature: parsedSession.sig,
        message: {
          address: parsedSession.address,
        } as SignedSiwxMessage,
        resources: [],
      },
    });
  }

  serialize(): string {
    return JSON.stringify({
      sig: this.sig,
      derivedVia: this.derivedVia,
      signedMessage: this.signedMessage,
      address: this.address,
    });
  }
}

const generatedidAccessControlCondition = (dids: Array<DIDPkh>) => {
  const finalRules: UnifiedAccessControlConditions = [];
  for (const did of dids) {
    const didAddy = didToAddress(did);
    if ("error" in didAddy) continue;

    const { chain, address } = didAddy;
    if (chain === "ethereum") {
      finalRules.push({
        conditionType: "evmBasic",
        contractAddress: "",
        standardContractType: "",
        chain,
        method: "",
        parameters: [":userAddress"],
        returnValueTest: {
          comparator: "=",
          value: address,
        },
      });
    } else if (chain === "solana") {
      finalRules.push({
        conditionType: "solRpc",
        method: "",
        params: [":userAddress"],
        chain: "solana",
        pdaParams: [],
        pdaInterface: { offset: 0, fields: {} },
        pdaKey: "",
        returnValueTest: {
          key: "",
          comparator: "=",
          value: address,
        },
      });
    } else {
      // Ignore this rule as the recipient isn't using a supported network
      continue;
    }

    finalRules.push({
      operator: "or",
    });
  }

  // Remove last "or" operator
  return finalRules.slice(0, -1);
};

const generateTokenAccessControlCondition = (
  rule: TokenGatedEncryptionRule
) => {
  switch (rule.contractType) {
    case "ERC1155":
      return {
        conditionType: "evmBasic",
        contractAddress: rule.contractAddress,
        standardContractType: rule.contractType,
        chain: rule.chain,
        method: "balanceOf",
        parameters: [":userAddress", rule.tokenId],
        returnValueTest: {
          comparator: ">=",
          value: String(rule.minTokenBalance),
        },
      } as AccsDefaultParams;
    case "ERC721":
    case "ERC20":
      return {
        conditionType: "evmBasic",
        contractAddress: rule.contractAddress,
        standardContractType: rule.contractType,
        chain: rule.chain,
        method: "balanceOf",
        parameters: [":userAddress"],
        returnValueTest: {
          comparator: ">=",
          value: String(rule.minTokenBalance),
        },
      } as AccsDefaultParams;
    case "SolanaContract":
      return {
        method: "balanceOfToken",
        params: [rule.contractAddress],
        pdaParams: [],
        pdaInterface: { offset: 0, fields: {} },
        pdaKey: "",
        chain: "solana",
        returnValueTest: {
          key: "$.amount",
          comparator: ">=",
          value: String(rule.minTokenBalance),
        },
      } as AccsSOLV2Params;
  }
};

export const parseOrbisRules = (
  rules: Array<OrbisEncryptionRules | OrbisEncryptionRulesOperator>
) => {
  const accessControlConditions: UnifiedAccessControlConditions = [];

  for (const rule of rules) {
    if (!("type" in rule)) {
      accessControlConditions.push(rule);
      continue;
    }

    switch (rule.type) {
      case "custom":
        // TODO: UnifiedAccessControlConditions = | UnifiedAccessControlConditions
        // @ts-ignore
        accessControlConditions.push(rule.accessControlConditions);
        continue;
      case "dids":
        // TODO: UnifiedAccessControlConditions = | UnifiedAccessControlConditions
        // @ts-ignore
        // prettier-ignore
        accessControlConditions.push(generatedidAccessControlCondition(rule.dids));
        continue;
      case "token-gated":
        accessControlConditions.push(generateTokenAccessControlCondition(rule));
        continue;
    }
  }

  return accessControlConditions;
};

