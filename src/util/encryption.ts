import {
  EncryptedFile,
  EncryptedString,
  IndexedEncryptedString,
} from "../types/encryption.js";

export const parseIndexedEncryptedContent = (
  encryptedContent: IndexedEncryptedString
): EncryptedString | EncryptedFile => {
  return {
    encryptedContent: encryptedContent?.encryptedString as string,
    encryptionMetadata: {
      client: encryptedContent.client,
      encryptedSymmetricKey: encryptedContent?.encryptedSymmetricKey as string,
      evmEncryptionRules:
        encryptedContent?.accessControlConditions &&
        JSON.parse(encryptedContent.accessControlConditions as string),
      solEncryptionRules:
        encryptedContent?.solRpcConditions &&
        JSON.parse(encryptedContent.solRpcConditions as string),
      encryptionRules:
        encryptedContent?.unifiedControlConditions &&
        JSON.parse(encryptedContent.unifiedControlConditions as string),
    },
    contentMetadata: encryptedContent.contentMetadata,
  };
};

export const serializeEncryptedContent = (
  encryptedContent: EncryptedString | EncryptedFile
): IndexedEncryptedString => {
  const { encryptedContent: encryptedString, encryptionMetadata: metadata } =
    encryptedContent;

  return {
    client: metadata.client,
    ...(("contentMetadata" in encryptedContent && {
      contentMetadata: encryptedContent.contentMetadata,
    }) ||
      {}),
    encryptedString,
    encryptedSymmetricKey: metadata.encryptedSymmetricKey,
    ...(metadata.solEncryptionRules
      ? { solRpcConditions: JSON.stringify(metadata.solEncryptionRules) }
      : {}),
    ...(metadata.evmEncryptionRules
      ? { accessControlConditions: JSON.stringify(metadata.evmEncryptionRules) }
      : {}),
    ...(metadata.encryptionRules
      ? { unifiedControlConditions: JSON.stringify(metadata.encryptionRules) }
      : {}),
  };
};
