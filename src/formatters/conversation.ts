import { IndexedConversation } from "../types/index.js";

export function formatConversation(conversation: any): IndexedConversation {
  const content = conversation.details.content;

  return {
    id: conversation.stream_id,
    context: {
      id: conversation.context,
    },
    name: {
      encrypted: content.encryptedName,
      plain: content.name,
    },
    description: {
      encrypted: content.encryptedDescription,
      plain: content.description,
    },
    recipients: conversation.recipients_details.map((v: any) => {
      return {
        did: v.did,
        profile: v.profile,
        onchain_metadata: {
          chain: v.metadata?.chain,
          address: v.metadata?.address,
          ens: v.metadata?.ensName,
        },
      };
    }),
    creator: {
      did: conversation.details.creator,
    },
    last_message_timestamp: conversation.last_message_timestamp * 1000,
    data: conversation.data || content.data || {},
    raw: conversation,
  };
}
