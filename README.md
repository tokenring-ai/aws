# @tokenring-ai/aws

## Overview

AWS integration package for TokenRing AI agents, providing secure authentication with AWS services using STS (Security Token Service) and enabling agents to perform AWS operations like querying account identity and managing S3 resources. This package is designed as a TokenRing plugin that seamlessly integrates with the TokenRing AI ecosystem, providing tools and commands for agent workflows.

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

## Chat Commands

### aws

Provides chat-based commands for AWS status checks.

**Available Commands**:
- `aws status`: View current AWS authentication status and account information

**Usage Example**:
```
> aws status
AWS Authentication Status:
  Account: 123456789012
  Arn: arn:aws:iam::123456789012:user/example
  UserId: AIDAEXAMPLEUSER
  Region: us-east-1
```

**Configuration Properties**:
- `accessKeyId` (string, required): AWS Access Key ID
- `secretAccessKey` (string, required): AWS Secret Access Key
- `region` (string, required): AWS region (e.g., 'us-east-1')
- `sessionToken` (string, optional): AWS Session Token for temporary credentials

## Tools

### aws_listS3Buckets

Lists all S3 buckets in the configured AWS account and region.

**Tool Name**: `aws_listS3Buckets`

**Description**: "Lists all S3 buckets in the configured AWS account and region."

**Input Schema**:
```json
{}
```

**Example Result**:
```json
{
  "buckets": [
    {
      "Name": "my-bucket",
      "CreationDate": "2023-01-01T00:00:00.000Z"
    },
    {
      "Name": "another-bucket",
      "CreationDate": "2023-02-15T10:30:00.000Z"
    }
  ]
}
```

## Services

### AWSService

The main service class that handles AWS SDK clients and authentication.

**Constructor Parameters**:
- `accessKeyId` (string, required): AWS Access Key ID
- `secretAccessKey` (string, required): AWS Secret Access Key
- `sessionToken` (string, optional): AWS Session Token for temporary credentials
- `region` (string, required): AWS region (e.g., 'us-east-1')

**Key Methods**:

- `initializeAWSClient<T>(ClientClass, clientConfig)`: Initializes any AWS SDK client
  - `ClientClass`: The AWS SDK client class to initialize (e.g., S3Client, SNSClient)
  - `clientConfig`: Additional configuration for the client
  - Returns: Initialized AWS SDK client instance

- `getSTSClient()`: Returns or creates an STS client
  - Returns: `STSClient` instance

- `getS3Client()`: Returns or creates an S3 client
  - Returns: `S3Client` instance

- `isAuthenticated()`: Checks if credentials and region are configured
  - Returns: `boolean` indicating if credentials are properly configured

- `getCallerIdentity()`: Retrieves AWS account identity via STS
  - Returns: `{ Arn?: string; Account?: string; UserId?: string }`

- `run(signal: AbortSignal)`: Service startup with authentication check
  - `signal`: AbortSignal for service lifecycle management
  - Returns: Promise that resolves when service stops

- `status(agent: Agent)`: Returns service status and account information
  - `agent`: The agent instance
  - Returns: `{ active: boolean; service: string; authenticated: boolean; accountInfo?: { Arn?: string; Account?: string; UserId?: string }; error?: string }`

## Usage Examples

### Basic Service Usage

```typescript
import AWSService from "@tokenring-ai/aws";

const awsService = new AWSService({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// Check authentication status
if (awsService.isAuthenticated()) {
  const identity = await awsService.getCallerIdentity();
  console.log(`Account: ${identity.Account}`);
  console.log(`ARN: ${identity.Arn}`);
}
```

### Using S3 Client

```typescript
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import AWSService from "@tokenring-ai/aws";

const awsService = new AWSService({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3Client = awsService.getS3Client();
const command = new ListBucketsCommand({});
const response = await s3Client.send(command);
console.log('S3 Buckets:', response.Buckets);
```

### Generic AWS Client Initialization

```typescript
import { SNSClient } from "@aws-sdk/client-sns";
import AWSService from "@tokenring-ai/aws";

const awsService = new AWSService({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const snsClient = awsService.initializeAWSClient(SNSClient);
```


## Installation

```bash
bun install @tokenring-ai/aws
```

## License

MIT License - see [LICENSE](./LICENSE) file for details.
