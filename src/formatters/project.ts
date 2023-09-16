import { IndexedProject } from "../index.js";

export const formatProject = (project: any): IndexedProject => {
  return {
    id: project.stream_id,
    creator: {
      did: project.creator,
    },
    name: project.content?.name,
    website: project.content?.website,
    members: project.members || [],
    is_archived: project.is_archived,
    created_at: new Date(project.created_at).getTime(),
    data: project.data || project.content?.data || {},
    raw: project,
  };
};
