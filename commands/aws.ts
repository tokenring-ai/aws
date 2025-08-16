import {ChatService} from "@token-ring/chat";
import {Registry} from "@token-ring/registry";
import AWSService from "../AWSService.js";

export const description = "AWS commands for authentication and status";

export async function execute(remainder: string, registry: Registry) {
  const awsService = registry.requireFirstServiceByType(AWSService);
  const chatService = registry.requireFirstServiceByType(ChatService);
  const [subcommand, ..._args] = remainder.trim().split(/\s+/);

  if (subcommand === "status") {
    try {
      const identity = await awsService.getCallerIdentity();
      chatService.systemLine("AWS Authentication Status:");
      chatService.systemLine(`  Account: ${identity.Account}`);
      chatService.systemLine(`  Arn: ${identity.Arn}`);
      chatService.systemLine(`  UserId: ${identity.UserId}`);
      chatService.systemLine(`  Region: ${awsService.region}`);
    } catch (error: any) {
      console.error("Failed to get AWS caller identity:", error.message);
      chatService.systemLine("Please ensure AWS credentials and region are correctly configured in the AWSService.");
    }
  } else {
    for (const line of help()) {
      chatService.systemLine(line);
    }
  }
}

export function help() {
  return [
    "aws status   # View current AWS authentication status and account information.",
  ];
}
