import { CommandFailedError } from "@tokenring-ai/agent/AgentError";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import indent from "@tokenring-ai/utility/string/indent";
import AWSService from "../AWSService.ts";

const description = "View current AWS authentication status";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({ agent }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const awsService = agent.requireServiceByType(AWSService);
  try {
    const identity = await awsService.getCallerIdentity();
    const lines: string[] = [
      "AWS Authentication Status:",
      indent([`Account: ${identity.Account}`, `Arn: ${identity.Arn}`, `UserId: ${identity.UserId}`, `Region: ${awsService.options.region}`], 1),
    ];
    return lines.join("\n");
  } catch (error: unknown) {
    throw new CommandFailedError(`Failed to get AWS caller identity: ${Error.isError(error) ? error.message : String(error)}`);
  }
}

const help: string = `/aws status - View current AWS authentication status

View current AWS authentication status and account information including account ID, ARN, user ID, and configured region.

## Examples

aws status      # Display current AWS authentication status

## Configuration

Ensure AWS credentials are properly configured in the AWSService with:
- **accessKeyId**: Your AWS Access Key ID
- **secretAccessKey**: Your AWS Secret Access Key
- **region**: Your AWS region (e.g., 'us-east-1')
- **sessionToken**: Optional AWS Session Token (if using temporary credentials)`;

export default {
  name: "aws status",
  description,
  inputSchema,
  execute,
  help,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
