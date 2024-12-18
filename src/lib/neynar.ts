import { NeynarAPIClient as OriginalNeynarAPIClient } from "@neynar/nodejs-sdk";
import axios, { AxiosInstance } from "axios";

class NeynarAPIClient extends OriginalNeynarAPIClient {
    constructor(apiKey: string, options?: { headers?: { [key: string]: string } }) {
        const axiosInstance: AxiosInstance = axios.create({
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                ...options?.headers,
            },
        });
        super(apiKey, { axiosInstance });
    }
}

export const neynar = new NeynarAPIClient(process.env.NEYNAR_API_KEY!, {
    headers: {
        'x-neynar-experimental': 'true'
    }
});

export default neynar;