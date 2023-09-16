import { HttpsUrl, IpfsUrl } from "./common.js";

export type IpfsUploadedFile = {
  url: string;
  gateway?: HttpsUrl;
  resolvedUrl?: string;
  type?: string;
};

export interface IMediaManager {
  id: string;

  resolve(ipfsResource: IpfsUrl | IpfsUploadedFile): string;
  upload(file: File): Promise<IpfsUploadedFile>;
}
