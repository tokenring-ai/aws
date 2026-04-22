# @tokenring-ai/aws

## Overview

The `@tokenring-ai/aws` package provides AWS service management for Token Ring
agents. It handles AWS client initialization, authentication verification using
AWS STS, and S3 bucket listing functionality. The package implements a
TokenRingPlugin that automatically registers services, tools, and chat commands
when configured.

**Key Features:**

- AWS authentication verification using STS GetCallerIdentity
- Automatic AWS SDK client management with singleton pattern
- S3 bucket listing tool for discovering available buckets
- Chat command interface for authentication status checks
- Service registration and lifecycle management via plugin system
- Support for temporary credentials via session tokens
- Generic AWS client initialization for extending to other AWS services
- Zod-based configuration schema for type-safe credentials management

**Integration Points:**

- Integrates with `@tokenring-ai/app` for plugin registration
- Uses `@tokenring-ai/chat` for tool registration
- Uses `@tokenring-ai/agent` for command registration and service access

## Installation

```bash
bun add @tokenring-ai/aws
```

## Dependencies

| Package                 | Version   | Purpose                            |
|:------------------------|:----------|:-----------------------------------|
| `@tokenring-ai/agent`   | 0.2.0     | Agent framework for tool execution |
| `@tokenring-ai/app`     | 0.2.0     | Application framework for plugins  |
| `@tokenring-ai/chat`    | 0.2.0     | Chat service for tool registration |
| `@aws-sdk/client-s3`    | ^3.1025.0 | S3 service client                  |
| `@aws-sdk/client-sts`   | ^3.1025.0 | STS service client                 |
| `@tokenring-ai/utility` | 0.2.0     | Utility functions                  |
| `zod`                   | ^4.3.6    | Runtime type validation            |

## Features

- **AWS Authentication**: Uses AWS SDK v3 with credential management
- **S3 Bucket Listing**: Tool to list all S3 buckets in configured account
- **Account Identity**: Retrieves AWS account info via STS GetCallerIdentity
- **Service Architecture**: Implements TokenRingService for lifecycle management
- **Chat Commands**: Interactive `aws status` command for status checking
- **Generic Client Initialization**: Supports any AWS SDK client via
  `initializeAWSClient`
- **Flexible Configuration**: Zod-based configuration schema
- **Singleton Client Management**: AWS SDK clients cached and reused

## Chat Commands

| Command      | Description                            |
|:-------------|:---------------------------------------|
| `aws status` | View current AWS authentication status |

### aws status

View current AWS authentication status and account information.

**Usage:**

```bash
aws status
```

**Output Format:**

```text
AWS Authentication Status:
  Account: 123456789012
  Arn: arn:aws:iam::123456789012:user/example
  UserId: AIDAI23EXAMPLE
  Region: us-east-1
```

## Tools

| Tool                | Description                                        |
|:--------------------|:---------------------------------------------------|
| `aws_listS3Buckets` | Lists all S3 buckets in the configured AWS account |

### aws_listS3Buckets

Lists all S3 buckets in the configured AWS account and region.

**Input Schema:** Empty object (no parameters required)

**Returns:** JSON object containing buckets array:

```json
{
  "buckets": [
    {
      "Name": "example-bucket",
      "CreationDate": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Example Usage:**

```typescript
const result = await agent.callTool("aws_listS3Buckets", {});
console.log("S3 Buckets:", result.data.buckets);
```

## Configuration

### Configuration Schema

The package uses a strict Zod schema for configuration:

```typescript
import {z} from "zod";

export const AWSConfigSchema = z.object({
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  sessionToken: z.string().exactOptional(),
  region: z.string(),
}).strict();
```

### Required Configuration Parameters

| Parameter         | Type   | Description                              |
|:------------------|:-------|:-----------------------------------------|
| `accessKeyId`     | string | AWS Access Key ID for authentication     |
| `secretAccessKey` | string | AWS Secret Access Key for authentication |
| `region`          | string | AWS region (e.g., 'us-east-1')           |

### Optional Configuration Parameters

| Parameter      | Type   | Description                                 |
|:---------------|:-------|:--------------------------------------------|
| `sessionToken` | string | AWS session token for temporary credentials |

### Configuration Example

```yaml
aws:
  accessKeyId: AKIAIOSFODNN7EXAMPLE
  secretAccessKey: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
  region: us-east-1
```

### Configuration with Session Token

```yaml
aws:
  accessKeyId: AKIAIOSFODNN7EXAMPLE
  secretAccessKey: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
  sessionToken: IQoJb3JpZ2luI...
  region: us-east-1
