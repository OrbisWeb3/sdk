import { IAuthenticatedResource } from "./resources.js";

export type OrbisDocument = {
  id: string;
  content: Record<string, any>;
  owners?: Array<string>;
  metadata: Record<string, any>;
};

export interface IOrbisStorage extends IAuthenticatedResource {
  getDocument(id: string): Promise<OrbisDocument>;
  createDocument(params: Omit<OrbisDocument, "id">): Promise<{ id: string }>;
  updateDocument(
    id: string,
    params: Partial<Omit<OrbisDocument, "id">>
  ): Promise<{ id: string }>;
}
