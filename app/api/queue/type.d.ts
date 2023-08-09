import { NextApiRequest } from "next";

export interface QueueRequest extends NextApiRequest {
    json(): Promise<any>;
}