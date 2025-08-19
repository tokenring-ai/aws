import {Registry} from "@token-ring/registry";
import {z} from "zod";
import AWSService from "../AWSService.ts";

export const name = "aws/getCallerIdentity";
export const description =
  "Fetches and displays the AWS caller identity (Account, ARN, UserId) using the configured credentials.";
export const inputSchema = z.object({});

/**
 * Executes the GetCallerIdentity tool.
 * Returns the caller identity object on success.
 * Throws an error on failure with a standardized message.
 */
export async function execute(_args: unknown, registry: Registry) {
  const awsService = registry.requireFirstServiceByType(AWSService);

  const identity = await awsService.getCallerIdentity();
  return {
    Account: identity.Account,
    Arn: identity.Arn,
    UserId: identity.UserId,
  };
}
