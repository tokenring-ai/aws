import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import AWSService from "../AWSService.js";

const description = "AWS commands for authentication and status";

async function execute(remainder: string, agent: Agent) {
  const awsService = agent.requireServiceByType(AWSService);
  const [subcommand, ..._args] = remainder.trim().split(/\s+/);

  if (subcommand === "status") {
    try {
      const identity = await awsService.getCallerIdentity();
      agent.infoLine("AWS Authentication Status:");
      agent.infoLine(`  Account: ${identity.Account}`);
      agent.infoLine(`  Arn: ${identity.Arn}`);
      agent.infoLine(`  UserId: ${identity.UserId}`);
      agent.infoLine(`  Region: ${awsService.region}`);
    } catch (error: unknown) {
      agent.errorLine("Failed to get AWS caller identity:", error as Error);
      agent.infoLine("Please ensure AWS credentials and region are correctly configured in the AWSService.");
    }
  } else {
    agent.chatOutput(help);
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
} as TokenRingAgentCommand