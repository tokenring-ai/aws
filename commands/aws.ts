import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import indent from "@tokenring-ai/utility/string/indent";
import AWSService from "../AWSService.js";

const description = "AWS commands for authentication and status";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const awsService = agent.requireServiceByType(AWSService);
  const [subcommand, ..._args] = remainder.trim().split(/\s+/);

  if (subcommand === "status") {
    try {
      const identity = await awsService.getCallerIdentity();
      const lines: string[] = [
        "AWS Authentication Status:",
        indent([
          `Account: ${identity.Account}`,
          `Arn: ${identity.Arn}`,
          `UserId: ${identity.UserId}`,
          `Region: ${awsService.options.region}`
        ], 1)
      ];
      return lines.join("\n");
    } catch (error: unknown) {
      throw new CommandFailedError(`Failed to get AWS caller identity: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    return help;
  }
}

const help: string = `# AWS Commands

Manage AWS operations including authentication status and account information.

## Usage

aws [command]

## Available Commands

### status
View current AWS authentication status and account information including account ID, ARN, user ID, and configured region.

## Examples

aws status      # Display current AWS authentication status

## Configuration

Ensure AWS credentials are properly configured in the AWSService with:
- **accessKeyId**: Your AWS Access Key ID
- **secretAccessKey**: Your AWS Secret Access Key
- **region**: Your AWS region (e.g., 'us-east-1')
- **sessionToken**: Optional AWS Session Token (if using temporary credentials)

**Note:** The 'status' command will fail if AWS credentials are not properly configured.`;
export default {
  description,
  execute,
  help,
} satisfies TokenRingAgentCommand