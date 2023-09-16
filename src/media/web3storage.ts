import { HttpsUrl, IpfsUrl } from "../types/common.js";
import { IMediaManager, IpfsUploadedFile } from "../types/media.js";
import { resolveMediaUrl } from "../util/media.js";
import { OrbisError } from "../util/results.js";
import { catchError } from "../util/tryit.js";

export class Web3StorageMediaManager implements IMediaManager {
  id = "web3-storage";

  #gateway: HttpsUrl = "https://w3s.link/ipfs/";
  #token?: string;

  constructor({ token }: { token?: string }) {
    this.#token = token;
  }

  resolve(ipfsResource: IpfsUrl | IpfsUploadedFile): string {
    return resolveMediaUrl(ipfsResource, this.#gateway);
  }

  async upload(file: File): Promise<IpfsUploadedFile> {
    if (!this.#token)
      throw "[Media manager] Web3Storage API token is required to upload files. More info: https://web3.storage/docs/how-tos/generate-api-token/";

    const [result, error] = await catchError(async () => {
      const result = await fetch("https://api.web3.storage/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#token}`,
        },
        body: file,
      });

      return result.json();
    });

    if (error || !result.cid || result.message) {
      throw new OrbisError("[Media manager] Error uploading file.", {
        error: error || result.message,
      });
    }

    const url = ("ipfs://" + result.cid) as IpfsUrl;

    return {
      url: url,
      gateway: this.#gateway,
      type: file.type,
      resolvedUrl: this.resolve(url),
    };
  }
}
