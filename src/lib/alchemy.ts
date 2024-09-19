import { Network, Alchemy } from "alchemy-sdk";

const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

export default alchemy;
