# AWS Integration

AWS integration package providing authentication status verification, S3 bucket listing, and generic AWS SDK client initialization for Token Ring agents and applications.

## Overview

The AWS integration package manages AWS credentials and provides an interface for interacting with various AWS services. It handles STS-based authentication verification via `GetCallerIdentity`, provides automatic S3 client creation, and supports generic AWS SDK client initialization for any service. The package includes tool-based operations for S3 bucket listing and a chat command for authentication status verification.

## Key Features

- STS-based AWS authentication verification using `GetCallerIdentity` command
- Automatic AWS SDK client management with singleton pattern (S3Client, STSClient)
- Generic AWS client initialization for any AWS SDK service
- S3 bucket listing tool for searching bucket names and creation dates
- Chat command interface for quick authentication status checks
- Service registration and lifecycle management via Token Ring plugin system
- Tool-based S3 operations with proper error wrapping
- Robust error handling with standardized error messages prefixed with tool names

## Core Components

### AWSService

Main service class for AWS functionality management.

**Interface Definition:**

```typescript
interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
}
```

**Class Architecture:**

```typescript
class AWSService implements TokenRingService {
  name: "AWSService";
  description: "Provides AWS functionality";
  public region!: string;  // Public readonly property

  private readonly accessKeyId!: string;  // Private readonly credentials
  private readonly secretAccessKey!: string;
  private readonly sessionToken?: string;
  private stsClient?: STSClient;  // Singleton pattern
  private s3Client?: S3Client;

  constructor(credentials: AWSCredentials);

  // Public methods
  initializeAWSClient<T>(
    ClientClass: new (config: {
      region: string;
      credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
    } & Record<string, unknown>) => T,
    clientConfig?: Record<string, unknown>
  ): T;

  getSTSClient(): STSClient;
  getS3Client(): S3Client;
  isAuthenticated(): boolean;
  async getCallerIdentity(): Promise<{ Arn?: string; Account?: string; UserId?: string }>;
  async run(signal: AbortSignal): Promise<void>;
  async status(agent: Agent): Promise<{
    active: boolean;
    service: string;
    authenticated: boolean;
    accountInfo?: { Arn?: string; Account?: string; UserId?: string };
    error?: string;
  }>;
}
```

**Service Lifecycle:**

The service starts by verifying AWS credentials through a background operation:
```typescript
async run(signal: AbortSignal): Promise<void> {
  console.log("AWSService starting");
  try {
    const identity = await this.getCallerIdentity();
    console.log("AWS authentication successful:", identity);
  } catch (error: any) {
    console.error("AWSService failed to start:", error.message);
  }
  return waitForAbort(signal, async (ev) => {
    //TODO: Probably not needed
    console.log("AWSService stopping");
  });
}
```

### Tools

The package provides one tool for S3 operations registered via the chat service during plugin installation.

#### AWS List S3 Buckets

Lists all S3 buckets in the configured AWS account and region.

**Tool Definition:**

```typescript
{
  name: "aws_listS3Buckets",
  displayName: "Aws/listS3BucketsTool",
  description: "Lists all S3 buckets in the configured AWS account and region.",
  inputSchema: z.object({}),
  execute: (_args: z.input<typeof inputSchema>, agent: Agent) => Promise<{
    buckets: Array<{ Name: string; CreationDate: Date }>
  }>
}
```

**Usage:**

```typescript
const result = await awsService.getS3Client().send(new ListBucketsCommand({}));
```

### Chat Commands

#### AWS Command

Base command for AWS operations with subcommand parsing.

**Subcommands:**

- `status`: View current AWS authentication status and account information

**Command Structure:**

```typescript
{
  description: "AWS commands for authentication and status",
  execute: async (remainder: string, agent: Agent) => void,
  help: string
}
```

**Help Text:**

```markdown
# AWS Commands

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

**Note:** The 'status' command will fail if AWS credentials are not properly configured.
```

## Installation

The AWS integration package is part of the Token Ring ecosystem. Install via npm:

```bash
npm install @tokenring-ai/aws
```

## Configuration

### Configuration Schema

The package uses a flexible Zod schema for configuration:

```typescript
import {z} from "zod";

export const AWSConfigSchema = z.any().optional();
```

This allows for both typed configuration and optional passthrough of configuration from the parent application.

### Configuration Example

**Basic Configuration:**

```typescript
{
  aws: {
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1"
  }
}
```

**Configuration with Session Token:**

```typescript
{
  aws: {
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    sessionToken: "IQoJb3JpZ2luI...",
    region: "us-east-1"
  }
}
```

**Configuration from Environment:**

```typescript
{
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  }
}
```

### Required Configuration Parameters

- **accessKeyId**: AWS Access Key ID for authentication
- **secretAccessKey**: AWS Secret Access Key for authentication

### Optional Configuration Parameters

- **sessionToken**: AWS session token for temporary credentials or assume-role scenarios
- **region**: AWS region where credentials apply (defaults to bucket-specific configuration)

