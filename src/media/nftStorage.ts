import { HttpsUrl, IpfsUrl } from "../types/common.js";
import { IMediaManager, IpfsUploadedFile } from "../types/media.js";
import { resolveMediaUrl } from "../util/media.js";
import { OrbisError } from "../util/results.js";
import { catchError } from "../util/tryit.js";

export class NftStorageMediaManager implements IMediaManager {
  id = "nft-storage";

  #gateway: HttpsUrl = "https://nftstorage.link/ipfs/";
  #apiKey?: string;

  constructor({ apiKey }: { apiKey?: string }) {
    this.#apiKey = apiKey;
  }

  resolve(ipfsResource: IpfsUrl | IpfsUploadedFile): string {
    return resolveMediaUrl(ipfsResource, this.#gateway);
  }

  async upload(file: File): Promise<IpfsUploadedFile> {
    if (!this.#apiKey)
      throw "[Media manager] NFTStorage API key is required to upload files. More info: https://nft.storage/docs/quickstart/#get-an-api-token";

    const [result, error] = await catchError(async () => {
      const result = await fetch("https://api.nft.storage/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
        },
        body: file,
      });

      return result.json();
    });

    if (error || !result.ok || result.error || !result.value.cid) {
      throw new OrbisError("[Media manager] Error uploading file.", {
        error: error || result.error,
      });
    }

    const url = ("ipfs://" + result.value.cid) as IpfsUrl;

    return {
      url: url,
      gateway: this.#gateway,
      type: file.type,
      resolvedUrl: this.resolve(url),
    };
  }
}
