import {z} from "zod";

export const AWSConfigSchema = z.any().optional();


export {default as AWSService} from "./AWSService.ts";
