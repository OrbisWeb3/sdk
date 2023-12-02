import { SiwxMessage } from "@didtools/cacao";
import { AuthUserInformation, IKeyDidAuth, IOrbisAuth } from "./auth.js";
import { OrbisResources } from "./resources.js";
import { SupportedChains } from "./providers.js";
import { DIDAny } from "./common.js";
import { PriorityIndexingResult } from "./indexer.js";

export type OrbisConnectParams = {
  auth: IOrbisAuth | IKeyDidAuth;
  siwxOverwrites?: Partial<SiwxMessage>;
  scopes?: Array<OrbisResources>;
};

export type OrbisConnectResult = {
  waitIndexing?: () => Promise<PriorityIndexingResult>;
  scopes: Array<string>;
  sessions: Record<OrbisResources, false | any>;
  user: AuthUserInformation;
  chain: SupportedChains;
};

export type OrbisPagination = {
  page?: number;
  limit?: number;
};

export type OrbisAlgorithms =
  | { algorithm: "recommendations" }
  | { algorithm: "all-posts" }
  | { algorithm: "all-master-posts"; contextId?: string }
  | { algorithm: "all-did-master-posts"; did?: DIDAny; contextId?: string }
  | { algorithm: "all-context-master-posts"; contextId?: string }
  | { algorithm: "all-posts-non-filtered" };

export type OrbisGetPosts = (
  | OrbisAlgorithms
  | {
      did?: DIDAny;
      tag?: string;
      onlyMaster?: boolean;
      contexts?: Array<string>;
      postMaster?: string;
      replyTo?: string;
      includeChildContexts?: boolean;
      searchTerm?: string;
      orderBy?: string;
      orderDirection?: "asc" | "desc";
    }
) & { decryptSilently?: boolean };

export type OrbisGetNotifications = {
  type: "social" | "messages";
  context?: string;
  conversationId?: string;
  lastReadTimestamp?: number;
  includeChildContexts?: boolean;
};
