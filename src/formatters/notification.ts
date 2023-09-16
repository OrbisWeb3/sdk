import {
  IndexedFollowNotification,
  IndexedMentionNotification,
  IndexedNotification,
  IndexedReactionNotification,
  IndexedReplyNotification,
} from "../index.js";
import { OrbisError } from "../util/results.js";
import { formatMinimalMessage } from "./message.js";
import { formatMinimalPost, formatPost } from "./post.js";
import { formatMinimalProfile } from "./profile.js";

export const formatNotification = (notification: any): IndexedNotification => {
  switch (notification.family) {
    case "follow":
      return {
        ...formatFollow(notification),
        status: notification.status,
        raw: notification,
        data: {},
      };
    case "reaction":
      return {
        ...formatReaction(notification),
        status: notification.status,
        raw: notification,
        data: {},
      };
    case "mention":
      return {
        ...formatMention(notification),
        status: notification.status,
        raw: notification,
        data: {},
      };
    case "reply_to":
      return {
        ...formatReply(notification),
        status: notification.status,
        raw: notification,
        data: {},
      };
    case "message":
      return {
        type: "message",
        family: "mesage",
        message: formatMinimalMessage({
          creator: notification.user_notifiying_details,
          ...(notification.content || {}),
          content: notification.content || {},
        }),
        status: notification.status,
        raw: notification,
        data: {},
      };
    default:
      throw new OrbisError(
        `Unknown notification format ${notification.family}`,
        { notification }
      );
  }
};

const formatMention = (notification: any): IndexedMentionNotification => {
  return {
    type: "social",
    family: "mention",
    post: notification.post_details.content
      ? formatPost(notification.post_details)
      : formatMinimalPost({
          creator: notification.user_notifiying_details,
          ...(notification.content || {}),
        }),
  };
};

const formatReaction = (notification: any): IndexedReactionNotification => {
  return {
    type: "social",
    family: "reaction",
    reaction: {
      user: formatMinimalProfile(notification.user_notifying_details),
      post: notification.post_details.content
        ? formatPost(notification.post_details)
        : {
            id: notification.content.post_id,
          },
      type: notification.content.type,
    },
  };
};

const formatReply = (notification: any): IndexedReplyNotification => {
  return {
    type: "social",
    family: "reply",
    post: notification.post_details.content
      ? formatPost(notification.post_details)
      : formatMinimalPost({
          creator: notification.user_notifiying_details,
          ...(notification.content || {}),
        }),
  };
};

const formatFollow = (notification: any): IndexedFollowNotification => {
  return {
    type: "social",
    family: "follow",
    follower: {
      ...formatMinimalProfile(notification.user_notifying_details),
      is_following: notification.content.active,
    },
    following: {
      did: notification.content.did,
    },
  };
};