```

### Environment Variable Configuration

```typescript
{
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    region: process.env.AWS_REGION || 'us-east-1'
  }
}
```

## Usage Examples

### Plugin Installation

The recommended way to use the AWS package is via the plugin system:

```typescript
import { TokenRingApp } from "@tokenring-ai/app";
import awsPlugin from "@tokenring-ai/aws";

const app = new TokenRingApp();

app.install(awsPlugin, {
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION || 'us-east-1'
  }
});

// Service automatically available
const awsService = app.requireService('AWSService');

// Check authentication status
if (awsService.isAuthenticated()) {
  const identity = await awsService.getCallerIdentity();
  console.log(`Account: ${identity.Account}`);
  console.log(`ARN: ${identity.Arn}`);
  console.log(`UserId: ${identity.UserId}`);
}
```

### Direct Service Initialization

For advanced usage, you can instantiate the service directly:

```typescript
import AWSService from "@tokenring-ai/aws";

const awsService = new AWSService({
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1"
});

// Verify authentication
if (awsService.isAuthenticated()) {
  const identity = await awsService.getCallerIdentity();
  console.log(`Account: ${identity.Account}`);
  console.log(`ARN: ${identity.Arn}`);
  console.log(`UserId: ${identity.UserId}`);
}
```

### Listing S3 Buckets

Via Tool:

```typescript
// Access the agent from TokenRing application
const agent = app.createAgent();

// Execute the tool
const result = await agent.callTool("aws_listS3Buckets", {});
console.log("S3 Buckets:", result.data.buckets);

result.data.buckets.forEach((bucket) => {
  console.log(`Bucket: ${bucket.Name} - Created: ${bucket.CreationDate}`);
});
```

Via Service:

```typescript
import { ListBucketsCommand } from "@aws-sdk/client-s3";

const s3Client = awsService.getS3Client();
const command = new ListBucketsCommand({});
const response = await s3Client.send(command);

console.log("S3 Buckets:", response.Buckets?.map(b => b.Name));
```

Via Chat Command:

```typescript
// Send the command via agent
await agent.sendMessage("aws status");
```

### Authentication Verification

```typescript
import AWSService from "@tokenring-ai/aws";

const awsService = new AWSService({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!
});

// Check if credentials are configured
console.log("Authenticated:", awsService.isAuthenticated());

// Get detailed account information
try {
  const identity = await awsService.getCallerIdentity();
  console.log("Account:", identity.Account);
  console.log("ARN:", identity.Arn);
  console.log("User ID:", identity.UserId);
} catch (error) {
  console.error("Authentication failed:", error.message);
}
```

### Extending to Other AWS Services

The `initializeAWSClient` method allows creating clients for other AWS services:

```typescript
import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {SNSClient} from "@aws-sdk/client-sns";
import {SQSClient} from "@aws-sdk/client-sqs";

// Create a DynamoDB client using the configured credentials
const dynamoDBClient = awsService.initializeAWSClient(DynamoDBClient);

// Create an SNS client
const snsClient = awsService.initializeAWSClient(SNSClient);

// Create an SQS client with additional configuration
const sqsClient = awsService.initializeAWSClient(SQSClient, {
  endpoint: "https://sqs.us-east-1.amazonaws.com"
});

// Use the clients as normal
```

### Using Session Tokens

For temporary credentials (e.g., from IAM roles or assume-role):

```typescript
const awsService = new AWSService({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  sessionToken: process.env.AWS_SESSION_TOKEN!,
  region: process.env.AWS_REGION!
});

// The session token will be automatically included in all client requests
const identity = await awsService.getCallerIdentity();
console.log("Temporary credentials active for:", identity.Arn);
```

## Core Components/API

### AWSService

Main service class for AWS functionality management. Implements the
`TokenRingService` interface.

**Class Definition:**

```typescript
export default class AWSService implements TokenRingService {
  readonly name = "AWSService";
  description = "Provides AWS functionality";
  private stsClient?: STSClient;
  private s3Client?: S3Client;

