# @token-ring/aws

AWS integration package for Token Ring. It provides:

- AWSService: a service that initializes AWS SDK v3 clients, validates credentials/region, and exposes helper methods like getCallerIdentity and getS3Client.
- S3FileSystemService: an implementation of the FileSystemService interface backed by an S3 bucket, enabling read/write/list/stat operations via the familiar file-system-like API.
- Tools for orchestration and automation: getCallerIdentity and listS3Buckets.
- A chat command aws status to quickly view authentication status in interactive environments.

## Installation

This package is part of the Token Ring monorepo. If you use it externally, install the peer packages shown in package.json and the AWS SDK v3:

- @aws-sdk/client-sts
- @aws-sdk/client-s3
- @token-ring/registry
- @token-ring/filesystem
- zod

## Exports

- AWSService (default export)
- S3FileSystemService (default export)
- tools: getCallerIdentity, listS3Buckets
- chatCommands: aws

See pkg/aws/index.ts for the full export surface.

## AWSService

A registry-managed service that configures AWS clients and exposes identity/status helpers.

Constructor parameters (all required except sessionToken):
- accessKeyId: string
- secretAccessKey: string
- sessionToken?: string
- region: string

Key methods:
- isAuthenticated(): boolean — basic check for configured credentials/region.
- getCallerIdentity(): Promise<{ Arn?: string; Account?: string; UserId?: string }>
- getS3Client(): S3Client — lazily constructed AWS SDK v3 S3 client.
- status(): reports whether authenticated and, if possible, the current caller identity.
- start()/stop(): lifecycle hooks that attempt to verify credentials on start.

Example usage with the Service Registry:

```ts
import { ServiceRegistry } from "@token-ring/registry";
import { AWSService } from "@token-ring/aws";

const registry = new ServiceRegistry();

registry.registerService(
  new AWSService({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN, // optional
    region: process.env.AWS_REGION || "us-east-1",
  })
);

await registry.startAll();

const aws = registry.requireFirstServiceByType(AWSService);
const identity = await aws.getCallerIdentity();
console.log(identity);
```

## S3FileSystemService

Adapts an S3 bucket to the Token Ring FileSystemService interface.

Constructor parameters:
- bucketName: string
- awsServiceInstanceName: string (name of the configured AWSService instance in the registry)
- defaultSelectedFiles?: string[]
- registry: ServiceRegistry

Supported operations:
- writeFile(path, content)
- getFile(path)
- deleteFile(path)
- exists(path)
- stat(path): detects file vs. directory-like prefix
- copy(sourcePath, destinationPath)
- getDirectoryTree(prefix, { ig?, recursive? }): async iterator over keys under a prefix
- createDirectory(path): creates a folder placeholder object ("path/") if needed

Not supported (will throw):
- chown, chmod, rename, watch, executeCommand, borrowFile, glob, grep

Example:

```ts
import { ServiceRegistry } from "@token-ring/registry";
import { AWSService, S3FileSystemService } from "@token-ring/aws";

const registry = new ServiceRegistry();
const aws = new AWSService({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION || "us-east-1",
});
registry.registerService(aws);

const s3fs = new S3FileSystemService({
  bucketName: "my-bucket",
  awsServiceInstanceName: aws.name,
  registry,
});
registry.registerService(s3fs);

await s3fs.writeFile("folder/example.txt", "hello from token ring");
console.log(await s3fs.getFile("folder/example.txt"));
console.log(await s3fs.exists("folder/example.txt"));
console.log(await s3fs.stat("folder"));
```

## Tools

This package exposes two tools via pkg/aws/tools.ts:

- getCallerIdentity: Returns the STS caller identity.
- listS3Buckets: Lists S3 buckets available to the configured credentials.

Tools are designed to run within a ServiceRegistry context. Example pseudo-usage:

```ts
import { tools, AWSService } from "@token-ring/aws";
import { ServiceRegistry } from "@token-ring/registry";

const registry = new ServiceRegistry();
registry.registerService(new AWSService({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION || "us-east-1",
}));

const caller = await tools.getCallerIdentity.default({}, registry);
console.log(caller);

const buckets = await tools.listS3Buckets.default({}, registry);
console.log(buckets);
```

## Chat command

- aws status: Prints the current caller identity and region. This requires an AWSService instance to be registered.

## Authentication and permissions

Ensure the configured credentials have appropriate IAM permissions:
- STS: GetCallerIdentity
- S3: ListBuckets (for listS3Buckets), and relevant S3 object permissions (GetObject, PutObject, DeleteObject, HeadObject, ListBucket) for S3FileSystemService.

## Notes

- Path handling normalizes slashes and prevents traversing above the bucket root.
- S3 is an object store; some traditional file-system operations are not supported and intentionally throw.
- Errors from AWS SDK are propagated; handle them as needed.

## License

MIT License. See LICENSE at repo root.