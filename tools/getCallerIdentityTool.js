// tools/getCallerIdentityTool.js
import AWSService from '../AWSService.js';
import { z } from 'zod';

export const description = "Fetches and displays the AWS caller identity (Account, ARN, UserId) using the configured credentials.";
export const parameters = z.object({});

export default async function execute(args, registry) {
  const awsService = registry.getService(AWSService.name);
  if (!awsService) {
    return { ok: false, stderr: "AWSService not found in registry." };
  }

  try {
    const identity = await awsService.getCallerIdentity();
    // Ensure identity is serializable and contains relevant info
    const result = {
      Account: identity.Account,
      Arn: identity.Arn,
      UserId: identity.UserId
    };
    return { ok: true, stdout: JSON.stringify(result, null, 2), data: result };
  } catch (error) {
    return { ok: false, stderr: `Error getting caller identity: ${error.message}`, error: error.toString() };
  }
}