## Usage Examples

### Basic Service Initialization

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
  console.log(`Arn: ${identity.Arn}`);
  console.log(`UserId: ${identity.UserId}`);
}
```

### Listing S3 Buckets

**Via Tool:**

The tool is auto-registered with the agent when the plugin is installed:

```typescript
// Access the agent from TokenRing application
const agent = app.createAgent();

// Execute the tool
const result = await agent.callTool("aws_listS3Buckets", {});
console.log("S3 Buckets:", result.buckets);

result.buckets.forEach((bucket) => {
  console.log(`Bucket: ${bucket.Name} - Created: ${bucket.CreationDate}`);
});
```

**Via Service:**

```typescript
// Direct S3 client access
const s3Client = awsService.getS3Client();
const command = new ListBucketsCommand({});
const response = await s3Client.send(command);

console.log("S3 Buckets:", response.Buckets?.map(b => b.Name));
```

**Via Chat Command:**

```bash
aws status  # Display authentication status
```

### Generic AWS Client Initialization

The service provides a flexible method to initialize any AWS SDK client:

```typescript
// Initialize SNS client for Simple Notification Service
import {SNSClient, ListTopicsCommand} from "@aws-sdk/client-sns";

const snsClient = awsService.initializeAWSClient(SNSClient);
const topics = await snsClient.send(new ListTopicsCommand({}));
console.log("SNS Topics:", topics.Topics?.map(t => t.TopicArn));

// Initialize DynamoDB client with custom endpoint
import {DynamoDBClient, ListTablesCommand} from "@aws-sdk/client-dynamodb";

const dynamoClient = awsService.initializeAWSClient(DynamoDBClient, {
  endpoint: "https://custom-dynamodb.endpoint.amazonaws.com"
});
const tables = await dynamoClient.send(new ListTablesCommand({}));
console.log("DynamoDB Tables:", tables.TableNames);

// Initialize EC2 client with additional configuration
import {EC2Client, DescribeInstancesCommand} from "@aws-sdk/client-ec2";

const ec2Client = awsService.initializeAWSClient(EC2Client, {
  region: "us-west-2"
});
const instances = await ec2Client.send(new DescribeInstancesCommand({}));
console.log("EC2 Instances:", instances.Reservations?.[0]?.Instances);
```

**Client Configuration Options:**

The method accepts additional configuration that will be merged with the service's base configuration:

```typescript
// All clients share the service's region and credentials
// Additional options are applied per-client
const dbClient = awsService.initializeAWSClient(DynamoDBClient, {
  endpoint: "custom-endpoint.amazonaws.com",  // Override default endpoint
  useFipsEndpoint: true                        // Enable FIPS endpoints
});
```

### Authentication Verification

```typescript
import AWSService from "@tokenring-ai/aws";

const awsService = new AWSService({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!
});

// Check if credentials are configured (basic validation)
console.log("Authenticated:", awsService.isAuthenticated());

// Get detailed account information
try {
  const status = await awsService.getCallerIdentity();
  console.log("Account:", status.Account);
  console.log("ARN:", status.Arn);
  console.log("User ID:", status.UserId);
} catch (error) {
  console.error("Authentication failed:", error.message);
}
```

### Service Status Reporting

```typescript
import AWSService from "@tokenring-ai/aws";

const awsService = new AWSService({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!
});

const agent = app.createAgent();
const serviceStatus = await awsService.status(agent);

