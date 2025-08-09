export { default as AWSService } from "./AWSService.ts";
export { default as S3FileSystemService } from "./S3FileSystemService.ts";

export const name = "@token-ring/aws";
export const description =
	"AWS integration providing authentication status and S3 interaction";
export const version = "0.1.0";

export * as chatCommands from "./chatCommands.ts";
export * as tools from "./tools.ts";
