import { HttpsUrl, IpfsUrl } from "../types/common.js";
import { IMediaManager, IpfsUploadedFile } from "../types/media.js";
import { resolveMediaUrl } from "../util/media.js";
import { OrbisError } from "../util/results.js";
import { catchError } from "../util/tryit.js";

export class PinataMediaManager implements IMediaManager {
  id = "pinata";

  #gateway: HttpsUrl;
  #jwt?: string;

  constructor({ gateway, jwt }: { gateway?: HttpsUrl; jwt?: string }) {
    this.#gateway =
      (gateway &&
        (gateway.endsWith("/") ? gateway : ((gateway + "/") as HttpsUrl))) ||
      ("https://gateway.pinata.cloud/ipfs/" as HttpsUrl);
    this.#jwt = jwt;
  }

  resolve(ipfsResource: IpfsUrl | IpfsUploadedFile): string {
    return resolveMediaUrl(ipfsResource, this.#gateway);
  }

  async upload(file: File): Promise<IpfsUploadedFile> {
    if (!this.#jwt)
      throw "[Media manager] Pinata JWT token is required to upload files. More info: https://docs.pinata.cloud/pinata-api/authentication";

    const data = new FormData();
    data.append("file", file);

    const [result, error] = await catchError(async () => {
      const result = await fetch(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.#jwt}`,
          },
          body: data,
        }
      );

      return result.json();
    });

    if (error || !result.IpfsHash || result.error) {
      throw new OrbisError("[Media manager] Error uploading file.", {
        error: error || result.error,
      });
    }

    const url = ("ipfs://" + result.IpfsHash) as IpfsUrl;

    return {
      url,
      gateway: this.#gateway,
      type: file.type,
      resolvedUrl: this.resolve(url),
    };
  }
}
