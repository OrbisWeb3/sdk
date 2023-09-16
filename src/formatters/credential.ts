import { IndexedVerifiedCredential } from "../index.js";

export const formatCredential = (
  credential: any
): IndexedVerifiedCredential => {
  const { content } = credential;
  const { credentialSubject: subject } = content;

  return {
    id: credential.id,
    identifier: credential.identifier || content.identifier || null,
    name: credential.name || content.name || subject.name,
    description:
      credential.description || content.description || subject.description,
    family: credential.family,
    type: subject.type,
    issuer: {
      id: content.issuer.id,
      name: content.issuer.name,
    },
    credentialSubject: {
      id: subject.id,
      network: subject.network,
      protocol: subject.protocol,
    },
    weight: credential.weight,
    created_at: new Date(credential.created_at).getTime(),
    raw: credential,
    data: {},
  };
};
