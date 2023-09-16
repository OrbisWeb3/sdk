import { HttpsUrl } from "../types/common.js";
import { IpfsUploadedFile } from "../types/media.js";

export const parseIpfsUrl = (url: string): { hash: string; path: string } => {
  if (!url.startsWith("ipfs://")) {
    throw "Provided url is not a valid IPFS url. (ipfs://)";
  }

  const parsed = url.replace("ipfs://", "").split("/");
  const hash = parsed.shift() as string;
  const path = parsed.length ? parsed.join("/") : "/";

  return {
    hash,
    path,
  };
};

export const resolveMediaUrl = (
  media: string | IpfsUploadedFile,
  gateway: HttpsUrl,
  forceGateway: boolean = false
) => {
  const url = typeof media === "string" ? media : media.url;
  if (!url.startsWith("ipfs://")) {
    if (typeof media === "string") return url;
    return media.resolvedUrl || url;
  }

  if (typeof media === "string") {
    const parsed = parseIpfsUrl(media);
    if (!gateway.includes("{hash}") || !gateway.includes("{path}")) {
      return (
        gateway +
        parsed.hash +
        (gateway.endsWith("/") ? parsed.path.slice(1) : parsed.path)
      );
    }

    return gateway
      .replace("{hash}", parsed.hash)
      .replace("{path}", parsed.path);
  }

  if (media.resolvedUrl && !forceGateway) {
    return media.resolvedUrl;
  }

  const _gateway = forceGateway ? gateway : media.gateway || gateway;
  const parsed = parseIpfsUrl(media.url);

  if (!_gateway.includes("{hash}") || !_gateway.includes("{path}")) {
    return (
      _gateway +
      parsed.hash +
      (_gateway.endsWith("/") ? parsed.path.slice(1) : parsed.path)
    );
  }

  return _gateway.replace("{hash}", parsed.hash).replace("{path}", parsed.path);
};
