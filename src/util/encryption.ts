import {
  EncryptedString,
  IndexedEncryptedString,
} from "../types/encryption.js";

export const parseIndexedEncryptedString = (
  encryptedContent: IndexedEncryptedString
): EncryptedString => {
  return {
    encryptedContent: encryptedContent?.encryptedString as string,
    encryptionMetadata: {
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
  };
};

export const serializeEncryptedString = (
  encryptedContent: EncryptedString
): IndexedEncryptedString => {
  const { encryptedContent: encryptedString, encryptionMetadata: metadata } =
    encryptedContent;

  return {
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
