import {
  LitNodeClient,
  encryptString,
  decryptString,
  encryptFile,
  decryptFile,
  uint8arrayToString,
} from "@lit-protocol/lit-node-client";
import { SupportedChains, OrbisResources } from "../../index.js";
import { LitSession, parseOrbisRules } from "./common.js";
import {
  DecryptedFile,
  DecryptedString,
  EncryptFileParams,
  EncryptStringParams,
  EncryptedFile,
  EncryptedString,
  IOrbisEncryptionClient,
} from "../../types/encryption.js";
import { blobToBase64, base64ToBlob } from "../../util/conversion.js";
import { UnifiedAccessControlConditions } from "@lit-protocol/types";
import { OrbisError } from "../../util/results.js";
import {
  AuthUserInformation,
  IOrbisAuth,
  OrbisSession,
  SerializedOrbisSession,
} from "../../types/auth.js";
import { catchError } from "../../util/tryit.js";
import { fromString, toString } from "uint8arrays";
import { SiwxMessage } from "@didtools/cacao";

export class LitEncryptionClient implements IOrbisEncryptionClient {
  id = "lit";
  userFriendlyName = "Lit Protocol";
  supportedChains = [SupportedChains.ethereum, SupportedChains.solana];

  siwxResources = [];

  #user?: AuthUserInformation;
  #session?: OrbisSession & { session: LitSession };
  #client?: LitNodeClient;

  get user() {
    return this.#user;
  }

  get session(): SerializedOrbisSession | false {
    if (!this.#session) {
      return false;
    }

    return {
      authAttestation: this.#session?.authAttestation,
      authResource: this.#session?.authResource,
      session: this.#session?.session.serialize(),
    };
  }

  async connect() {
    if (this.#client) {
      return;
    }

    const client = new LitNodeClient({
      alertWhenUnauthorized: false,
      debug: false,
    });

    await client.connect();
    this.#client = client;
  }

  async authorize({
    authenticator,
    siwxOverwrites,
  }: {
    authenticator: IOrbisAuth;
    siwxOverwrites?: Partial<SiwxMessage>;
  }): Promise<OrbisSession> {
    if (!("authenticateSiwx" in authenticator)) {
      throw "Unsupported auth method, missing authenticateSiwx";
    }

    const { chain } = await authenticator.getUserInformation();
    if (!this.supportedChains.includes(chain)) {
      throw new OrbisError(
        "[Encryption:Lit] Unsupported authentication method. Chain not supported " +
          chain,
        { supportedChains: this.supportedChains }
      );
    }

    const siwxSession = await authenticator.authenticateSiwx({
      resources: [
        {
          id: this.id,
          resourceType: OrbisResources.encryption,
          userFriendlyName: this.userFriendlyName,
          siwxResources: this.siwxResources,
        },
      ],
      siwxOverwrites,
    });

    // Convert from base58btc (default Sol encoding) to base16
    if (chain === SupportedChains.solana) {
      const signature = siwxSession.siwx.message.signature;
      const hexSignature = toString(
        fromString(signature, "base58btc"),
        "base16"
      );
      siwxSession.siwx.signature = hexSignature;
      siwxSession.siwx.message.signature = hexSignature;
    }

    const session = new LitSession(siwxSession);
    this.#user = await authenticator.getUserInformation();

    this.#session = {
      authResource: {
        id: this.id,
        userFriendlyName: this.userFriendlyName,
        resourceType: OrbisResources.encryption,
      },
      authAttestation: {
        type: "siwx",
        siwx: siwxSession.siwx,
      },
      session: session,
    };

