// https://github.com/Nounspace/nounspace.ts/issues/400

import supabase from "@/lib/supabase";
import airstack from "@/lib/airstack";
import alchemy from "@/lib/alchemy";
import { NOGS_CONTRACT_ADDRESS, SPACE_CONTRACT_ADDRESS } from "@/constants";
// import bitquery from "@/lib/bitquery";
import neynar from "@/lib/neynar";
import { gql } from "graphql-request";
import { sumBy } from "@/utils/math";
import type { Database } from "@/types/database";
import type { SocialRankingsQueryResponse, Ranking, Allocation } from "@/types";
import type { CastWithInteractions, User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { getISODateString } from "@/utils/date";

const AIRSTACK_RANKINGS_QUERY = gql`
  query GetUserSocialCapitalRank(
    $cursor: String = ""
    $filterAddresses: [Address!] = []
  ) {
    Socials(
      input: {
        blockchain: ethereum
        filter: {
          dappName: { _eq: farcaster }
          userAssociatedAddresses: { _in: $filterAddresses }
        }
        order: { socialCapitalRank: ASC }
        limit: 200
        cursor: $cursor
      }
    ) {
      pageInfo {
        hasNextPage
        nextCursor
      }
      Social {
        fid: userId
        username: profileName
        connectedAddresses {
          address
          blockchain
        }
        socialCapital {
          rank: socialCapitalRank
        }
        profileDisplayName
        profileImage
      }
    }
  }
`;

// const BITQUERY_SPACE_HOLDERS_QUERY = gql`
//   query GetTokenHolders(
//     $minBalance: String = "0",
//     $date: String!
//   ) {
//     EVM(dataset: archive, network: base) {
//       TokenHolders(
//         date: $date
//         tokenSmartContract: "${SPACE_CONTRACT_ADDRESS}"
//         where: { Balance: { Amount: { ge: $minBalance } } }
//         orderBy: { descending: Balance_Amount }
//       ) {
//         Holder {
//           Address
//         }
//         Balance {
//           Amount
//         }
//       }
//     }
//   }
// `;

const getNogsHolders = async (): Promise<{ [address: string]: number }> => {
  const { owners } = await alchemy.nft.getOwnersForContract(
    NOGS_CONTRACT_ADDRESS,
    {
      withTokenBalances: true,
    },
  );

  return owners.reduce((res, owner) => {
    return {
      ...res,
      [owner.ownerAddress.toLowerCase()]: owner.tokenBalances.reduce(
        (sum, a) => sum + Number.parseInt(a.balance),
        0,
      ),
    };
  }, {});
};

import Moralis from "moralis";

const getSpaceHolders = async (
  minBalance: number = 0,
): Promise<{ [address: string]: number }> => {
  try {
    console.log("Initializing Moralis with API key...");
    await Moralis.start({ apiKey: process.env.MORALIS_API_KEY });

    console.log("Fetching SPACE holders from Moralis...");
    const response = await Moralis.EvmApi.token.getTokenOwners({
      chain: "0x2105", // Replace with the correct chain ID for the Base network if different
      order: "DESC",
      tokenAddress: SPACE_CONTRACT_ADDRESS,
    });

    // Use toJSON() to get raw data
    const responseData = response.toJSON();
    console.log("Response data from Moralis:", responseData);

    // Process the holders based on the minimum balance requirement
    const holders = (responseData.result || []).reduce(
      (res: { [address: string]: number }, holder) => {
        const address = holder.owner_address.toLowerCase();
        const balance = Number.parseFloat(holder.balance || "0");

        // Filter by minimum balance
        if (balance >= minBalance) {
          res[address] = balance;
        }

        return res;
      },
      {}
    );

    console.log("Final SPACE holders:", holders);
    return holders;
  } catch (error) {
    console.error("Failed to fetch SPACE holders from Moralis:", error);
    return {};
  }
};


const getSocialCapitalRankings = async (
  filterAddresses: string[] = [],
): Promise<Ranking[]> => {
  // https://app.airstack.xyz/api-studio
  let rankings: Ranking[] = [];
  let nextCursor: string = "";
  let hasNextPage = true;

  while (hasNextPage) {
    const { data, error }: SocialRankingsQueryResponse =
      await airstack.fetchQueryWithPagination(AIRSTACK_RANKINGS_QUERY, {
        cursor: nextCursor,
        filterAddresses,
      });

    if (error) {
      throw error;
    }

    const { pageInfo, Social: users } = data?.Socials;

    const pageRankings = users.map((user) => {
      return {
        fid: user.fid,
        rank: user.socialCapital.rank,
        username: user.username,
        displayName: user.profileDisplayName,
        pfpUrl: user.profileImage,
        ethAddresses: user.connectedAddresses
          .filter(({ blockchain }) => blockchain === "ethereum")
          .map(({ address }) => address.toLowerCase()),
      };
    });

    const filteredPageRankings = pageRankings.filter((user) => {
      return user.ethAddresses.length > 0;
    });

    rankings = [...rankings, ...filteredPageRankings];
    nextCursor = pageInfo.nextCursor || "";
    hasNextPage = pageInfo.hasNextPage;
  }

  return rankings;
};

const calculateDailyTipAllowancesSeason1 = async (
  date: string,
  totalDailyTokenAllowance: number = 50000,
  minSpaceBalance: number = 11111,
): Promise<{
  params: {
    date: string;
    totalDailyTokenAllowance: number;
    minSpaceBalance: number;
  };
  allocations: Allocation[];
  spaceHolders: { [address: string]: number };
  nogsHolders: { [address: string]: number };
}> => {
  const nogsHolders = await getNogsHolders();
  const spaceHolders = await getSpaceHolders();
  console.log("Space holders:", spaceHolders);
  const eligibleWallets: string[] = Object.keys(nogsHolders).filter(
    (address) => address in spaceHolders,
  );

  const sortedRankings: Ranking[] = eligibleWallets.length
    ? await getSocialCapitalRankings(eligibleWallets)
    : [];

  const formattedRankings = sortedRankings.map((r) => {
    // If multiple linked addresses, select first address holding space
    const primaryAddress = r.ethAddresses.filter((a) => a in spaceHolders)[0];

    return {
      fid: r.fid,
      rank: r.rank,
      username: r.username,
      displayName: r.displayName,
      pfpUrl: r.pfpUrl,
      ethAddress: primaryAddress,
      totalNogs: sumBy(r.ethAddresses, (addr) => nogsHolders[addr] ?? 0),
      totalSpace: sumBy(r.ethAddresses, (addr) => spaceHolders[addr] ?? 0),
    };
  });

  // Calculate the sum of ranks for proportional allocation
  const rankSum =
    (formattedRankings.length * (formattedRankings.length + 1)) / 2;

  // Calculate the weight based on position (1-indexed).
  const allocations: number[] = formattedRankings.map((_, i) => {
    const weight = (formattedRankings.length - i) / rankSum;
    return Math.round(weight * totalDailyTokenAllowance);
  });

  // Adjust for rounding errors
  const allocationSum = allocations.reduce((sum, amt) => sum + amt, 0);

  // Distribute any remaining tokens to the highest-ranked rows
  const difference = Math.round(totalDailyTokenAllowance - allocationSum);

  const adjustedAllocations = allocations.map((allocation, i) => {
    return !difference || i >= Math.abs(difference)
      ? allocation
      : allocation + (difference > 0 ? 1 : -1);
  });

  const formattedAllocations = formattedRankings.map((row, i) => {
    return {
      ...row,
      allocation: adjustedAllocations[i],
    };
  });

  return {
    params: {
      date,
      totalDailyTokenAllowance,
      minSpaceBalance,
    },
    allocations: formattedAllocations,
    spaceHolders,
    nogsHolders,
  };
};

export const calculateDailyTipAllowances = async (
  date: string,
  season: number = 1,
): Promise<{
  params: {
    date: string;
    totalDailyTokenAllowance: number;
    minSpaceBalance: number;
  };
  allocations: Allocation[];
  spaceHolders: { [address: string]: number };
  nogsHolders: { [address: string]: number };
}> => {
  const allowanceCalculationMethods: {
    [season: number]: (_date: string) => Promise<{
      params: {
        date: string;
        totalDailyTokenAllowance: number;
        minSpaceBalance: number;
      };
      allocations: Allocation[];
      spaceHolders: { [address: string]: number };
      nogsHolders: { [address: string]: number };
    }>;
  } = {
    1: calculateDailyTipAllowancesSeason1,
  };

  const calculateAllowancesFn = allowanceCalculationMethods[season];

  if (!calculateAllowancesFn) {
    throw new Error("Invalid season");
  }

  const dailyTipAllowances = await calculateAllowancesFn(date);

  return dailyTipAllowances;
};

export const saveDailyTipAllowances = async (date: string, allocations: Allocation[]) => {
  const formattedAllocations: Database["public"]["Tables"]["daily_tip_allocation"]["Insert"][] = allocations.map((allocation) => {
    return {
      allocation_date: date,
      fid: Number.parseInt(allocation.fid),
      amount: allocation.allocation,
      username: allocation.username,
      display_name: allocation.displayName,
      pfp_url: allocation.pfpUrl,
      address: allocation.ethAddress,
    }
  });

  const { data, error } = await supabase
    .from("daily_tip_allocation")
    .insert(formattedAllocations);

  if (error) {
    throw error;
  }

  console.log(`Updated daily_tip_allocation for date: `, date, data);

  return data;
};

const getLatestCastSearchCheckpoint = async (fid: number): Promise<Date | null> => {
  const { data, error } = await supabase
    .from("cast_search_checkpoint")
    .select("timestamp")
    .eq("fid", fid)
    .order("timestamp", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return data && data.length > 0 ? new Date(data[0].timestamp) : null;
}

const updateCastSearchCheckpoint = async (fid: number, timestamp: Date): Promise<Date> => {
  const { error } = await supabase
    .from("cast_search_checkpoint")
    .upsert({ fid, timestamp: timestamp.toISOString() }, {
      onConflict: "fid",
    });

  if (error) {
    throw error;
  }

  return timestamp;
}

const searchCastsForFid = async function* (fid: number, query: string, afterTimestamp: Date | null): AsyncGenerator<CastWithInteractions[], void, unknown> {
  let casts: CastWithInteractions[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const resp = await neynar.searchCasts(query, {
      limit: 100,
      cursor: cursor || undefined,
      authorFid: fid,
    });

    const filteredCasts = afterTimestamp ? resp.result.casts.filter((cast) => {
      return new Date(cast.timestamp) > afterTimestamp;
    }) : resp.result.casts;

    if (filteredCasts.length > 0) {
      yield filteredCasts;
    }

    casts = [...casts, ...filteredCasts];
    cursor = resp.result.next.cursor;
    hasMore = !!cursor && filteredCasts.length > 0;
  }
}

const getUsersByFids = async function (fids: number[]): Promise<{ [fid: number]: User }> {
  if (fids.length === 0) {
    return {};
  }
  const resp = await neynar.fetchBulkUsers(fids);

  return resp.users.reduce((acc, user) => ({
    ...acc,
    [user.fid]: user,
  }), {});
}

export const syncCastTipsForFid = async (fid: number) => {
  const lastCheckpointDate = await getLatestCastSearchCheckpoint(fid);
  const tipRegex = /\b\d+\.?\d+\s\$SPACE\b/gi;

  for await (const casts of searchCastsForFid(fid, "SPACE", lastCheckpointDate)) {
    // search tip amounts in cast text
    const castsWithTips = casts.map((cast) => {
      const match = cast.text.match(tipRegex);
      if (!match || match.length === 0) return null;
      if (!cast.parent_author.fid) return null;

      return {
        from_fid: cast.author.fid,
        from_username: cast.author.username,
        from_display_name: cast.author.display_name,
        from_pfp_url: cast.author.pfp_url,
        to_fid: cast.parent_author.fid,
        to_username: null,
        to_display_name: null,
        to_pfp_url: null,
        allocation_date: getISODateString(new Date(cast.timestamp)),
        cast_hash: cast.hash,
        cast_text: cast.text,
        casted_at: new Date(cast.timestamp).toISOString(),
        amount: Number.parseInt(match[0].split(" ")[0]),
      }
    }).filter(c => !!c) as Database["public"]["Tables"]["tip"]["Insert"][];

    // check if tip already indexed
    const { data: indexedTips, error: indexedTipsError } = await supabase
      .from("tip")
      .select("cast_hash")
      .in("cast_hash", castsWithTips.map((cast) => cast.cast_hash));

    if (indexedTipsError) {
      throw indexedTipsError;
    }

    const indexedHashes = (indexedTips || []).map((tip) => tip.cast_hash);
    const tipsToInsert = castsWithTips.filter((cast) => !indexedHashes.includes(cast.cast_hash));

    const recipientFids = Array.from(new Set(castsWithTips.map((cast) => cast.to_fid)));
    const recipientUsers = await getUsersByFids(recipientFids);

    const tipsToInsertWithRecipients = tipsToInsert.map((tip) => {
      return {
        ...tip,
        to_username: recipientUsers[tip.to_fid]?.username,
        to_display_name: recipientUsers[tip.to_fid]?.display_name,
        to_pfp_url: recipientUsers[tip.to_fid]?.pfp_url,
      }
    });

    // save to db
    if (tipsToInsertWithRecipients.length > 0) {
      const { error: insertError } = await supabase
        .from("tip")
        .insert(tipsToInsertWithRecipients);

      if (insertError) {
        throw insertError;
      }
    }

    // update checkpoint
    await updateCastSearchCheckpoint(fid, new Date(casts[0].timestamp));
  }
}

export const syncCastTips = async () => {
  // get all unique fids from daily_tip_allocation table
  const { data: users, error: usersError } = await supabase
    .from("distinct_fids")
    .select("fid");

  const fids = users?.map((tipper) => tipper.fid!) || [];

  if (usersError) {
    throw usersError;
  }

  for (const fid of fids) {
    await syncCastTipsForFid(fid);
  }

  await validateTips();
}

export const validateTips = async () => {
  // Check if tips are valid based on users' tip allocations.
  // Tips in which is_valid is null have not been validated yet.
  // This is done after fully syncing tip casts since casts are
  // processed from most recent to oldest, whereas validations
  // should be processed chronologically.
  const { error } = await supabase.rpc('validate_tips');

  if (error) {
    throw error;
  }
}
