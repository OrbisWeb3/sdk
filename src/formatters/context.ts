import { IndexedContext } from "../index.js";

export const formatContext = (context: any): IndexedContext => {
  const { content } = context;

  return {
    id: context.stream_id,
    creator: {
      did: context.creator,
    },
    project: {
      id: context.project_id || content.project_id,
    },
    name: content.name,
    displayName: content.displayName,
    website: content.websiteUrl,
    accessRules: content.accessRules,
    integrations: content.integrations,
    created_at: new Date(context.created_at).getTime(),
    context: context.context
      ? {
          id: context.context,
        }
      : null,
    is_deleted: context.is_deleted,
    last_post_timestamp: context.last_post_timestamp * 1000,
    data: context.data || content.data || {},
    raw: context,
  };
};
