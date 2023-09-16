import {
  IndexedSocialPost,
  MinimalIndexedPost,
} from "../types/primitives/indexed.js";
import { formatMinimalProfile, formatProfile } from "./profile.js";

export const formatPost = (post: any): IndexedSocialPost => {
  const { content } = post;

  return {
    id: post.stream_id,
    type: post.type,
    creator: formatProfile(post.creator_details),
    title: post.title || content.title,
    body: {
      plain: post.content.body || null,
      encrypted: post.content.encryptedBody,
    },
    tags: post.tags || [],
    media: content.media || [],
    mentions: content.mentions || [],
    context: post.context && {
      id: post.context,
      details: {
        ...((post.context_details?.context_details &&
          post.context_details.context_details) ||
          post.context_details ||
          {}),
      },
    },
    master:
      (post.master && {
        id: post.master,
      }) ||
      null,
    repost: post.repost_details?.stream_id
      ? formatPost(post.repost_details)
      : post.repost
      ? {
          id: post.repost,
        }
      : post.content?.repost
      ? {
          id: post.content.repost,
        }
      : null,
    reply_to:
      (post.reply_to && {
        id: post.reply_to,
        ...((post.reply_to_creator_details && {
          creator: formatProfile(post.reply_to_creator_details),
        }) ||
          {}),
        ...(post.reply_to_details
          ? {
              title: post.reply_to_details.title,
              body: {
                plain: post.reply_to_details.body,
                encrypted: post.reply_to_details.encryptedBody,
              },
              media: post.reply_to_details.media || [],
              data: post.reply_to_details.data || {},
              context:
                (post.reply_to_details.context && {
                  id: post.reply_to_details.context,
                }) ||
                null,
            }
          : {}),
      }) ||
      null,
    engagement: {
      reactions: {
        likes: post.count_likes,
        haha: post.count_haha,
        downvotes: post.count_downvotes,
      },
      replies: post.count_replies,
      reposts: post.count_repost,
    },
    commits: post.count_commits,
    timestamp: post.timestamp * 1000,
    indexing_metadata: post.indexing_metadata || {},
    data: post.data || {},
    raw: post,
  };
};

export const formatMinimalPost = (post: any): MinimalIndexedPost => {
  return {
    id: post.stream_id || null,
    body: {
      plain: post.body || null,
      encrypted: post.encryptedBody || null,
    },
    creator: formatMinimalProfile(post.creator),
    reply_to: post.reply_to
      ? {
          id: post.reply_to,
        }
      : null,
    repost: post.repost
      ? {
          id: post.repost,
        }
      : null,
    master: post.master
      ? {
          id: post.master,
        }
      : null,
    context: post.context
      ? {
          id: post.context,
        }
      : null,
    mentions: post.mentions || [],
    data: post.data || {},
    raw: post,
  };
};
