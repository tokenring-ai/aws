export const description = "AWS commands for authentication and status";

export async function execute(this: any, remainder: string, _registry: any) {
  const awsService = this.owner;
  const [subcommand, ..._args] = remainder.trim().split(/\s+/);

  if (subcommand === "status") {
    try {
      const identity = await awsService.getCallerIdentity();
      console.log("AWS Authentication Status:");
      console.log(`  Account: ${identity.Account}`);
      console.log(`  Arn: ${identity.Arn}`);
      console.log(`  UserId: ${identity.UserId}`);
      console.log(`  Region: ${awsService.region}`);
    } catch (error: any) {
      console.error("Failed to get AWS caller identity:", error.message);
      console.log("Please ensure AWS credentials and region are correctly configured in the AWSService.");
    }
  } else {
    this.help();
  }
}

export function help() {
  return [
    "aws status   # View current AWS authentication status and account information.",
  ];
}
