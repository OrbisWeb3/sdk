import { AccessGatingRules } from "../accessGating.js";
import { DIDAny, DIDKey, HttpsUrl } from "../common.js";

// TODO: Group vs Context in context_details

type EncryptedContent = {
  plain: string | null;
  encrypted: null | {
    encryptedString: string;
    encryptedSymmetricKey: string;
    unifiedControlConditions?: string;
    accessControlConditions?: string;
    solRpcConditions?: string;
  };
};

type ContextIntegrations = {
  discord?: {
    channel_id: string;
  };
};

export type IndexedVerifiedCredential = {
  id: number;
  identifier: string | null;
  name: string;
  description: string;
  family: string;
  type: string;
  issuer: {
    id: DIDKey;
    name: string;
  };
  credentialSubject: {
    id: DIDAny;
    [k: string]: unknown;
  };
  weight: number;
  created_at: number;
} & ExtraIndexedData;

type ExtraIndexedData = {
  data: Record<string, unknown>;
  raw: {
    [k: string]: unknown;
  };
};

type ExternalSocialCredential = {
  id: string;
  issuer: string;
  username: string;
  timestamp: number;
};

export type MinimalIndexedProfile = {
  did: DIDAny;
  username: string | null;
  description: string | null;
  pfp: {
    url: HttpsUrl | null;
    is_nft: boolean;
    nft: null | {
      chain: string;
      tokenId: string;
      contract: string;
      timestamp: number;
    };
  };
};

export type IndexedProfile = {
  did: DIDAny;
  username: string | null;
  description: string | null;
  pfp: {
    url: HttpsUrl | null;
    is_nft: boolean;
    nft: null | {
      chain: string;
      tokenId: string;
      contract: string;
      timestamp: number;
    };
  };
  email: {
    is_verified: boolean;
  } & EncryptedContent;
  socials: {
    github?: ExternalSocialCredential | null;
    twitter?: ExternalSocialCredential | null;
  };
  reputation: number;
  count_followers: number;
  count_following: number;
  onchain_metadata: {
    chain: string | null;
    address: string | null;
    ensName: string | null;
    nonces: {
      global: number | null;
      mainnet?: number | null;
      polygon?: number | null;
      arbitrum?: number | null;
      solana?: number | null;
      [k: string]: number | null | undefined;
    };
  };
  last_activity_timestamp: number;
  timestamp: number;
} & ExtraIndexedData;

type SocialPostMedia = {
  url: string;
  gateway?: string;
  resolvedUrl?: string;
};

type SocialMention = {
  did: DIDAny;
  username: string;
};

type SocialTag = {
  slug: string;
  title: string;
};

export type IndexedSocialPost = {
  id: string;
  type: null | string;
  creator: IndexedProfile;
  title: null | string;
  body: EncryptedContent;
  tags: Array<SocialTag>;
  media: Array<SocialPostMedia>;
  mentions: Array<SocialMention>;
  context: {
    id: string;
    details: Record<string, unknown>;
  } | null;
  master: {
    id: string;
  } | null;
  reply_to: {
    id: string;
    creator?: IndexedProfile;
    title?: string;
    body?: EncryptedContent;
    media?: Array<SocialPostMedia>;
    data?: Record<string, unknown>;
    context?: {
      id: string;
    };
  } | null;
  repost:
    | {
        id: string;
      }
    | IndexedSocialPost
    | null;
  indexing_metadata: {
    [k: string]: unknown;
  };
  engagement: {
    reactions: {
      likes: number;
      haha: number;
      downvotes: number;
    };
    replies: number;
    reposts: number;
  };
  commits: number;
  timestamp: number;
} & ExtraIndexedData;

export type IndexedContext = {
  id: string;
  creator: {
    did: DIDAny;
  };
  project: {
    id: string;
  };
  name: string;
  displayName: string;
  website: string | null;
  accessRules: Array<AccessGatingRules>;
  integrations: ContextIntegrations;
  created_at: number;
  context: null | {
    id: string;
  };
  is_deleted: boolean;
  last_post_timestamp: number;
} & ExtraIndexedData;

export type IndexedConversation = {
  id: string;
  context: {
    id: string;
  };
  name: EncryptedContent;
  description: EncryptedContent;
  recipients: Array<{
    did: string;
    profile?: Record<string, unknown> | null;
    onchain_metadata: {
      chain: string;
      address: string;
      ens?: string;
    };
  }>;
  creator: {
    did: string;
  };
  last_message_timestamp: number;
} & ExtraIndexedData;

export type IndexedMessage = {
  id: string;
  conversation: {
    id: string;
  };
  creator: IndexedProfile;
  body: EncryptedContent & { encryptedSolana?: EncryptedContent["encrypted"] };
  created_at: number;
  timestamp: number;
  reply_to: null | {
    id: string;
    details: any;
  };
  master: null | {
    id: string;
  };
  recipients: Array<DIDAny>;
} & ExtraIndexedData;

export type MinimalIndexedMessage = {
  conversation: {
    id: string;
  };
  creator: MinimalIndexedProfile;
  body: EncryptedContent & { encryptedSolana?: EncryptedContent["encrypted"] };
  reply_to: null | {
    id: string;
  };
  master: null | {
    id: string;
  };
} & ExtraIndexedData;

export type IndexedProject = {
  id: string;
  creator: {
    did: DIDAny;
  };
  name: string;
  website: null | string;
  members: Array<{
    did: DIDAny;
    permissions: {
      moderation?: boolean;
      manage_members?: boolean;
      manage_contexts?: boolean;
    };
  }>;
  is_archived: boolean;
  created_at: number;
} & ExtraIndexedData;

type NotificationViewStatus = {
  status: "viewed" | "new";
};

export type IndexedFollowNotification = {
  type: "social";
  family: "follow";
  follower: MinimalIndexedProfile & { is_following: boolean };
  following: {
    did: DIDAny;
  };
};

export type IndexedReactionNotification = {
  type: "social";
  family: "reaction";
  reaction: {
    user: MinimalIndexedProfile;
    type: "haha" | "like" | "downvote";
    post:
      | IndexedSocialPost
      | {
          id: string;
        };
  };
};

export type MinimalIndexedPost = {
  creator: MinimalIndexedProfile;
  id: string | null;
  master: null | {
    id: string;
  };
  context: null | {
    id: string;
  };
  reply_to: null | {
    id: string;
  };
  repost: null | {
    id: string;
  };
  body: EncryptedContent;
  mentions: Array<SocialMention>;
} & ExtraIndexedData;

export type IndexedMentionNotification = {
  type: "social";
  family: "mention";
  post: IndexedSocialPost | MinimalIndexedPost;
};

export type IndexedReplyNotification = {
  type: "social";
  family: "reply";
  post: IndexedSocialPost | MinimalIndexedPost;
};

export type IndexedMessageNotification = {
  type: "message";
  family: "mesage";
  message: MinimalIndexedMessage;
};

export type IndexedNotification = (
  | IndexedFollowNotification
  | IndexedReactionNotification
  | IndexedMentionNotification
  | IndexedReplyNotification
  | IndexedMessageNotification
) &
  NotificationViewStatus &
  ExtraIndexedData;
