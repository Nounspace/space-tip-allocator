export interface SocialRankingsQueryResponse {
  data: SocialRankingsData;
  error: {
    message: string;
  };
}

export interface SocialRankingsData {
  Socials: {
    pageInfo: {
      hasNextPage: boolean;
      nextCursor: string | null;
    };
    Social: {
      fid: string;
      username: string;
      connectedAddresses: {
        address: string;
        blockchain: string;
      }[];
      socialCapital: {
        rank: number;
      };
    }[];
  };
}

export type Ranking = {
  fid: string;
  username: string;
  ethAddresses: string[];
  rank: number;
};

export type Allocation = {
  fid: string;
  username: string;
  ethAddress: string;
  rank: number;
  totalNogs: number;
  totalSpace: number;
  allocation: number;
};

export interface BitqueryTokenHoldersQueryData {
  EVM: {
    TokenHolders: {
      Holder: {
        Address: string;
      };
      Balance: {
        Amount: string;
      };
    }[];
  };
}
