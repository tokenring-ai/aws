import Agent from "@tokenring-ai/agent/Agent";
import AWSService from "../AWSService.js";

export const description = "AWS commands for authentication and status";

export async function execute(remainder: string, agent: Agent) {
  const awsService = agent.requireFirstServiceByType(AWSService);
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
    for (const line of help()) {
      agent.infoLine(line);
    }
  }
}

// noinspection JSUnusedGlobalSymbols
export function help() {
  return [
    "aws status   # View current AWS authentication status and account information.",
  ];
}
