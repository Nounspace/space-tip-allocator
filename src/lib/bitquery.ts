import { GraphQLClient } from "graphql-request";

const bitquery = new GraphQLClient("https://streaming.bitquery.io/graphql", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-KEY": process.env.BITQUERY_API_SECRET!,
  },
});

export default bitquery;
