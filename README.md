# AWS Package Documentation

## Overview

The `@tokenring-ai/aws` package provides AWS integration for TokenRing AI agents. It enables authentication with AWS services using STS (Security Token Service) and basic interaction with S3, such as listing buckets. The package is designed as a `TokenRingService` that can be injected into agents, supporting startup authentication checks, status reporting, and tools/commands for agent workflows. It focuses on secure credential handling and client initialization for AWS SDK v3.

This package is part of the larger TokenRing AI ecosystem, allowing agents to perform AWS operations like querying account identity and managing S3 resources.

## Installation/Setup

1. Ensure you have Node.js (v18+) and npm installed.
2. Install the package as a dependency in your TokenRing AI project:
   ```
   npm install @tokenring-ai/aws
   ```
3. Configure AWS credentials (Access Key ID, Secret Access Key, optional Session Token, and Region) when instantiating the `AWSService`. These can be provided via environment variables or directly in the service configuration.
4. Import and register the service in your agent team setup, e.g.:
   ```typescript
   import AWSService from '@tokenring-ai/aws';
   // In agent team configuration
   const awsService = new AWSService({
     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
     region: process.env.AWS_REGION || 'us-east-1'
   });
   agentTeam.addService(awsService);
   ```
5. The service will authenticate on startup by calling `getCallerIdentity()`.

## Package Structure

The package follows a modular TypeScript structure:

- **index.ts**: Entry point exporting the `AWSService` and package metadata (`TokenRingPackage`) including tools and chat commands.
- **AWSService.ts**: Core service class implementing `TokenRingService` for AWS client management and authentication.
- **tools.ts**: Exports available tools (e.g., S3 bucket listing).
- **tools/listS3BucketsTool.ts**: Specific tool for listing S3 buckets.
- **chatCommands.ts**: Exports chat commands for AWS interactions.
- **commands/aws.ts**: Implementation of AWS-related chat commands (e.g., status check).
- **package.json**: Defines dependencies, exports, and scripts.
- **tsconfig.json**: TypeScript configuration.
- **LICENSE**: MIT license file.

Directories:
- `tools/`: Agent tools for AWS operations.
- `commands/`: Chat command implementations.

## Core Components

### AWSService

The main class that handles AWS SDK clients and authentication.

- **Description**: Initializes STS and S3 clients with provided credentials. Performs authentication checks and provides identity information. Implements `TokenRingService` lifecycle methods (`start`, `stop`, `status`).

- **Key Methods**:
  - `constructor(credentials: AWSCredentials)`: Initializes with `accessKeyId`, `secretAccessKey`, optional `sessionToken`, and `region`.
  - `initializeAWSClient<T>(ClientClass, clientConfig?)`: Generic method to create AWS SDK clients.
    - Parameters: `ClientClass` (constructor), `clientConfig` (optional config object).
    - Returns: Initialized client instance.
  - `getSTSClient()`: Returns or creates STS client.
    - Returns: `STSClient`.
  - `getS3Client()`: Returns or creates S3 client.
    - Returns: `S3Client`.
  - `isAuthenticated()`: Checks if credentials and region are set.
    - Returns: `boolean`.
  - `getCallerIdentity()`: Retrieves AWS account details via STS.
    - Returns: Promise<{ Arn?: string; Account?: string; UserId?: string }>.
    - Throws: Error if not authenticated or API fails.
  - `start(agentTeam: AgentTeam)`: Starts the service, logs authentication status.
    - Returns: Promise<void>.
  - `stop(agentTeam: AgentTeam)`: Stops the service (logs only).
    - Returns: Promise<void>.
  - `status(agent: Agent)`: Reports service status including authentication and account info.
    - Returns: Promise<{ active: boolean; service: string; authenticated: boolean; accountInfo?; error? }>.

- **Interactions**: Used by tools and commands to access AWS clients. Agents require this service via `agent.requireFirstServiceByType(AWSService)`.

### Tools: listS3Buckets

- **Description**: A tool for agents to list all S3 buckets in the configured account and region.

