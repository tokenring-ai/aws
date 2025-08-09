import AWSService from "../AWSService.ts";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { z } from "zod";

export const description = "Lists all S3 buckets in the configured AWS account and region.";
export const parameters = z.object({});

export default async function execute(_args: unknown, registry: any) {
  const awsService = registry.getService(AWSService.name) as AWSService | undefined;
  if (!awsService) {
    return { ok: false, stderr: "AWSService not found in registry." };
  }

  if (!awsService.isAuthenticated()) {
    return {
      ok: false,
      stderr: "AWS credentials not configured in AWSService.",
    };
  }

  try {
    const s3Client = awsService.getS3Client();
    const command = new ListBucketsCommand({});
    const response: any = await s3Client.send(command);
    const buckets = (response.Buckets || []).map((bucket: any) => ({
      Name: bucket.Name,
      CreationDate: bucket.CreationDate,
    }));
    return {
      ok: true,
      stdout: JSON.stringify({ buckets }, null, 2),
      data: { buckets },
    };
  } catch (error: any) {
    return {
      ok: false,
      stderr: `Error listing S3 buckets: ${error.message}`,
      error: error.toString(),
    };
  }
}