  constructor(readonly options: z.output<typeof AWSConfigSchema>);
}
```

**Method Signatures:**

| Method                | Description                                 | Parameters                    | Returns                    |
|:----------------------|:--------------------------------------------|:------------------------------|:---------------------------|
| `initializeAWSClient` | Initializes a generic AWS SDK client        | `ClientClass`, `clientConfig` | Initialized AWS SDK client |
| `getSTSClient`        | Gets or creates the STS client singleton    | None                          | `STSClient` instance       |
| `getS3Client`         | Gets or creates the S3 client singleton     | None                          | `S3Client` instance        |
| `isAuthenticated`     | Checks if credentials and region configured | None                          | `boolean`                  |
| `getCallerIdentity`   | Retrieves AWS account info via STS          | None                          | Promise with account info  |
| `status`              | Reports service status                      | `_agent`                      | Promise with status object |

**Detailed Method Documentation:**

#### `initializeAWSClient<T>(ClientClass, clientConfig)`

Creates and returns a new AWS SDK client instance using configured credentials.

```typescript
initializeAWSClient<T>(
  ClientClass: new (config: {
    region: string;
    credentials: { accessKeyId: string; secretAccessKey: string; 
                 sessionToken?: string };
  } & Record<string, unknown>) => T,
  clientConfig: Record<string, unknown> = {}
): T
```

**Parameters:**

- `ClientClass`: The AWS SDK client constructor
- `clientConfig`: Optional additional configuration to merge

**Returns:** Initialized AWS SDK client instance

**Example:**

```typescript
import {DynamoDBClient} from "@aws-sdk/client-dynamodb";

const dynamoDBClient = awsService.initializeAWSClient(DynamoDBClient);
```

#### `getSTSClient()`

Gets or creates the STS client using singleton pattern.

```typescript
getSTSClient(): STSClient
```

**Returns:** `STSClient` instance

#### `getS3Client()`

Gets or creates the S3 client using singleton pattern.

```typescript
getS3Client(): S3Client
```

**Returns:** `S3Client` instance

#### `isAuthenticated()`

Checks if AWS credentials and region are configured.

```typescript
isAuthenticated(): boolean
```

**Returns:** `true` if `accessKeyId`, `secretAccessKey`, and `region` configured

#### `getCallerIdentity()`

Retrieves AWS account information by calling STS GetCallerIdentity.

```typescript
async getCallerIdentity(): Promise<{
  Arn?: string;
  Account?: string;
  UserId?: string;
}>
```

**Returns:** Object containing:

- `Arn`: The ARN of the caller
- `Account`: The AWS account ID
- `UserId`: The unique user ID

**Throws:** Error if credentials not configured or STS call fails

#### `status(agent)`

Reports the current status of the AWSService.

```typescript
async status(_agent: Agent): Promise<{
  active: boolean;
  service: string;
  authenticated: boolean;
  accountInfo?: { Arn?: string; Account?: string; UserId?: string };
  error?: string;
}>
```

**Parameters:**

- `_agent`: Agent instance for service access

**Returns:** Status object with:

- `active`: Whether the service is active
- `service`: Service name ("AWSService")
- `authenticated`: Whether authentication successful
- `accountInfo`: Account information if authenticated
- `error`: Error message if authentication failed

## Integration

### Plugin Registration

The AWS plugin automatically registers components when configured:

```typescript
import { TokenRingApp } from "@tokenring-ai/app";
import awsPlugin from "@tokenring-ai/aws";

const app = new TokenRingApp();

app.install(awsPlugin, {
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION || 'us-east-1'
  }
});
```

**Component Registration Flow:**

1. Plugin install phase waits for ChatService
2. Registers tool `aws_listS3Buckets` with ChatService
3. Waits for AgentCommandService
4. Registers command `aws status` with AgentCommandService
5. Adds AWSService instance to app services

### Service Access

Agents can access the AWSService directly:

```typescript
import AWSService from "@tokenring-ai/aws";

const agent = app.createAgent();
const awsService = agent.requireServiceByType(AWSService);

// Check authentication
if (awsService.isAuthenticated()) {
  const identity = await awsService.getCallerIdentity();
  console.log(`Account: ${identity.Account}`);
  console.log(`ARN: ${identity.Arn}`);
  console.log(`UserId: ${identity.UserId}`);
}
```

### Tool Usage

The plugin automatically adds the `aws_listS3Buckets` tool:

```typescript
const app = new TokenRingApp();
app.install(awsPlugin, {
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!
  }
});

const agent = app.createAgent();

// Use the S3 buckets tool
const result = await agent.callTool("aws_listS3Buckets", {});
console.log('S3 Buckets:', result.data.buckets);
```

### Command Usage

The plugin automatically adds the `aws` command:

```typescript
const app = new TokenRingApp();
app.install(awsPlugin, {
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!
  }
});

const agent = app.createAgent();

