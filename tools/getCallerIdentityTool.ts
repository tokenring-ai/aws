import AWSService from "../AWSService.ts";
import { z } from "zod";

export const description =
  "Fetches and displays the AWS caller identity (Account, ARN, UserId) using the configured credentials.";
export const parameters = z.object({});

export default async function execute(_args: unknown, registry: any) {
  const awsService = registry.getService(AWSService.name) as AWSService | undefined;
  if (!awsService) {
    return { ok: false, stderr: "AWSService not found in registry." };
  }

  try {
    const identity = await awsService.getCallerIdentity();
    const result = {
      Account: identity.Account,
      Arn: identity.Arn,
      UserId: identity.UserId,
    };
    return { ok: true, stdout: JSON.stringify(result, null, 2), data: result };
  } catch (error: any) {
    return {
      ok: false,
      stderr: `Error getting caller identity: ${error.message}`,
      error: error.toString(),
    };
  }
}