    return this.#session;
  }

  async setSession({
    user,
    session,
  }: {
    user: AuthUserInformation;
    session: SerializedOrbisSession;
  }): Promise<void> {
    const parsedSession = LitSession.fromSession(session.session);

    // In case of EVM it's safe to ignore checksum
    const addressMatch =
      parsedSession.chain === SupportedChains.ethereum
        ? parsedSession.address.toLowerCase() ===
          user.metadata.address.toLowerCase()
        : parsedSession.address === user.metadata.address;

    if (!addressMatch) {
      this.clearSession();
      throw new OrbisError("[Encryption:Lit] Session address mismatch", {
        session: parsedSession,
        user,
      });
    }

    this.#user = user;

    this.#session = {
      authAttestation: session.authAttestation,
      authResource: session.authResource,
      session: parsedSession,
    };
  }

  async clearSession(): Promise<void> {
    this.#session = undefined;
    this.#user = undefined;
  }

  async assertCurrentUser(user: AuthUserInformation): Promise<boolean> {
    if (!this.user) {
      return false;
    }

    return JSON.stringify(user) === JSON.stringify(this.user);
  }

  // Strings
  async encryptString({
    string,
    encryptionRules,
  }: EncryptStringParams): Promise<EncryptedString> {
    await this.connect();
    if (!this.#session) {
      throw new OrbisError(
        "[Encryption:Lit] Not authorized. You need to call IEncryptionClient.authorize() or Orbis.login()"
      );
    }

    const accessConditions: UnifiedAccessControlConditions =
      parseOrbisRules(encryptionRules);

    const { symmetricKey, encryptedString } = await encryptString(string);
    const encryptedSymmetricKey = await this.#client?.saveEncryptionKey({
      authSig: this.#session.session,
      symmetricKey,
      chain: this.#session.session.chain,
      unifiedAccessControlConditions: accessConditions,
    });

    if (!encryptedSymmetricKey) {
      throw new OrbisError(
        "[Encryption:Lit] Unable to save encryption key. Encryption failed."
      );
    }

    return {
      encryptedContent: await blobToBase64(encryptedString),
      encryptionMetadata: {
        client: "lit",
        encryptedSymmetricKey: uint8arrayToString(
          encryptedSymmetricKey,
          "base16"
        ),
        encryptionRules: accessConditions,
      },
    };
  }

  async decryptString(encrypted: EncryptedString): Promise<DecryptedString> {
    await this.connect();
    if (!this.#session) {
      throw new OrbisError(
        "[Encryption:Lit] Not authorized. You need to call IEncryptionClient.authorize() or Orbis.login()"
      );
    }

    const {
      encryptedContent,
      encryptionMetadata: { encryptedSymmetricKey, ...rules },
    } = encrypted;
    const blobString = await base64ToBlob(encryptedContent);

    const [decryptedSymmKey, decryptionError] = await catchError(
      () =>
        this.#client?.getEncryptionKey({
          toDecrypt: encryptedSymmetricKey,
          chain: this.#session?.session.chain,
          authSig: this.#session?.session,
          accessControlConditions: rules.evmEncryptionRules,
          solRpcConditions: rules.solEncryptionRules,
          unifiedAccessControlConditions: rules.encryptionRules,
        })
    );

    if (decryptionError || !decryptedSymmKey) {
      throw new OrbisError(
        "[Encryption:Lit] Unable to get an encryption key.",
        { error: decryptionError }
      );
    }

    const [decryptedString, err] = await catchError(async () => {
      const blob = new Blob([blobString]);
      return decryptString(blob, decryptedSymmKey);
    });

    if (err) {
      throw new OrbisError("[Encryption:Lit] Unable to decrypt the string.", {
        error: err,
      });
    }

    return {
      decryptedContent: decryptedString,
    };
  }

  // zipAndEncryptFiles if size < 20mb?
  // assume we store metadata always
  async encryptFile({
    file,
    encryptionRules,
  }: EncryptFileParams): Promise<EncryptedFile> {
    await this.connect();
    if (!this.#session) {
      throw new OrbisError(
        "[Encryption:Lit] Not authorized. You need to call IEncryptionClient.authorize() or Orbis.login()"
      );
    }

    const accessConditions: UnifiedAccessControlConditions =
      parseOrbisRules(encryptionRules);

    const { symmetricKey, encryptedFile } = await encryptFile({ file });
    const encryptedSymmetricKey = await this.#client?.saveEncryptionKey({
      authSig: this.#session.session,
      symmetricKey,
      chain: this.#session.session.chain,
      unifiedAccessControlConditions: accessConditions,
    });

    if (!encryptedSymmetricKey) {
      throw new OrbisError(
        "[Encryption:Lit] Unable to save encryption key. Encryption failed."
      );
    }

    return {
      encryptedContent: await blobToBase64(encryptedFile),
      encryptionMetadata: {
        client: "lit",
        encryptedSymmetricKey: uint8arrayToString(
          encryptedSymmetricKey,
          "base16"
        ),
        encryptionRules: accessConditions,
      },
      contentMetadata: {
        name: file.name,
        type: file.type,
      },
    };
  }

  async decryptFile(encrypted: EncryptedFile): Promise<DecryptedFile> {
    await this.connect();
    if (!this.#session) {
      throw new OrbisError(
        "[Encryption:Lit] Not authorized. You need to call IEncryptionClient.authorize() or Orbis.login()"
      );
    }

    const {
      encryptedContent,
      encryptionMetadata: { encryptedSymmetricKey, ...rules },
      contentMetadata,
    } = encrypted;
    const blobFile = await base64ToBlob(encryptedContent);

    const [decryptedSymmKey, decryptionError] = await catchError(
      () =>
        this.#client?.getEncryptionKey({
          toDecrypt: encryptedSymmetricKey,
          chain: this.#session?.session.chain,
          authSig: this.#session?.session,
          accessControlConditions: rules.evmEncryptionRules,
          solRpcConditions: rules.solEncryptionRules,
          unifiedAccessControlConditions: rules.encryptionRules,
        })
    );

    if (decryptionError || !decryptedSymmKey) {
      throw new OrbisError(
        "[Encryption:Lit] Unable to get an encryption key.",
        { error: decryptionError }
      );
    }

    const [decryptedFile, err] = await catchError(async () => {
      const blob = new Blob([blobFile]);
      return decryptFile({ file: blob, symmetricKey: decryptedSymmKey });
    });

    if (err) {
      throw new OrbisError("[Encryption:Lit] Unable to decrypt the string.", {
        error: err,
      });
    }

    return {
      decryptedContent: new File([decryptedFile], contentMetadata.name, {
        type: contentMetadata.type,
      }),
    };
  }
}