// Use the aws status command
await agent.sendMessage("aws status");
```

## RPC Endpoints

This package does not define RPC endpoints. It provides AWS functionality
through the AWSService class and integrates with the agent system via tools
and commands.

## State Management

This package does not implement state management. The AWSService maintains
in-memory client instances (STSClient, S3Client) using the singleton pattern,
but these are not persisted across application restarts.

## AWS Error Handling

The package implements comprehensive error handling strategies.

### Service-Level Errors

The service throws errors when authentication is not configured:

```typescript
async getCallerIdentity(): Promise<{ Arn?: string; Account?: string; 
                                      UserId?: string }> {
  if (!this.isAuthenticated()) {
    throw new Error("AWS credentials are not configured.");
  }
  // ... operation
}
```

### Tool Execution Errors

Tool errors are wrapped with tool-name prefixes for clear error attribution:

```typescript
async execute(_args: {}, agent: Agent) {
  const awsService = agent.requireServiceByType(AWSService);

  if (!awsService.isAuthenticated()) {
    throw new Error(`[${name}] AWS credentials not configured.`);
  }

  try {
    // ... operation
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[${name}] Failed to list S3 buckets: ${message}`);
  }
}
```

### Chat Command Errors

Chat commands use CommandFailedError for user-facing error messages:

```typescript
async execute(remainder: string, agent: Agent) {
  try {
    const identity = await awsService.getCallerIdentity();
    // Display successful results
  } catch (error: unknown) {
    throw new CommandFailedError(
      `Failed to get AWS caller identity: ${error instanceof Error 
        ? error.message : String(error)}`
    );
  }
}
```

### Common Error Scenarios

| Error                                                | Cause                          | Resolution                        |
|:-----------------------------------------------------|:-------------------------------|:----------------------------------|
| `AWS credentials are not configured.`                | Missing credentials in service | Provide complete configuration    |
| `Failed to get AWS caller identity`                  | Invalid credentials            | Verify credentials and network    |
| `[aws_listS3Buckets] AWS credentials not configured` | Tool without credentials       | Configure credentials first       |
| Service returns `authenticated: false`               | STS call failed                | Check credentials and permissions |
| `[aws_listS3Buckets] Failed to list S3 buckets`      | AWS S3 service error           | Review AWS S3 documentation       |

## Package Structure

```text
pkg/aws/
├── README.md                    # Documentation
├── index.ts                     # Main exports (AWSService)
├── AWSService.ts                # Core service class
├── plugin.ts                    # Token Ring plugin registration
├── schema.ts                    # Configuration schema definition
├── tools.ts                     # Barrel export for all tools
├── tools/
│   └── listS3BucketsTool.ts     # S3 bucket listing tool
├── commands.ts                  # Barrel export for all commands
├── commands/
│   └── awsStatus.ts             # AWS status chat command
├── package.json                 # Package manifest
├── vitest.config.ts             # Test configuration
└── LICENSE                      # License file (MIT)
```

## Best Practices

### Credential Security

- **Never commit AWS credentials to version control**
- Use environment variables for credential storage
- Restrict AWS Key usage to least privilege
- Rotate credentials regularly
- Consider using IAM roles in production environments
- Use session tokens for temporary credentials when possible

### Service Management

- Leverage singleton pattern for AWS clients (STSClient, S3Client)
- Properly handle service lifecycle management
- Monitor service status for authentication failures
- Use `isAuthenticated()` before performing AWS operations

### Error Handling

- Always check `isAuthenticated()` before AWS operations
- Wrap tool operations with error handling
- Use agent services for user-facing error messages
- Prefix errors with tool names for debugging
- Catch and handle SDK-specific errors appropriately

### Performance

- AWS SDK clients are cached and reused (singleton pattern)
- Use appropriate timeout configurations for sensitive operations
- Reuse client instances across multiple operations
- Consider connection pooling for high-throughput scenarios

### Extensibility

- Use `initializeAWSClient` to create clients for other AWS services
- Follow the same authentication pattern for new service integrations
- Maintain consistency in error handling across new tools

## Testing and Development

### Running Tests

The package includes comprehensive test coverage using vitest:

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Generate coverage report
bun run test:coverage

# Run type checking and build verification
bun run build

# Run ESLint and fix formatting issues
bun run eslint
```

### Package Scripts

| Script          | Description                   |
|:----------------|:------------------------------|
| `test`          | Run all tests with vitest     |
| `test:watch`    | Run tests in watch mode       |
| `test:coverage` | Generate test coverage report |
| `build`         | Run TypeScript type checking  |
| `eslint`        | Fix ESLint formatting issues  |

## Related Components

- **AWSService**: Core service implementation with client management
- **tools.ts**: Module exporting all AWS tools
- **commands.ts**: Module exporting all AWS commands
- **plugin.ts**: Token Ring plugin registration and service setup

## License

MIT License - see LICENSE file for details.