- **Key Functions**:
  - `execute(args: any, agent: Agent)`: Runs the tool.
    - Requires: AWSService instance.
    - Returns: Promise<{ buckets: Array<{ Name: string; CreationDate: string }> }>.
    - Throws: Error if not authenticated or S3 API fails.
  - Input Schema: `z.object({})` (no parameters).

### Chat Commands: aws

- **Description**: Provides chat-based commands for AWS status checks within the agent interface.

- **Key Functions**:
  - `execute(remainder: string, agent: Agent)`: Parses subcommands like `status`.
    - For `status`: Displays account, ARN, UserId, and region.
    - Returns: void (logs to agent).
  - `help()`: Returns help text array, e.g., "aws status # View current AWS authentication status...".

## Usage Examples

### 1. Basic Service Setup and Authentication
```typescript
import AWSService from '@tokenring-ai/aws';
import { AgentTeam } from '@tokenring-ai/agent';

const awsService = new AWSService({
  accessKeyId: 'your-access-key',
  secretAccessKey: 'your-secret-key',
  region: 'us-east-1'
});

const agentTeam = new AgentTeam(/* ... */);
agentTeam.addService(awsService);

await awsService.start(agentTeam); // Logs successful authentication
const identity = await awsService.getCallerIdentity();
console.log(`Account: ${identity.Account}`);
```

### 2. Using the listS3Buckets Tool in an Agent
```typescript
import Agent from '@tokenring-ai/agent';
import { execute as listS3Buckets } from '@tokenring-ai/aws/tools/listS3BucketsTool';

const agent = new Agent(/* ... */);
const result = await listS3Buckets({}, agent);
console.log(result.buckets); // Array of bucket objects
```

### 3. Chat Command for Status
In an agent chat session:
```
> aws status
AWS Authentication Status:
  Account: 123456789012
  Arn: arn:aws:iam::123456789012:user/example
  UserId: AIDAEXAMPLEUSER
  Region: us-east-1
```

## Configuration Options

- **AWSCredentials Interface**:
  - `accessKeyId` (string, required): AWS Access Key ID.
  - `secretAccessKey` (string, required): AWS Secret Access Key.
  - `sessionToken` (string, optional): For temporary credentials (e.g., from STS AssumeRole).
  - `region` (string, required): AWS region (e.g., 'us-east-1').

- Environment Variables: Recommended for production (e.g., `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`).

- Service Properties: Defined in `AWSService.constructorProperties` for schema validation (using Zod-like types).

No additional configs; clients use default AWS SDK settings unless overridden in `initializeAWSClient`.

## API Reference

- **AWSService**:
  - `new AWSService(credentials: AWSCredentials)`
  - `getSTSClient(): STSClient`
  - `getS3Client(): S3Client`
  - `getCallerIdentity(): Promise<{ Arn?: string; Account?: string; UserId?: string }>`

- **Tools**:
  - `aws/listS3Buckets.execute(args: {}, agent: Agent): Promise<{ buckets: Array<{ Name: string; CreationDate: string }> }>`

- **Chat Commands**:
  - `aws status`: Displays authentication status.

- **Exports**:
  - `AWSService` (default)
  - `packageInfo: TokenRingPackage` (with `chatCommands` and `tools`)

## Dependencies

- `@aws-sdk/client-s3@^3.864.0`: For S3 operations.
- `@aws-sdk/client-sts@^3.864.0`: For authentication checks.
- `@tokenring-ai/agent`: Core agent framework (for services, tools, commands).
- `@tokenring-ai/filesystem@0.1.0`: File system utilities (unused in core but declared).
- `node-fetch@^3.3.2`: HTTP client (for potential AWS calls).
- `zod@^4.0.17`: Schema validation for tool inputs.

## Contributing/Notes

- **Testing**: Run `npm run eslint` for linting. Unit tests for AWSService and tools are recommended but not included.
- **Building**: Use TypeScript compilation (`tsc`) via tsconfig.json.
- **Limitations**: Currently supports only STS identity and S3 listing. Expand by adding more clients/tools (e.g., EC2, Lambda).
- **Security**: Never hardcode credentials; use IAM roles or environment variables. The package does not handle credential rotation.
- **License**: MIT.

For contributions, fork the repo, add features (e.g., new tools), and submit PRs. Ensure compatibility with TokenRing AI agent lifecycle.