console.log("Active:", serviceStatus.active);
console.log("Authenticated:", serviceStatus.authenticated);
if (serviceStatus.accountInfo) {
  console.log("Account:", serviceStatus.accountInfo.Account);
}
if (serviceStatus.error) {
  console.error("Error:", serviceStatus.error);
}
```

## Error Handling

The package implements comprehensive error handling strategies:

### Service-Level Errors

Service initialization errors are caught and logged in the `run()` method startup sequence:

```typescript
async run(signal: AbortSignal): Promise<void> {
  console.log("AWSService starting");
  try {
    const identity = await this.getCallerIdentity();
    console.log("AWS authentication successful:", identity);
  } catch (error: any) {
    console.error("AWSService failed to start:", error.message);
    // Service continues running but will fail operations
  }
  // ... rest of lifecycle management
}
```

### Tool Execution Errors

Tool errors are wrapped with tool-name prefixes for clear error attribution:

```typescript
async execute(_args: {}, agent: Agent) {
  const awsService = agent.requireServiceByType(AWSService);

  if (!awsService.isAuthenticated()) {
    throw new Error(`[${name}] AWS credentials not configured in AWSService.`);
  }

  try {
    // ... operation
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[${name}] Error listing S3 buckets: ${message}`);
  }
}
```

### Chat Command Errors

Chat commands use the agent service to communicate errors to the user:

```typescript
async execute(remainder: string, agent: Agent) {
  try {
    const identity = await awsService.getCallerIdentity();
    // Display successful results
  } catch (error: unknown) {
    agent.errorMessage("Failed to get AWS caller identity:", error as Error);
    agent.infoMessage("Please ensure AWS credentials and region are correctly configured in the AWSService.");
  }
}
```

### Common Error Scenarios

1. **Missing Credentials**: `AWS credentials are not configured.`
2. **Auth Failure**: `Failed to get AWS caller identity: [Error details]`
3. **Tool Not Configured**: `[aws_listS3Buckets] AWS credentials not configured in AWSService.`
4. **Service Startup Failure**: `AWSService failed to start: [Error details]`

## Integration Patterns

### Plugin Registration

The service integrates through the Token Ring plugin system:

```typescript
import { TokenRingApp } from "@tokenring-ai/app";
import awsPlugin from "@tokenring-ai/aws";

const app = new TokenRingApp({
  plugins: [
    awsPlugin
  ]
});

// Configure credentials after plugin registration
app.config.aws = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
};
```

### Service Registration During Install

```typescript
{
  name: packageJSON.name,
  install(app, config) {
    if (config.aws) {
      // Wait for chat service and register tools
      app.waitForService(ChatService, chatService =>
        chatService.addTools(tools)
      );

      // Wait for agent command service and register commands
      app.waitForService(AgentCommandService, agentCommandService =>
        agentCommandService.addAgentCommands(chatCommands)
      );

      // Add the AWS service
      app.addServices(new AWSService(config.aws));
    }
  },
  config: z.object({
    aws: AWSConfigSchema,
  })
}
```

### Tool Registration Pattern

Tools are individually defined and registered during plugin installation:

```typescript
import {default as listS3Buckets} from "./tools/listS3BucketsTool.ts";

const tools = {
  listS3Buckets,
};

// Registered in plugin install
app.waitForService(ChatService, chatService =>
  chatService.addTools(tools)
);
```

### Agent Tool Access

Tools access the service via the agent context:

```typescript
async function execute(_args: {}, agent: Agent) {
  const awsService = agent.requireServiceByType(AWSService);

  // Use service methods
  const s3Client = awsService.getS3Client();
  // ... perform operations
}
```

## Package Structure

```
pkg/aws/
├── README.md                    # Documentation
├── index.ts                     # Main exports (AWSService, AWSConfigSchema)
├── AWSService.ts                # Core service class implementing TokenRingService
├── plugin.ts                    # Token Ring plugin registration and service setup
├── tools.ts                     # Barrel export for all tools (listS3Buckets)
├── tools/
│   └── listS3BucketsTool.ts     # S3 bucket listing tool
├── commands/
│   └── aws.ts                   # AWS chat command with status subcommand
├── chatCommands.ts              # Chat command exports (aws)
├── package.json                 # Package metadata and dependencies
├── vitest.config.ts             # Test configuration
└── LICENSE                      # License file (MIT)
```

## Dependencies

The package relies on the following dependencies:

```json
{
  "@tokenring-ai/app": "0.2.0",
  "@tokenring-ai/agent": "0.2.0",
  "@tokenring-ai/chat": "0.2.0",
  "@tokenring-ai/filesystem": "0.2.0",
  "@aws-sdk/client-s3": "^3.967.0",
  "@aws-sdk/client-sts": "^3.967.0",
  "node-fetch": "^3.3.2",
  "zod": "catalog:"
}
```

**Key Dependencies:**

- **@tokenring-ai/app**: Application framework for plugin registration and service management
- **@tokenring-ai/agent**: Agent framework for tool execution and service access
- **@tokenring-ai/chat**: Chat service for tool and command registration
- **@tokenring-ai/filesystem**: Filesystem utilities (added for future extensibility)
- **node-fetch**: HTTP client utility (added for additional integration capabilities)
- **@aws-sdk/client-s3**: S3 service client for bucket listing operations
- **@aws-sdk/client-sts**: STS service client for caller identity verification
- **zod**: Runtime type validation for configuration

## Testing

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

## Best Practices

### Credential Security

- Never commit AWS credentials to version control
- Use environment variables for credential storage
- Restrict AWS Key usage to least privilege
- Rotate credentials regularly
- Consider using IAM roles in production environments

### Service Management

- Leverage singleton pattern for AWS clients (STSClient, S3Client)
- Use `initializeAWSClient()` for cross-service initialization
- Properly handle AbortSignal for service lifecycle management
- Monitor service startup failures in production

### Error Handling

- Always check `isAuthenticated()` before AWS operations
- Wrap tool operations with error handling
- Use agent services for user-facing error messages
- Prefix errors with tool names for debugging

### Performance

- AWS SDK clients are cached and reused (singleton pattern)
- Use appropriate timeout configurations for sensitive operations
- Consider batch operations for multiple S3 interactions
- Minimize unnecessary authentication checks

## Additional Resources

- [Token Ring Documentation](https://github.com/tokenring-ai/tokenring)

## License

MIT License - see [LICENSE](./LICENSE) file for details.
