import {Registry} from "@token-ring/registry";
import {z} from "zod";
import AWSService from "../AWSService.ts";

export const description =
  "Fetches and displays the AWS caller identity (Account, ARN, UserId) using the configured credentials.";
export const parameters = z.object({});

/**
 * Executes the GetCallerIdentity tool.
 * Returns the caller identity object on success, or an error object on failure.
 */
export default async function execute(_args: unknown, registry: Registry) {
  const awsService = registry.requireFirstServiceByType(AWSService);

  try {
    const identity = await awsService.getCallerIdentity();
    const result = {
      Account: identity.Account,
      Arn: identity.Arn,
      UserId: identity.UserId,
    };
    return result;
  } catch (error: any) {
    // Return a standardized error object.
    return {error: error?.message ?? String(error)} as { error: string };
  }
}
