import {ListBucketsCommand} from "@aws-sdk/client-s3";
import {Registry} from "@token-ring/registry";
import {z} from "zod";
import AWSService from "../AWSService.ts";

export const description = "Lists all S3 buckets in the configured AWS account and region.";
export const parameters = z.object({});

/**
 * Executes the list S3 buckets tool.
 *
 * Returns either a JSON object containing the buckets array or an error object.
 * All error messages conform to the `{ error: string }` shape.
 */
export default async function execute(_args: string, registry: Registry) {
  const awsService = registry.services.getFirstServiceByType(AWSService);
  if (!awsService) {
    // Return error without tool name prefix
    return {error: "AWSService not found in registry."} as const;
  }

  if (!awsService.isAuthenticated()) {
    return {error: "AWS credentials not configured in AWSService."} as const;
  }

  try {
    const s3Client = awsService.getS3Client();
    const command = new ListBucketsCommand({});
    const response: any = await s3Client.send(command);
    const buckets = (response.Buckets || []).map((bucket: any) => ({
      Name: bucket.Name,
      CreationDate: bucket.CreationDate,
    }));
    // Return only the data payload
    return {buckets} as const;
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    return {error: `Error listing S3 buckets: ${message}`} as const;
  }
}
