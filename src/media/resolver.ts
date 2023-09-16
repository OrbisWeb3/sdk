import { HttpsUrl, IpfsUrl } from "../types/common.js";
import { IMediaManager, IpfsUploadedFile } from "../types/media.js";
import { resolveMediaUrl } from "../util/media.js";

export class MediaResolver implements IMediaManager {
  id = "generic-resolver";

  #gateway: HttpsUrl;

  constructor({ gateway }: { gateway: HttpsUrl }) {
    this.#gateway = gateway.endsWith("/")
      ? gateway
      : ((gateway + "/") as HttpsUrl);
  }

  resolve(ipfsResource: IpfsUrl | IpfsUploadedFile): string {
    return resolveMediaUrl(ipfsResource, this.#gateway);
  }

  async upload(file: File): Promise<IpfsUploadedFile> {
    throw "Media uploading not supported.";
  }
}
