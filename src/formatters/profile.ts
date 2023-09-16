import { IndexedProfile, MinimalIndexedProfile } from "../index.js";

export function formatProfile(profile: any): IndexedProfile {
  const details = profile.details || profile;
  const metadata = details.metadata || {};
  const { pfpIsNft, pfp, description } = details.profile || {};

  return {
    did: profile.did,
    username: profile.username,
    pfp: {
      url: pfp || null,
      is_nft: (pfpIsNft && true) || false,
      nft: pfpIsNft
        ? {
            chain: pfpIsNft.chain,
            tokenId: pfpIsNft.tokenId,
            contract: pfpIsNft.contract,
            timestamp: Number(pfpIsNft.timestamp) * 1000,
          }
        : null,
    },
    description,
    email: {
      is_verified: Boolean(details.verified_email),
      encrypted: details.encrypted_email || null,
      plain: null,
    },
    onchain_metadata: {
      nonces: details.nonces,
      address: metadata.address || profile.address,
      chain: metadata.chain,
      ensName: metadata.ensName,
    },
    reputation: details.a_r,
    count_followers: details.count_followers,
    count_following: details.count_following,
    socials: {
      twitter: details.twitter_details,
      github: details.github_details,
    },
    last_activity_timestamp: profile.last_activity_timestamp * 1000,
    timestamp: profile.timestamp * 1000,
    data: profile.data || details.data || {},
    raw: profile,
  };
}

export const formatMinimalProfile = (_profile: any): MinimalIndexedProfile => {
  const { did } = _profile || {};
  const profile = _profile?.profile || {};
  const { pfpIsNft } = profile;

  return {
    did: did || profile.did,
    username: profile.username || null,
    description: profile.description || null,
    pfp: {
      url: profile.pfp || null,
      is_nft: (pfpIsNft && true) || false,
      nft: pfpIsNft
        ? {
            chain: pfpIsNft.chain,
            tokenId: pfpIsNft.tokenId,
            contract: pfpIsNft.contract,
            timestamp: Number(pfpIsNft.timestamp) * 1000,
          }
        : null,
    },
  };
};
