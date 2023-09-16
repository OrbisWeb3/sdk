import { IndexedMessage, MinimalIndexedMessage } from "../index.js";
import { formatMinimalProfile, formatProfile } from "./profile.js";

export const formatMessage = (message: any): IndexedMessage => {
  const { content, creator_details } = message;

  return {
    id: message.stream_id,
    creator: formatProfile(creator_details),
    conversation: {
      id: message.conversation_id,
    },
    body: {
      plain: content.body || null,
      encrypted: content.encryptedBody || content.encryptedMessage,
      encryptedSolana: content.encryptedMessageSolana,
    },
    created_at: new Date(message.created_at).getTime(),
    timestamp: message.timestamp * 1000,
    // TODO: fix reply_to (remove details and format)
    reply_to:
      (message.reply_to && {
        id: message.reply_to.stream_id,
        creator: formatProfile(message.reply_to_creator_details),
        details: message.reply_to_details,
      }) ||
      null,
    master:
      (message.master && {
        id: message.master,
      }) ||
      null,
    recipients: message.recipients,
    data: content.data || {},
    raw: message,
  };
};

export const formatMinimalMessage = (message: any): MinimalIndexedMessage => {
  const { content } = message;

  return {
    creator: formatMinimalProfile(message.creator),
    body: {
      plain: content.body || null,
      encrypted: content.encryptedBody || content.encryptedMessage,
      encryptedSolana: content.encryptedMessageSolana,
    },
    conversation: {
      id: message.conversation_id,
    },
    master: message.master
      ? {
          id: message.master,
        }
      : null,
    reply_to: message.reply_to
      ? {
          id: message.reply_to,
        }
      : null,
    data: message.data || content.data || {},
    raw: message,
  };
};
