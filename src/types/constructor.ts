import type { CeramicClient } from "@ceramicnetwork/http-client";
import { StoreConfig } from "./util.js";

export type CeramicConfig = { gateway: string } | { client: CeramicClient };

export type OrbisConfig = {
  storage?: CeramicConfig;
  indexer?: {
    api: string;
    gateway: string;
    key: string;
  };
  encryption?: boolean | "lit"; // TODO: | "cloudLit" | LitEncryptionConfig
  localStore?: StoreConfig;
};
