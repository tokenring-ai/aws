import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { Registry } from "@token-ring/registry";
import { z } from "zod";
import AWSService from "../AWSService.ts";

export const name = "aws/listS3Buckets";
export const description = "Lists all S3 buckets in the configured AWS account and region.";
export const parameters = z.object({});

/**
 * Executes the list S3 buckets tool.
 *
 * Returns a JSON object containing the buckets array.
 * Errors are thrown with a message prefixed by the tool name.
 */
export async function execute(_args: any, registry: Registry) {
  const awsService = registry.services.getFirstServiceByType(AWSService);
  if (!awsService) {
    throw new Error(`[${name}] AWSService not found in registry.`);
  }

  if (!awsService.isAuthenticated()) {
    throw new Error(`[${name}] AWS credentials not configured in AWSService.`);
  }

  try {
    const s3Client = awsService.getS3Client();
    const command = new ListBucketsCommand({});
    const response: any = await s3Client.send(command);
    const buckets = (response.Buckets || []).map((bucket: any) => ({
      Name: bucket.Name,
      CreationDate: bucket.CreationDate,
    }));
    return { buckets } as const;
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[${name}] Error listing S3 buckets: ${message}`);
  }
}
