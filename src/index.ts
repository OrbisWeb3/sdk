/** Types */
import {
  AuthUserInformation,
  IAsyncStore,
  OrbisConfig,
  OrbisConnectParams,
  OrbisConnectResult,
  IndexedSocialPost,
  SupportedChains,
  OrbisResources,
  OrbisSchemas,
  SocialPost,
  IAuthenticatedCeramicResource,
  SocialSettingsNotificationsRead,
  SocialReaction,
  SocialFollow,
  DIDPkh,
  SocialContext,
  SocialProject,
  SocialConversation,
  IndexedConversation,
  OrbisPagination,
  OrbisGetPosts,
  DIDAny,
  SocialProfile,
  SocialEncryptedEmail,
  SocialPrivateMessage,
  OrbisGetNotifications,
  IndexedProfile,
  IndexedMessage,
  IndexedContext,
  IndexedProject,
  IndexedNotification,
  SerializedOrbisSession,
} from "./types/index.js";
import {
  IOrbisEncryptionClient,
  OrbisEncryptionRules,
  OrbisEncryptionRulesOperator,
} from "./types/encryption.js";
import { IOrbisStorage } from "./types/storage.js";

/** Utils */
import { OrbisNodeClient } from "./indexer/index.js";
import { defaultConfig } from "./util/config.js";
import { Store } from "./util/store.js";
import { CeramicStorage } from "./storage/ceramic/ceramic.js";
import { LitEncryptionClient } from "./encryption/lit/lit.js";
import { OrbisError } from "./util/results.js";
import {
  formatPost,
  formatConversation,
  formatProfile,
  formatCredential,
  formatMessage,
  formatProject,
  formatContext,
  formatNotification,
} from "./formatters/index.js";
import { didToAddress } from "./util/common.js";
import { catchError } from "./util/tryit.js";
import {
  parseIndexedEncryptedContent,
  serializeEncryptedContent,
} from "./util/encryption.js";

import {
  LOCALSTORAGE_KEYS,
  THREE_MONTHS,
  VERIFIED_DIDS,
} from "./util/const.js";

// TODO: Check method parity, clean up interfaces (if dirty)
// TODO: Verify all exports, export necessary interfaces, types and methods
export class Orbis {
  #config: OrbisConfig;
  #store: IAsyncStore;

  readonly node: OrbisNodeClient;
  readonly storage: IOrbisStorage;
  encryption?: IOrbisEncryptionClient;
  user?: AuthUserInformation;

  constructor(config: OrbisConfig = defaultConfig) {
    if (!config.indexer) config.indexer = defaultConfig.indexer;

    // TODO: LitCloudClient
    if (config.encryption === true || config.encryption === "lit") {
      this.encryption = new LitEncryptionClient();
    }

    // TODO: Single storage type?
    this.storage = new CeramicStorage(config.storage || defaultConfig.storage);
    this.node = new OrbisNodeClient({
      api: config.indexer.api,
      host: config.indexer.gateway,
      key: config.indexer.key,
    });
    this.#store = new Store(config.localStore);
    this.#config = config;
  }

  get sessions() {
    return {
      [OrbisResources.encryption]: this.encryption && this.encryption.session,
      [OrbisResources.storage]: this.storage.session,
    } as Record<OrbisResources, false | SerializedOrbisSession>;
  }

  get scopes() {
    return Object.keys(
      Object.fromEntries(
        Object.entries(this.sessions).filter(([_, v]) => v !== false)
      )
    );
  }

  setEncryptionClient(encryption: OrbisConfig["encryption"]): void {
    if (encryption === false) {
      delete this.encryption;
      return;
    }

    if (encryption === true || encryption === "lit") {
      this.encryption = new LitEncryptionClient();
      return;
    }

    throw new OrbisError("Unknown encryption configuration.", { encryption });
  }

  /**
   * Session
   */

  requireSession(scopes?: Array<OrbisResources>) {
    if (!this.user) {
      throw new OrbisError(
        "This method requires user authentication, no active user session found."
      );
    }

    if (!scopes || !scopes.length) {
      return;
    }

    if (scopes.includes(OrbisResources.storage)) {
      if (!this.storage.session) {
        throw new OrbisError(
          "This method requires Storage scope, no active Storage session found."
        );
      }
    }

    if (scopes.includes(OrbisResources.encryption)) {
      if (!this.encryption) {
        throw new OrbisError(
          "This method requires Encryption, no Encryption instance found."
        );
      }
      if (!this.encryption.session) {
        throw new OrbisError(
          "This method requires Encryption scope, no active Encryption session found."
        );
      }
    }
  }

  async #serializeActiveSessions() {
    if (!this.user) {
      throw new OrbisError("No active user found. (this.user is falsey)", {
        user: this.user,
      });
    }

