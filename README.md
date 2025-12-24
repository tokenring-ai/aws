# @tokenring-ai/aws

## Overview

The `@tokenring-ai/aws` package provides AWS integration for TokenRing AI agents. It enables secure authentication with AWS services using STS (Security Token Service) and provides tools for basic AWS operations like listing S3 buckets. The package is designed as a `TokenRingPlugin` that integrates seamlessly with the TokenRing AI ecosystem, providing tools and commands for agent workflows.

This package focuses on secure credential handling and client initialization for AWS SDK v3, allowing agents to perform AWS operations like querying account identity and managing S3 resources.

## Features

- **Secure AWS Authentication**: Uses AWS SDK v3 with proper credential management
- **S3 Bucket Listing**: Provides a tool to list all S3 buckets in the configured account
- **Account Identity**: Retrieves AWS account information via STS
- **Plugin Architecture**: Integrates with TokenRing application framework
- **Service Status**: Provides authentication status and account information
- **Chat Commands**: Interactive AWS commands for status checking
- **Generic Client Initialization**: Supports initialization of any AWS SDK client

## Installation

```bash
bun install @tokenring-ai/aws
```

## Setup and Configuration

### Basic Configuration

1. **Install the package** in your TokenRing AI project
2. **Configure AWS credentials** - you can provide them through environment variables or directly in the configuration:

```typescript
import { TokenRingApp } from "@tokenring-ai/app";
import awsPlugin from "@tokenring-ai/aws";

const app = new TokenRingApp({
  // ... other app configuration
  plugins: [
    awsPlugin
  ]
});

// Or configure with environment variables:
// AWS_ACCESS_KEY_ID=your-access-key
// AWS_SECRET_ACCESS_KEY=your-secret-key
// AWS_REGION=us-east-1
// AWS_SESSION_TOKEN=optional-session-token
```

### Manual Service Configuration

If you need more control over the service configuration:

```typescript
import AWSService from "@tokenring-ai/aws";
import { TokenRingApp } from "@tokenring-ai/app";

const app = new TokenRingApp({
  // ... other app configuration
  services: [
    new AWSService({
      accessKeyId: "your-access-key",
      secretAccessKey: "your-secret-key", 
      region: "us-east-1",
      sessionToken: "optional-session-token" // optional
    })
  ]
});
```

## Package Structure

```
pkg/aws/
├── index.ts                 # Entry point and plugin definition
├── AWSService.ts            # Core AWS service implementation
├── tools.ts                 # Tool exports
├── chatCommands.ts          # Chat command exports
├── plugin.ts                # Plugin installation and configuration
├── tools/
│   └── listS3BucketsTool.ts # S3 bucket listing tool
└── commands/
    └── aws.ts               # AWS chat commands
```

## Core Components

### AWSService

The main service class that handles AWS SDK clients and authentication.

**Constructor Properties:**
- `accessKeyId` (string, required): AWS Access Key ID
- `secretAccessKey` (string, required): AWS Secret Access Key  
- `sessionToken` (string, optional): AWS Session Token for temporary credentials
- `region` (string, required): AWS region (e.g., 'us-east-1')

**Key Methods:**
- `initializeAWSClient<T>(ClientClass, clientConfig)`: Initializes any AWS SDK client
- `getSTSClient()`: Returns or creates an STS client
- `getS3Client()`: Returns or creates an S3 client
- `isAuthenticated()`: Checks if credentials and region are configured
- `getCallerIdentity()`: Retrieves AWS account identity via STS
- `run(signal)`: Service startup with authentication check
- `status(agent)`: Returns service status and account information

### Available Tools

#### listS3Buckets

Lists all S3 buckets in the configured AWS account and region.

**Usage:**
```typescript
// Tool name: "aws_listS3Buckets"
// Description: "Lists all S3 buckets in the configured AWS account and region."
// Input schema: {} (no parameters)

// Example result:
{
  buckets: [
    { Name: "my-bucket", CreationDate: "2023-01-01T00:00:00.000Z" },
    { Name: "another-bucket", CreationDate: "2023-02-15T10:30:00.000Z" }
  ]
}
```

### Chat Commands

#### aws

Provides chat-based commands for AWS status checks.

**Available Commands:**
- `aws status`: View current AWS authentication status and account information

**Usage Example:**
```
> aws status
AWS Authentication Status:
  Account: 123456789012
  Arn: arn:aws:iam::123456789012:user/example
  UserId: AIDAEXAMPLEUSER
  Region: us-east-1
```

## Usage Examples

### 1. Basic Service Usage

```typescript
import AWSService from "@tokenring-ai/aws";

const awsService = new AWSService({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION || 'us-east-1'
});

// Check authentication status
if (awsService.isAuthenticated()) {
  const identity = await awsService.getCallerIdentity();
  console.log(`Account: ${identity.Account}`);
  console.log(`ARN: ${identity.Arn}`);
}
```

### 2. Using S3 Client

```typescript
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import AWSService from "@tokenring-ai/aws";

const awsService = new AWSService({
  accessKeyId: "your-access-key",
  secretAccessKey: "your-secret-key",
  region: "us-east-1"
});

const s3Client = awsService.getS3Client();
const command = new ListBucketsCommand({});
const response = await s3Client.send(command);
console.log('S3 Buckets:', response.Buckets);
```

### 3. Generic AWS Client Initialization

```typescript
import { SNSClient } from "@aws-sdk/client-sns";
import AWSService from "@tokenring-ai/aws";

const awsService = new AWSService({
  // ... credentials
});

const snsClient = awsService.initializeAWSClient(SNSClient, {
  // Additional SNS-specific configuration
});
```

### 4. Using the S3 Buckets Tool

```typescript
import { TokenRingApp } from "@tokenring-ai/app";
import awsPlugin from "@tokenring-ai/aws";

const app = new TokenRingApp({
  plugins: [awsPlugin]
});

const agent = app.createAgent();
const result = await agent.executeTool("aws_listS3Buckets", {});
console.log('S3 Buckets:', result.buckets);
```

## API Reference

### AWSService

```typescript
class AWSService implements TokenRingService {
  constructor(credentials: AWSCredentials)
  initializeAWSClient<T>(ClientClass: new (config: {
    region: string;
    credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
  } & Record<string, unknown>) => T, clientConfig?: Record<string, unknown>): T
  getSTSClient(): STSClient
  getS3Client(): S3Client
  isAuthenticated(): boolean
  async getCallerIdentity(): Promise<{ Arn?: string; Account?: string; UserId?: string }>
  async run(signal: AbortSignal): Promise<void>
  async status(agent: Agent): Promise<{
    active: boolean;
    service: string;
    authenticated: boolean;
    accountInfo?: { Arn?: string; Account?: string; UserId?: string }
    error?: string;
  }>
}
```

### AWSCredentials Interface

```typescript
interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
}
```

### Plugin Configuration

```typescript
export const AWSConfigSchema = z.any().optional();

export default {
  name: "@tokenring-ai/aws",
  version: "0.2.0",
  description: "AWS integration providing authentication status and S3 interaction",
  install(app: TokenRingApp): void
} satisfies TokenRingPlugin
```

## License

MIT License - see LICENSE file for details.

## Contributing

- Ensure all tests pass before submitting changes
- Follow the established code style and patterns
- Add appropriate documentation for new features
- Update tests to cover new functionality