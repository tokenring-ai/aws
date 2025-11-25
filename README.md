# @tokenring-ai/aws

## Overview

The `@tokenring-ai/aws` package provides AWS integration for TokenRing AI agents. It enables authentication with AWS services using STS (Security Token Service) and basic interaction with S3, such as listing buckets. The package is designed as a `TokenRingPlugin` that integrates seamlessly with the TokenRing AI ecosystem, providing tools and commands for agent workflows.

This package focuses on secure credential handling and client initialization for AWS SDK v3, allowing agents to perform AWS operations like querying account identity and managing S3 resources.

## Installation

```bash
npm install @tokenring-ai/aws
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
- `getSTSClient()`: Returns or creates an STS client
- `getS3Client()`: Returns or creates an S3 client
- `isAuthenticated()`: Checks if credentials and region are configured
- `getCallerIdentity()`: Retrieves AWS account identity via STS
- `start()`: Service startup with authentication check
- `stop()`: Service shutdown
- `status()`: Returns service status and account information

### Available Tools

#### listS3Buckets

Lists all S3 buckets in the configured AWS account and region.

**Usage:**
```typescript
// Tool name: "aws/listS3Buckets"
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
import AWSService from "@tokenring-ai/aws";

const awsService = new AWSService({
  accessKeyId: "your-access-key",
  secretAccessKey: "your-secret-key",
  region: "us-east-1"
});

const s3Client = awsService.getS3Client();
// Use s3Client for S3 operations
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

## API Reference

### AWSService

```typescript
class AWSService implements TokenRingService {
  constructor(credentials: AWSCredentials)
  getSTSClient(): STSClient
  getS3Client(): S3Client
  initializeAWSClient<T>(ClientClass: any, clientConfig?: Record<string, unknown>): T
  isAuthenticated(): boolean
  getCallerIdentity(): Promise<{ Arn?: string; Account?: string; UserId?: string }>
  start(): Promise<void>
  stop(): Promise<void>
  status(agent: Agent): Promise<{
    active: boolean
    service: string
    authenticated: boolean
    accountInfo?: { Arn?: string; Account?: string; UserId?: string }
    error?: string
  }>
}
```

### AWSCredentials Interface

```typescript
interface AWSCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  region: string
}
```

### Plugin Configuration

```typescript
export const AWSConfigSchema = z.any().optional();

export default {
  name: "@tokenring-ai/aws",
  version: "0.1.0",
  description: "AWS integration providing authentication status and S3 interaction",
  install(app: TokenRingApp): void
} as TokenRingPlugin
```

## Dependencies

- `@aws-sdk/client-s3@^3.934.0`: S3 client for AWS operations
- `@aws-sdk/client-sts@^3.934.0`: STS client for authentication
- `@tokenring-ai/app`: TokenRing application framework
- `@tokenring-ai/agent`: Agent framework integration
- `@tokenring-ai/chat`: Chat service integration
- `zod@^4.1.12`: Schema validation
- `node-fetch@^3.3.2`: HTTP client

## Development

### Scripts

```bash
# Run ESLint
npm run eslint
```

### TypeScript Configuration

The package uses TypeScript with ES modules (`"type": "module"` in package.json).

## Security Considerations

- **Credential Management**: Never hardcode credentials in your code. Use environment variables or secure secret management
- **Least Privilege**: Use IAM roles with minimal required permissions
- **Session Tokens**: For temporary credentials, provide session tokens when available
- **Region Configuration**: Always specify the appropriate AWS region

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run eslint` to ensure code quality
5. Submit a pull request

## Future Enhancements

The package is designed to be extensible. Future enhancements could include:
- Additional AWS service clients (EC2, Lambda, DynamoDB, etc.)
- More sophisticated tools for AWS resource management
- Enhanced error handling and retry logic
- Support for AWS credential chain providers