    return JSON.stringify({
      ...this.sessions,
      userInformation: this.user,
    });
  }

  async connectUser(params: OrbisConnectParams): Promise<OrbisConnectResult> {
    const { scopes = Object.values(OrbisResources), siwxOverwrites } = params;

    const { auth: authenticator } = params;
    const userInformation = await authenticator.getUserInformation();

    const storage = this.storage as IAuthenticatedCeramicResource;
    if (!(await storage.assertCurrentUser(userInformation))) {
      if (scopes.includes(OrbisResources.storage)) {
        await storage.authorize({ authenticator, siwxOverwrites });
      } else {
        console.warn("Resetting storage sessions, user mismatch", {
          current: this.storage.user,
          new: userInformation,
        });

        storage.clearSession();
      }
    }

    const encryption = this.encryption ? this.encryption : false;
    if (encryption) {
      if (!(await encryption.assertCurrentUser(userInformation))) {
        if (scopes.includes(OrbisResources.encryption)) {
          if ("authenticateSiwx" in authenticator) {
            await encryption.authorize({ authenticator, siwxOverwrites });
          } else {
            throw new OrbisError(
              "Encryption scope requires an authenticator with SIWX signing capabilities.",
              { authenticator, scopes }
            );
          }
        } else {
          console.warn(
            "Resetting encryption sessions, user mismatch or unsupported authenticator",
            { current: encryption.user, new: userInformation }
          );
          await encryption.clearSession();
        }
      }
    } else {
      if (scopes.includes(OrbisResources.encryption)) {
        throw new OrbisError(
          "Encryption scope provided, but no encryption client found.",
          { scopes, encryption }
        );
      }
    }

    const successfulSessions = this.sessions;
    const successfulScopes = Object.entries(successfulSessions)
      .map(([k, v]) => v && k)
      .filter((v) => v) as Array<string>;

    if (!successfulScopes.length) {
      throw new OrbisError(
        "No sessions created after authentication attempts.",
        { sessions: successfulSessions, scopes }
      );
    }

    this.user = userInformation;

    const serializedSessions = await this.#serializeActiveSessions();
    this.#store.setItem(LOCALSTORAGE_KEYS.session, serializedSessions);

    const indexingPromise = this.node.priorityIndexProfile({
      did: this.user.did,
    });

    return {
      waitIndexing: () => indexingPromise,
      scopes: successfulScopes,
      sessions: successfulSessions,
      user: this.user,
      chain: this.user.chain,
    };
  }

  async disconnectUser(): Promise<void> {
    this.encryption && (await this.encryption.clearSession());
    await this.storage.clearSession();

    this.user = undefined;

    this.#store.removeItem(LOCALSTORAGE_KEYS.session);
  }

  async isUserConnected(address?: string): Promise<boolean> {
    if (this.user) {
      if (address) {
        const userAddress = this.user.metadata.address;
        if (!userAddress) {
          return false;
        }

        if (this.user.chain === SupportedChains.evm) {
          return userAddress.toLowerCase() === address.toLowerCase();
        }

        return userAddress === address;
      }
      return true;
    }

    const session = await this.#store.getItem(LOCALSTORAGE_KEYS.session);
    if (!session) {
      return false;
    }

    const [parsed, err] = await catchError(() => JSON.parse(session));
    if (err) {
      this.#store.removeItem(LOCALSTORAGE_KEYS.session);
      console.warn("Error occured while parsing JSON", err);
      return false;
    }

    const user = (
      typeof parsed.userInformation === "string"
        ? JSON.parse(parsed.userInformation)
        : parsed.userInformation
    ) as AuthUserInformation;

    if (!user) {
      this.#store.removeItem(LOCALSTORAGE_KEYS.session);
      console.warn("Unable to parse user information from a saved session.");
      return false;
    }

    const storageSession = parsed[OrbisResources.storage] || {};
    if (storageSession) {
      const [_, err] = await catchError(() =>
        this.storage.setSession({
          user,
          session: storageSession,
        })
      );

      if (err) console.warn(err);
    }

    const encryptionSession = parsed[OrbisResources.encryption] || {};
    if (this.encryption) {
      if (encryptionSession) {
        const [_, err] = await catchError(() =>
          (this.encryption as IOrbisEncryptionClient).setSession({
            user,
            session: encryptionSession,
          })
        );

        if (err) console.warn(err);
      }
    }

    const successfulSessions = this.sessions;
    const successfulScopes = Object.entries(successfulSessions)
      .map(([k, v]) => v && k)
      .filter((v) => v) as Array<string>;

    if (!successfulScopes.length) {
      console.warn(
        new OrbisError("No sessions created.", {
          sessions: successfulSessions,
        })
      );
      return false;
    }

    this.user = user;
    this.#store.setItem(
      LOCALSTORAGE_KEYS.session,
      await this.#serializeActiveSessions()
    );

    if (!this.user) {
      return false;
    }

    if (address) {
      const userAddress = this.user.metadata.address;
      if (!userAddress) {
        return false;
      }

      if (this.user.chain === SupportedChains.evm) {
        return userAddress.toLowerCase() === address.toLowerCase();
      }

      return userAddress === address;
    }

    return true;
  }

  async getConnectedUser(): Promise<OrbisConnectResult | false> {
    if (!(await this.isUserConnected())) {
      return false;
    }

    if (this.user)
      return {
        scopes: Object.entries(this.sessions)
          .map(([k, v]) => v && k)
          .filter((v) => v) as Array<string>,
        sessions: this.sessions,
        user: this.user,
        chain: this.user.chain,
      };

    return false;
  }

  /**
   * Profiles
   */

  async updateProfile(profile: SocialProfile) {
    this.requireSession([OrbisResources.storage]);

    const { id } = await this.storage.createDocument({
      content: profile,
      metadata: {
        tags: ["orbis", "profile"],
        family: "orbis",
        schema: OrbisSchemas.profile.commit,
      },
    });

    const indexingPromise = this.node.priorityIndexDocument({ id });

    return {
      id,
      waitIndexing: () => indexingPromise,
    };
  }

  async setProfileEmail(email: string) {
    this.requireSession([OrbisResources.encryption, OrbisResources.storage]);
    if (!email) {
      throw new OrbisError("Email can't be empty.", { email });
    }

    const encryptedEmail = await (
      this.encryption as IOrbisEncryptionClient
    ).encryptString({
      string: email,
      encryptionRules: [
        {
          type: "dids",
          dids: [VERIFIED_DIDS.ORBIS_NODE, this.user?.did as DIDPkh],
        },
      ],
    });

    const formatEncryptedEmail: SocialEncryptedEmail = {
      encryptedEmail: serializeEncryptedContent(encryptedEmail),
    };

    const { id } = await this.storage.createDocument({
      content: formatEncryptedEmail,
      metadata: {
        tags: ["orbis", "email"],
        family: "orbis",
        schema: OrbisSchemas.encryptedProfileEmail.commit,
      },
    });

    const indexingPromise = this.node.priorityIndexDocument({ id });

    return {
      encryptedEmail: formatEncryptedEmail.encryptedEmail,
      waitIndexing: () => indexingPromise,
    };
  }

  async getProfile(did: DIDAny): Promise<IndexedProfile> {
    const { data, error, status } = await this.node.client
      .from("orbis_v_profiles")
      .select()
      .ilike("did", did)
      .single();

    if (error || !data) {
      throw new OrbisError(`Error fetching profile (${did}).`, {
        error,
        status,
        did,
      });
    }

    return formatProfile(data);
  }

  async getAddressDids(address: string): Promise<Array<DIDPkh>> {
    const data = await this.getProfilesByAddress(address);

    return data.map((v) => v.did as DIDPkh);
  }

  async getProfilesByAddress(address: string): Promise<Array<IndexedProfile>> {
    const { data, error, status } = await this.node.client
      .from("orbis_v_profiles")
      .select()
      .ilike("address", address);

    if (error || !data) {
      throw new OrbisError(`Error fetching DIDs for wallet (${address}).`, {
        error,
        status,
        address,
      });
    }

    return data.map((v: any) => formatProfile(v));
  }

  async getProfilesByUsername(
    username: string
  ): Promise<Array<IndexedProfile>> {
    const { data, error, status } = await this.node.client
      .from("orbis_v_profiles")
      .select()
      .ilike("username", `${username}%`)
      .range(0, 10)
      .order("timestamp", { ascending: false });

    if (error || !data) {
      throw new OrbisError(
        `Error fetching profiles for given username (${username}).`,
        { error, status, username }
      );
    }

    return data.map((v: any) => formatProfile(v));
  }

  async getCredentials(
    did: DIDAny,
    params: { issuer?: string; minWeight?: number; offset?: number } = {}
  ) {
    const { issuer = null, minWeight = 0, offset = 0 } = params;

    const { data, error, status } = await this.node.client.rpc(
      "get_verifiable_credentials",
      {
        q_subject: did,
        q_min_weight: minWeight,
        q_offset: offset,
      }
    );

    if (!data || error)
      throw new OrbisError(
        `Unable to fetch credentials for profile (${did}).`,
        { error, status, did, params }
      );

    return data.map((v: any) => formatCredential(v));
  }

  /**
   * Followers
   */

  async follow(did: DIDPkh) {
    this.requireSession([OrbisResources.storage]);
    if (!did) {
      throw new OrbisError("Missing Profile did to follow.");
    }

    const { id } = await this.storage.createDocument({
      content: {
        did: did,
        active: true,
      } as SocialFollow,
      metadata: {
        tags: ["orbis", "follow"],
        family: "orbis",
        schema: OrbisSchemas.follow.commit,
      },
    });

    const indexingPromise = this.node.priorityIndexDocument({ id });

    return {
      id,
      waitIndexing: () => indexingPromise,
    };
  }

  async unfollow(did: DIDPkh) {
    this.requireSession([OrbisResources.storage]);
    if (!did) {
      throw new OrbisError("Missing Profile did to unfollow.");
    }

    const { id } = await this.storage.createDocument({
      content: {
        did: did,
        active: false,
      } as SocialFollow,
      metadata: {
        tags: ["orbis", "follow"],
        family: "orbis",
        schema: OrbisSchemas.follow.commit,
      },
    });

    const indexingPromise = this.node.priorityIndexDocument({ id });

    return {
      id,
      waitIndexing: () => indexingPromise,
    };
  }

  async getProfileFollowers(did: DIDAny) {
    const { data, error, status } = await this.node.client
      .from("orbis_v_followers")
      .select("details:did_following_details")
      .match({ did_followed: did, active: "true" });

    if (error || !data)
      throw new OrbisError(
        `Error fetching profile followers (${did}).`,
        { error, result: data },
        status
      );

    return data.map((v: any) => formatProfile({ ...v, ...v.details }));
  }

  async getProfileFollowing(did: DIDAny) {
    const { data, error, status } = await this.node.client
      .from("orbis_v_followers")
      .select("details:did_followed_details")
      .match({ did_following: did, active: "true" });

    if (error || !data)
      throw new OrbisError(
        `Error fetching profile following (${did}).`,
        { error, result: data },
        status
      );

    return data.map((v: any) => formatProfile({ ...v, ...v.details }));
  }

  async getIsProfileFollowing(profileDid: DIDAny, followingDid: DIDAny) {
    const { data, error, status } = await this.node.client
      .from("orbis_v_followers")
      .select()
      .match({
        did_following: profileDid,
        did_followed: followingDid,
        active: "true",
      });

    if (error || !data)
      throw new OrbisError(
        `Error fetching profile following status (${profileDid}, ${followingDid}).`,
        { error, result: data },
        status
      );

    return data.length > 0;
  }

  /**
   * Posts
   */

  async #upsertPost(
    postId: string | false = false,
    post: SocialPost & {
      encryptionRules?: Array<
        OrbisEncryptionRules | OrbisEncryptionRulesOperator
      >;
    }
  ) {
    this.requireSession([OrbisResources.storage]);

    const { encryptionRules = [] } = post;
    delete post.encryptionRules;

    if (encryptionRules.length) {
      this.requireSession([OrbisResources.encryption]);

      const string = post.body;
      if (!string) {
        throw new OrbisError(
          "Unable to encrypt post. Post has no content (body)."
        );
      }

      const encrypted = await (
        this.encryption as IOrbisEncryptionClient
      ).encryptString({ string, encryptionRules });
      post.body = null;
      post.encryptedBody = serializeEncryptedContent(encrypted);
    }

    const { id } =
      typeof postId === "string" && postId
        ? await this.storage.updateDocument(postId, {
            content: post,
            metadata: {
              schema: OrbisSchemas.post.commit,
              family: "orbis",
              tags: ["orbis", "post"],
            },
          })
        : await this.storage.createDocument({
            content: post,
            metadata: {
              schema: OrbisSchemas.post.commit,
              family: "orbis",
              tags: ["orbis", "post"],
            },
          });

    const indexingPromise = this.node.priorityIndexDocument({ id });

    return {
      id,
      waitIndexing: () => indexingPromise,
    };
  }

  async createPost(
    post: SocialPost & {
      encryptionRules?: Array<
        OrbisEncryptionRules | OrbisEncryptionRulesOperator
      >;
    }
  ) {
    return this.#upsertPost(false, post);
  }

  async updatePost(
    postId: string,
    post: SocialPost & {
      encryptionRules?: Array<
        OrbisEncryptionRules | OrbisEncryptionRulesOperator
      >;
    }
  ) {
    return this.#upsertPost(postId, post);
  }

  async deletePost(postId: string) {
    return this.#upsertPost(postId, {
      is_deleted: true,
      body: "",
    });
  }

  async getPost(
    postId: string,
    params?: { decryptSilently?: boolean }
  ): Promise<IndexedSocialPost> {
    const { data, error, status } = await this.node.client
      .from("orbis_v_posts_v2")
      .select()
      .eq("stream_id", postId)
      .single();

    if (error || !data)
      throw new OrbisError(
        `Error fetching post (${postId}).`,
        { error, result: data },
        status
      );

    const post = formatPost(data);

    if (post.body.encrypted) {
      if (
        !params ||
        typeof params.decryptSilently === "undefined" ||
        params.decryptSilently === true
      ) {
        const [decryptedPost, err] = await catchError(() =>
          this.decryptPost(post)
        );
        if (err) {
          console.warn(err);
        } else {
          return decryptedPost;
        }
      }
    }

    return post;
  }

  async getPosts(
    params: OrbisGetPosts & OrbisPagination = {}
  ): Promise<Array<IndexedSocialPost>> {
    const page = Math.max(params.page || 0, 0);
    const limit = Math.min(Math.max(params.limit || 50, 0), 100);

    let query;

    if ("algorithm" in params) {
      switch (params.algorithm) {
        case "all-context-master-posts":
          query = this.node.client
            .rpc("all_context_master_posts", { post_context: params.contextId })
            .range(page * limit, (page + 1) * limit - 1);
          break;
        case "all-did-master-posts":
          query = this.node.client
            .rpc("all_did_master_posts_with_context", {
              post_did: params.did,
              post_context: params.contextId,
            })
            .range(page * limit, (page + 1) * limit - 1);
          break;
        case "all-master-posts":
          query = this.node.client
            .rpc("all_master_posts")
            .range(page * limit, (page + 1) * limit - 1);
          break;
        case "all-posts":
          query = this.node.client
            .rpc("all_posts")
            .range(page * limit, (page + 1) * limit - 1);
          break;
        case "all-posts-non-filtered":
          query = this.node.client
            .rpc("all_posts_non_filtered")
            .range(page * limit, (page + 1) * limit - 1);
          break;
        case "recommendations":
          query = this.node.client
            .rpc("orbis_recommendations", {
              user_did: (this.user && this.user.did) || "none",
            })
            .range(page * limit, (page + 1) * limit - 1);
          break;
      }
    }

    if (!query) {
      query = this.node.client
        .rpc("default_posts_09", {
          q_did: ("did" in params && params.did) || null,
          q_tag: ("tag" in params && params.tag) || null,
          q_only_master:
            "onlyMaster" in params ? Boolean(params.onlyMaster) : false,
          ...("contexts" in params &&
          typeof params.contexts !== "undefined" &&
          params.contexts.length
            ? params.contexts.length === 1
              ? {
                  q_context: params.contexts[0],
                }
              : {
                  q_contexts: params.contexts,
                }
            : {}),
          q_master: ("postMaster" in params && params.postMaster) || null,
          q_reply_to: ("replyTo" in params && params.replyTo) || null,
          q_include_child_contexts:
            "includeChildContexts" in params
              ? Boolean(params.includeChildContexts)
              : false,
          q_term: ("searchTerm" in params && params.searchTerm) || null,
        })
        .range(page * limit, (page + 1) * limit - 1)
        .order(("orderBy" in params && params.orderBy) || "timestamp", {
          ascending:
            "orderDirection" in params && params.orderDirection === "asc",
        });
    }

    const { data, error, status } = await query;
    if (error || !data)
      throw new OrbisError(
        `Error fetching posts.`,
        { error, result: data, params },
        status
      );

    const decryptSilently: boolean =
      !params ||
      typeof params.decryptSilently === "undefined" ||
      params.decryptSilently === true;

    return (
      await Promise.all(
        data.map(async (v: any) => {
          try {
            const post = formatPost(v);
            if (post.body.encrypted && decryptSilently) {
              const [decryptedPost, err] = await catchError(() =>
                this.decryptPost(post)
              );
              if (err) {
                console.warn(err);
              } else {
                return decryptedPost;
              }
            }

            return post;
          } catch (error) {
            console.error("Error formatting post", { error });
            return { error: error || true };
          }
        })
      )
    ).filter((v) => typeof v.error === "undefined");
  }

  async decryptPost(post: IndexedSocialPost): Promise<IndexedSocialPost> {
    this.requireSession([OrbisResources.encryption]);

    const encryptedBody = post.body.encrypted;
    if (!encryptedBody) {
      return {
        ...post,
      };
    }

    const [decryptedPost, error] = await catchError(() =>
      (this.encryption as IOrbisEncryptionClient).decryptString(
        parseIndexedEncryptedContent(encryptedBody)
      )
    );

    if (error || !decryptedPost) {
      throw new OrbisError("Unable to decrypt post.", {
        error,
        decryptedPost,
        post,
      });
    } else {
      return {
        ...post,
        body: {
          plain: decryptedPost.decryptedContent,
          encrypted: encryptedBody,
        },
      };
    }
  }

  /**
   * Reactions
   */

  async react(postId: string, type: "haha" | "like" | "downvote" = "like") {
    this.requireSession([OrbisResources.storage]);
    if (!postId) {
      throw new OrbisError("postId cannot be empty.");
    }

    const { id } = await this.storage.createDocument({
      content: {
        post_id: postId,
        type,
      } as SocialReaction,
      metadata: {
        tags: ["orbis", "reaction"],
        family: "orbis",
        schema: OrbisSchemas.reaction.commit,
      },
    });

    const indexingPromise = this.node.priorityIndexDocument({ id });

    return {
      id,
      waitIndexing: () => indexingPromise,
    };
  }

  async getUserReaction(postId: string, did: DIDAny) {
    const { data, error, status } = await this.node.client
      .from("orbis_reactions")
      .select("type")
      .eq("post_id", postId)
      .eq("creator", did);

    if (error || !data)
      throw new OrbisError(
        `Error fetching reactions for post (${postId}).`,
        { error, result: data },
        status
      );

    return {
      user: {
        did,
      },
      post: {
        id: postId,
      },
      reaction: data.length ? data[0].type : null,
    };
  }

  /**
   * Conversations
   */

  async #upsertConversation(
    conversationId: string | false = false,
    conversation: SocialConversation
  ) {
    this.requireSession([OrbisResources.encryption, OrbisResources.storage]);

    const recipients = Array.from(
      new Set([...(conversation.recipients || []), this.user?.did as string])
    );
    for (const recipient of recipients) {
      const address = didToAddress(recipient);
      if ("error" in address) {
        throw new OrbisError(
          "Error creating a conversation, error parsing recipient information",
          { recipient: { did: recipient }, recipients, error: address.error }
        );
      }

      if (
        ![SupportedChains.evm, SupportedChains.solana].includes(address.chain)
      ) {
        throw new OrbisError(
          "Error creating a conversation, invalid recipient chain.",
          {
            recipient: { did: recipient, ...address },
            recipients,
            supportedChains: [SupportedChains.evm, SupportedChains.solana],
          }
        );
      }
    }

    const encryptionRules: Array<OrbisEncryptionRules> = [
      {
        type: "dids",
        dids: recipients as Array<DIDPkh>,
      },
    ];

    if (conversation.name) {
      conversation.encryptedName = serializeEncryptedContent(
        await (this.encryption as IOrbisEncryptionClient).encryptString({
          string: conversation.name,
          encryptionRules,
        })
      );

      delete conversation.name;
    }

    if (conversation.description) {
      conversation.encryptedDescription = serializeEncryptedContent(
        await (this.encryption as IOrbisEncryptionClient).encryptString({
          string: conversation.description,
          encryptionRules,
        })
      );

      delete conversation.description;
    }

    const { id } =
      typeof conversationId === "string" && conversationId
        ? await this.storage.updateDocument(conversationId, {
            content: { ...conversation, recipients } as SocialConversation,
            metadata: {
              tags: ["orbis", "conversation"],
              family: "orbis",
              schema: OrbisSchemas.conversation.commit,
            },
          })
        : await this.storage.createDocument({
            content: { ...conversation, recipients } as SocialConversation,
            metadata: {
              tags: ["orbis", "conversation"],
              family: "orbis",
              schema: OrbisSchemas.conversation.commit,
            },
          });

    const indexingPromise = this.node.priorityIndexDocument({ id });

    return {
      id,
      waitIndexing: () => indexingPromise,
    };
  }

  async createConversation(conversation: SocialConversation) {
    return this.#upsertConversation(false, conversation);
  }

  async updateConversation(
    conversationId: string,
    conversation: SocialConversation
  ) {
    return this.#upsertConversation(conversationId, conversation);
  }

  async getConversation(
    conversationId: string,
    params: { decryptSilently?: boolean } = {}
  ): Promise<IndexedConversation> {
    const { data, error, status } = await this.node.client
      .from("orbis_v_conversations")
      .select()
      .eq("stream_id", conversationId)
      .single();

    if (error || !data)
      throw new OrbisError(
        `Error fetching conversation (${conversationId}).`,
        { error, result: data },
        status
      );

    const conversation = formatConversation(data);

    if (
      typeof params.decryptSilently === "undefined" ||
      params.decryptSilently === true
    ) {
      const [decryptedConversation, error] = await catchError(() =>
        this.decryptConversation(conversation)
      );

      if (error) {
        console.warn(error);
      } else {
        return decryptedConversation;
      }
    }

    return conversation;
  }

  async getConversations(
    did: DIDPkh,
    params: { context?: string; decryptSilently?: boolean } = {}
  ): Promise<Array<IndexedConversation>> {
    const query = this.node.client
      .from("orbis_v_conversations")
      .select()
      .filter("recipients", "cs", `["${did}"]`);

    const { data, error, status } = await (params.context
      ? query.eq("context", params.context)
      : query
    ).order("last_message_timestamp", { ascending: false });

    if (error || !data)
      throw new OrbisError(
        `Error fetching conversations for user (${did}).`,
        { error, result: data, did, params },
        status
      );

    const decryptSilently =
      typeof params.decryptSilently === "undefined" ||
      params.decryptSilently === true;

    return await Promise.all(
      data.map(async (v: any) => {
        const conversation = formatConversation(v);
        if (decryptSilently) {
          const [decryptedConversation, error] = await catchError(() =>
            this.decryptConversation(conversation)
          );

          if (error) {
            console.warn(error);
          } else {
            return decryptedConversation;
          }
        }

        return conversation;
      })
    );
  }

  async decryptConversation(
    conversation: IndexedConversation
  ): Promise<IndexedConversation> {
    this.requireSession([OrbisResources.encryption]);

    const encryptedName = conversation.name.encrypted;
    if (encryptedName) {
      const [decryptedName, error] = await catchError(() =>
        (this.encryption as IOrbisEncryptionClient).decryptString(
          parseIndexedEncryptedContent(encryptedName)
        )
      );

      if (decryptedName) {
        conversation.name.plain = decryptedName.decryptedContent;
      } else {
        console.warn(error);
      }
    }

    const encryptedDescription = conversation.description.encrypted;
    if (encryptedDescription) {
      const [decryptedDescription, error] = await catchError(() =>
        (this.encryption as IOrbisEncryptionClient).decryptString(
          parseIndexedEncryptedContent(encryptedDescription)
        )
      );

      if (decryptedDescription) {
        conversation.description.plain = decryptedDescription.decryptedContent;
      } else {
        console.warn(error);
      }
    }

    return conversation;
  }

  /**
   * Messages
   */

  async #upsertMessage(
    messageId: string | false = false,
    message: SocialPrivateMessage & { body: string }
  ) {
    this.requireSession([OrbisResources.storage, OrbisResources.encryption]);

    const conversationId = message.conversation_id;
    const body = message.body;

    if (!body || !body.length) {
      throw new OrbisError("Error sending message, no body provided.", {
        message,
        body,
        conversationId,
      });
    }

    if (!conversationId) {
      throw new OrbisError(
        "Error sending message, no conversation ID provided.",
        { message, body, conversationId }
      );
    }

    const [conversation, error] = await catchError(() =>
      this.getConversation(conversationId)
    );
    if (!conversation || error) {
      throw new OrbisError(
        "Error sending message, unable to fetch conversation",
        { message, body, conversationId, conversation, error }
      );
    }

    const recipients = [
      ...(conversation.recipients.map((user) => user.did as DIDPkh) || []),
      this.user?.did as DIDPkh,
    ];
    if (!recipients || !recipients.length) {
      throw new OrbisError("Error sending message, no recipients found");
    }

    const encryptedContent = await (
      this.encryption as IOrbisEncryptionClient
    ).encryptString({
      string: body,
      encryptionRules: [
        {
          type: "dids",
          dids: recipients,
        },
      ],
    });

    const encryptedSocialMessage: SocialPrivateMessage = {
      conversation_id: conversationId,
      encryptedMessage: serializeEncryptedContent(encryptedContent),
      data: message.data || {},
    };

    const { id } =
      typeof messageId === "string" && messageId
        ? await this.storage.updateDocument(messageId, {
            content: encryptedSocialMessage,
            metadata: {
              tags: ["orbis", "message"],
              family: "orbis",
              schema: OrbisSchemas.message.commit,
            },
          })
        : await this.storage.createDocument({
            content: encryptedSocialMessage,
            metadata: {
              tags: ["orbis", "message"],
              family: "orbis",
              schema: OrbisSchemas.message.commit,
            },
          });

    const indexingPromise = this.node.priorityIndexDocument({ id });

    return {
      id,
      waitIndexing: () => indexingPromise,
    };
  }

  async sendMessage(message: SocialPrivateMessage & { body: string }) {
    return this.#upsertMessage(false, message);
  }

  async updateMessage(
    messageId: string,
    message: SocialPrivateMessage & { body: string }
  ) {
    return this.#upsertMessage(messageId, message);
  }

  async getMessage(
    messageId: string,
    params: { decryptSilently?: boolean } = { decryptSilently: true }
  ) {
    const { data, error, status } = await this.node.client
      .from("orbis_v_messages")
      .select()
      .eq("stream_id", messageId)
      .single();

    if (error || !data)
      throw new OrbisError(
        `Error fetching message (${messageId}).`,
        { error, result: data, messageId, params },
        status
      );

    const decryptSilently =
      typeof params.decryptSilently === "undefined" ||
      params.decryptSilently === true;

    const message = formatMessage(data);

    if (decryptSilently) {
      const [decryptedMessage, error] = await catchError(() =>
        this.decryptMessage(message)
      );

      if (error) {
        console.warn(error);
      } else {
        return decryptedMessage;
      }
    }

    return message;
  }

  async getMessages(
    conversationId: string,
    params: OrbisPagination & { decryptSilently?: boolean } = {
      page: 0,
      limit: 50,
      decryptSilently: true,
    }
  ): Promise<Array<IndexedMessage>> {
    const limit = Math.min(Math.max(params.limit || 50, 0), 100);
    const page = Math.max(params.page || 0, 0);

    const { data, error, status } = await this.node.client
      .from("orbis_v_messages")
      .select()
      .eq("conversation_id", conversationId)
      .range(page * limit, (page + 1) * limit - 1);

    if (error || !data)
      throw new OrbisError(
        `Error fetching messages for conversation (${conversationId}).`,
        { error, result: data, conversationId, params },
        status
      );

    const decryptSilently =
      typeof params.decryptSilently === "undefined" ||
      params.decryptSilently === true;

    return await Promise.all(
      data.map(async (m: any) => {
        const message = formatMessage(m);

        if (decryptSilently) {
          const [decryptedMessage, error] = await catchError(() =>
            this.decryptMessage(message)
          );

          if (error) {
            console.warn(error);
          } else {
            return decryptedMessage;
          }
        }

        return message;
      })
    );
  }

  async decryptMessage(message: IndexedMessage): Promise<IndexedMessage> {
    this.requireSession([OrbisResources.encryption]);

    const { encrypted: encryptedMessageEVM, encryptedSolana } = message.body;

    const encryptedMessage =
      (this.user as AuthUserInformation).chain === SupportedChains.solana
        ? encryptedSolana || encryptedMessageEVM
        : encryptedMessageEVM;

    if (!encryptedMessage) {
      throw new OrbisError(
        "Unable to get encrypted message metadata, make sure you're on the right chain.",
        { encryptedMessage }
      );
    }

    const [decryptedMessage, error] = await catchError(() =>
      (this.encryption as IOrbisEncryptionClient).decryptString(
        parseIndexedEncryptedContent(encryptedMessage)
      )
    );

    if (!decryptedMessage || error) {
      throw new OrbisError("Unable to decrypt message.", {
        error,
        decryptedMessage,
        message,
      });
    }

    return {
      ...message,
      body: {
        ...message.body,
        plain: decryptedMessage.decryptedContent,
      },
    };
  }

  /**
   * Notifications
   */

  async setReadNotifications(
    type: "social" | "messages",
    { context }: { context?: string }
  ) {
    this.requireSession([OrbisResources.storage]);
    if (!type) {
      throw new OrbisError("Missing notification type.", { type, context });
    }

    const { id } = await this.storage.createDocument({
      content: {
        last_notifications_read_time: Math.floor(Date.now() / 1000),
        ...((context && { context }) || {}),
      } as SocialSettingsNotificationsRead,
      metadata: {
        tags: ["orbis", "settings", "notifications", type],
        family: "orbis",
        schema: OrbisSchemas.notificationReadTime.commit,
      },
    });

    const indexingPromise = this.node.priorityIndexDocument({ id });

    return {
      id,
      waitIndexing: () => indexingPromise,
    };
  }

  async getNotifications(
    params: OrbisGetNotifications
  ): Promise<Array<IndexedNotification>> {
    this.requireSession([OrbisResources.storage]);

    const {
      type,
      context = null,
      conversationId = null,
      lastReadTimestamp = Date.now() - THREE_MONTHS,
      includeChildContexts = false,
    } = params;

    if (!type || !["social", "messages"].includes(type)) {
      throw new OrbisError("Missing or invalid notification type.", {
        type,
        params,
      });
    }

    const { data, error, status } = await this.node.client.rpc(
      "orbis_f_notifications_02",
      {
        user_did:
          "did:pkh:eip155:1:0x075286d1a22b083ebcaf6b7fb4cf970cfc4a18f0" ||
          (this.user as AuthUserInformation).did,
        notif_type: type,
        q_context: context,
        q_conversation_id: conversationId,
        q_last_read: Math.floor(Number(lastReadTimestamp) / 1000),
        q_include_child_contexts: Boolean(includeChildContexts),
      }
    );

    if (error || !data) {
      throw new OrbisError(
        `Error fetching notifications for user (${
          (this.user as AuthUserInformation).did
        }).`,
        { error, result: data, params },
        status
      );
    }

    return data.map((v: any) => formatNotification(v));
  }

  async getNotificationsCount(params: OrbisGetNotifications) {
    this.requireSession([OrbisResources.storage]);

    const {
      type,
      context = null,
      conversationId = null,
      lastReadTimestamp = 0,
      includeChildContexts = false,
    } = params;

    if (!type || !["social", "messages"].includes(type)) {
      throw new OrbisError("Missing or invalid notification type.", {
        type,
        params,
      });
    }

    const { data, error, status } = await this.node.client.rpc(
      "orbis_f_count_notifications_02",
      {
        user_did: (this.user as AuthUserInformation).did,
        notif_type: type,
        q_context: context,
        q_conversation_id: conversationId,
        q_last_read: Math.floor(Number(lastReadTimestamp) / 1000),
        q_include_child_contexts: Boolean(includeChildContexts),
      }
    );

    if (error || !data) {
      throw new OrbisError(
        `Error fetching notification count for user (${
          (this.user as AuthUserInformation).did
        }).`,
        { error, result: data, params },
        status
      );
    }

    const count = data.length === 0 ? 0 : data[0].count_new_notifications;

    return {
      user: {
        did: (this.user as AuthUserInformation).did,
      },
      type,
      count,
    };
  }

  /**
   * Projects
   */

  async createProject(project: SocialProject) {
    this.requireSession([OrbisResources.storage]);

    const { id } = await this.storage.createDocument({
      content: project,
      metadata: {
        tags: ["orbis", "project"],
        family: "orbis",
        schema: OrbisSchemas.project.commit,
      },
    });

    const indexingPromise = this.node.priorityIndexDocument({ id });

    return {
      id,
      waitIndexing: () => indexingPromise,
    };
  }

  async updateProject(projectId: string, project: SocialProject) {
    this.requireSession([OrbisResources.storage]);

    const { id } = await this.storage.updateDocument(projectId, {
      content: project,
      metadata: {
        tags: ["orbis", "project"],
        family: "orbis",
        schema: OrbisSchemas.project.commit,
      },
    });

    return {
      id,
      promise: this.node.priorityIndexDocument({ id }),
    };
  }

  async getProject(projectId: string) {
    const { data, status, error } = await this.node.client
      .from("orbis_projects")
      .select()
      .eq("stream_id", projectId)
      .single();
    if (!data || error) {
      throw new OrbisError(`Unable to fetch project (${projectId}).`, {
        projectId,
        result: data,
        error,
        status,
      });
    }

    return formatProject(data);
  }

  async getProjects(did: DIDAny): Promise<Array<IndexedProject>> {
    const { data, status, error } = await this.node.client
      .from("orbis_projects")
      .select()
      .eq("creator", did);
    if (!data || error) {
      throw new OrbisError(`Unable to fetch project for DID (${did}).`, {
        did,
        result: data,
        error,
        status,
      });
    }

    return data.map((v: any) => formatProject(v));
  }

  /**
   * Contexts
   */

  async #upsertContext(
    contextId: string | false = false,
    context: SocialContext
  ) {
    this.requireSession([OrbisResources.storage]);

    const { id } =
      typeof contextId === "string" && contextId
        ? await this.storage.updateDocument(contextId, {
            content: context,
            metadata: {
              tags: ["orbis", "context"],
              family: "orbis",
              schema: OrbisSchemas.context.commit,
            },
          })
        : await this.storage.createDocument({
            content: context,
            metadata: {
              tags: ["orbis", "context"],
              family: "orbis",
              schema: OrbisSchemas.context.commit,
            },
          });

    const indexingPromise = this.node.priorityIndexDocument({ id });

    return {
      id,
      waitIndexing: () => indexingPromise,
    };
  }

  async createContext(context: SocialContext) {
    return this.#upsertContext(false, context);
  }

  async updateContext(contextId: string, context: SocialContext) {
    return this.#upsertContext(contextId, context);
  }

  async deleteContext(contextId: string, projectId: string) {
    this.requireSession([OrbisResources.storage]);

    projectId ||= (await this.getContext(contextId)).project.id || "";
    if (!projectId)
      console.warn("Context is missing projectId, indexing issues can occur.");

    return this.#upsertContext(contextId, {
      name: "deleted_context",
      project_id: projectId,
      is_deleted: true,
    });
  }

  async getContext(contextId: string) {
    const { data, error, status } = await this.node.client
      .from("orbis_contexts")
      .select()
      .eq("stream_id", contextId)
      .single();

    if (error || !data)
      throw new OrbisError(
        `Error fetching context (${contextId}).`,
        { error, result: data, contextId, params: {} },
        status
      );

    return formatContext(data);
  }

  async getContexts(projectId: string): Promise<Array<IndexedContext>> {
    const { data, error, status } = await this.node.client.rpc(
      "get_contexts_with_children",
      { project_id: projectId }
    );

    if (error || !data)
      throw new OrbisError(
        `Error fetching contexts for project (${projectId}).`,
        { error, result: data, projectId, params: {} },
        status
      );

    return data.map((v: any) => formatContext(v));
  }
}

// TODO: Figure out exports
export { createOrbisSiwxMessage } from "./siwx/index.js";
export * from "./types/index.js";
export { SupportedChains, OrbisResources };
