import { ListBucketsCommand } from "@aws-sdk/client-s3";
import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
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
async function execute(_args: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const awsService = agent.requireServiceByType(AWSService);

  if (!awsService.isAuthenticated()) {
    throw new ToolCallError(name, `AWS credentials not configured in AWSService.`);
  }

  try {
    const s3Client = awsService.getS3Client();
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);
    const buckets = (response.Buckets ?? []).map(bucket => ({
      Name: bucket.Name,
      CreationDate: bucket.CreationDate,
    }));
    return JSON.stringify({ buckets });
  } catch (err) {
    throw new ToolCallError(name, `Failed to list S3 buckets`, { cause: err });
  }
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
