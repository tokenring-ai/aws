import {ListBucketsCommand} from "@aws-sdk/client-s3";
import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import AWSService from "../AWSService.ts";

const name = "aws_listS3Buckets";
const displayName = "Aws/listS3BucketsTool";
const description = "Lists all S3 buckets in the configured AWS account and region.";
const inputSchema = z.object({});

/**
 * Executes the list S3 buckets tool.
 *
 * Returns a JSON object containing the buckets array.
 * Errors are thrown with a message prefixed by the tool name.
 */
async function execute(_args: z.input<typeof inputSchema>, agent: Agent) {
  const awsService = agent.requireServiceByType(AWSService);

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
    return {buckets} as const;
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[${name}] Error listing S3 buckets: ${message}`);
  }
}


export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;