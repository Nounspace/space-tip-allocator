// https://github.com/Nounspace/nounspace.ts/issues/400

import supabase from "@/lib/supabase";
import airstack from "@/lib/airstack";
import alchemy from "@/lib/alchemy";
import { NOGS_CONTRACT_ADDRESS, SPACE_CONTRACT_ADDRESS } from "@/constants";
import bitquery from "@/lib/bitquery";
import { gql } from "graphql-request";
import { BitqueryTokenHoldersQueryData } from "@/types";
import { sumBy } from "@/utils/math";
import type { Database } from "@/types/database";

import type { SocialRankingsQueryResponse, Ranking, Allocation } from "@/types";

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

const BITQUERY_SPACE_HOLDERS_QUERY = gql`
  query GetTokenHolders(
    $minBalance: String = "0",
    $date: String!
  ) {
    EVM(dataset: archive, network: base) {
      TokenHolders(
        date: $date
        tokenSmartContract: "${SPACE_CONTRACT_ADDRESS}"
        where: { Balance: { Amount: { ge: $minBalance } } }
        orderBy: { descending: Balance_Amount }
      ) {
        Holder {
          Address
        }
        Balance {
          Amount
        }
      }
    }
  }
`;

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

const getSpaceHolders = async (
  date: string,
  minBalance: number = 0,
): Promise<{ [address: string]: number }> => {
  const todayDateString = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const data = await bitquery.request<BitqueryTokenHoldersQueryData>(
    BITQUERY_SPACE_HOLDERS_QUERY,
    {
      minBalance: minBalance.toFixed(0),
      date: todayDateString,
    },
  );

  return (data?.EVM?.TokenHolders || []).reduce(
    (res, holder) => ({
      ...res,
      [holder?.Holder?.Address.toLowerCase()]: Number.parseFloat(
        holder?.Balance?.Amount || "0",
      ),
    }),
    {},
  );
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
  const spaceHolders = await getSpaceHolders(date, minSpaceBalance);

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
