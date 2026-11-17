# @tokenring-ai/aws

Integration for AWS services, focusing on S3 storage and STS authentication.

## Overview

The `@tokenring-ai/aws` package provides AWS service management for TokenRing
agents. It handles AWS SDK client initialization, authentication verification
using AWS STS `GetCallerIdentity`, and S3 bucket listing. The package implements
a `TokenRingPlugin` that registers an `AWSService`, a chat tool, and a chat
command when installed via the plugin system.

### Key Features

- AWS authentication verification using STS `GetCallerIdentity`
- Automatic AWS SDK client management with singleton pattern (STS and S3 clients)
- S3 bucket listing tool for discovering available buckets
- Configured S3 buckets as an `s3://` remote store: agent tools, the Remote files app, chat
  attachments and optional `@` search
- Chat command interface for authentication status checks
- Generic AWS client initialization via `initializeAWSClient` for extending to
  other AWS services
- Support for temporary credentials via session tokens
- Zod-based configuration schema with `.meta()` annotations for config UI
  integration
- Live reconfiguration: credentials can be updated without an app restart via
  `reconfigure()`

### Integration Points

- Integrates with `@tokenring-ai/app` for plugin registration and service
  lifecycle
- Uses `@tokenring-ai/chat` for tool registration via `ChatService`
- Uses `@tokenring-ai/agent` for command registration via `AgentCommandService`

## Installation

```bash
bun add @tokenring-ai/aws
```

The plugin definition ships in `plugin.ts` and is not re-exported from the
package index, so import it from the subpath:

```typescript
import awsPlugin from "@tokenring-ai/aws/plugin";
```

## Chat Commands

| Command      | Description                                |
|:-------------|:-------------------------------------------|
| `aws status` | View current AWS authentication status     |

### aws status

View current AWS authentication status and account information including account
ID, ARN, user ID, and configured region.

**Usage:**

```text
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

**Throws:** `CommandFailedError` if the STS `GetCallerIdentity` call fails (e.g.
credentials are not configured or invalid).

**Help Text:**

```text
/aws status - View current AWS authentication status

View current AWS authentication status and account information including account ID, ARN, user ID, and configured region.

## Examples

aws status      # Display current AWS authentication status

## Configuration

Ensure AWS credentials are properly configured in the AWSService with:
- **accessKeyId**: Your AWS Access Key ID
- **secretAccessKey**: Your AWS Secret Access Key
- **region**: Your AWS region (e.g., 'us-east-1')
- **sessionToken**: Optional AWS Session Token (if using temporary credentials)
```

## S3 Buckets as Remote Files

Buckets listed under `aws.s3.buckets` become an `s3://` remote store (`S3Store`, built on Bun's
built-in `S3Client`, not the AWS SDK), registered with
`RemoteStoreService` from `@tokenring-ai/filesystem`. They get what every remote store gets:

- the `remote_list`, `remote_read`, `remote_search`, `remote_download` and `remote_upload` agent tools
- the Remote files app (`/remote`) and "Attach from Amazon S3" in the chat composer
- optionally, chat `@` search over file names (`contextualSearch: true`)

S3 is not part of the host filesystem, so there is no grep, glob or terminal access. Agents copy an
object to the host with `remote_download` first.

```yaml
aws:
  accessKeyId: AKIAIOSFODNN7EXAMPLE
  secretAccessKey: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
  region: us-east-1
  s3:
    buckets:
      team-media:              # bucket name; URLs are s3://team-media/<key>
        description: Media     # label: "Media · team-media"
      analytics-exports:
        prefix: reports/       # only keys under reports/ are reachable
        region: eu-west-2      # the bucket's region, if not the default
        writable: true         # allow remote_upload (each upload still asks for approval)
        contextualSearch: true # include file names in chat @ search
```

| Field              | Type    | Default | Description                                                                 |
|:-------------------|:--------|:--------|:----------------------------------------------------------------------------|
| `description`      | string  | `"S3"`  | Label shown for the bucket                                                  |
| `prefix`           | string  | `""`    | Root of the mount; keys outside it are refused                              |
| `region`           | string  | –       | The bucket's region, when it differs from `aws.region`                      |
| `endpoint`         | string  | –       | S3-compatible endpoint (Cloudflare R2, MinIO, …); omit for Amazon S3        |
| `writable`         | boolean | `false` | Allow agents to create and replace objects                                  |
| `contextualSearch` | boolean | `false` | Include this bucket in chat `@` search                                      |

How S3 maps onto the remote store model:

- **URLs** are the familiar `s3://<bucket>/<key>`. Keys ending in `/`, and the bucket root, are folders,
  as in the S3 console; a key without the slash that has objects under it is also treated as a folder.
- **Listing** uses `ListObjectsV2` with a `/` delimiter, one page (up to 1,000 entries) at a time. A folder's
  own placeholder object (`reports/`) is not listed as a file.
- **Types**: objects stored as `binary/octet-stream` or `application/octet-stream` are typed by extension.
- **Search** matches file names only, case-insensitively, because S3 has no search API. It walks keys under
  the mount and stops after 10,000 keys or once it has enough results.
- **Writes** are `PutObject`: `remote_upload` to a folder URL creates `<folder><name>`, and to a file URL
  replaces it.
- **Open in Amazon S3** links go to the S3 console (none for buckets with a custom `endpoint`).

Without credentials (`isAuthenticated()` false) no buckets are mounted.

## Tools

| Tool                | Display Name             | Description                                                    |
|:--------------------|:-------------------------|:---------------------------------------------------------------|
| `aws_listS3Buckets` | `Aws/listS3BucketsTool`  | Lists all S3 buckets in the configured AWS account and region. |

### aws_listS3Buckets

**Description:**

> Lists all S3 buckets in the configured AWS account and region.

**Schema strictness:** `z.object({})` — no input parameters.

**Returns:** A `TokenRingToolResult` with:

- `message`: `**Amazon S3** Listed <count> buckets`
- `result`: JSON string containing a `buckets` array:

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

**Throws:** `ToolCallError` if AWS credentials are not configured in
`AWSService`, or if the S3 `ListBuckets` API call fails.

## Configuration

```yaml
aws:
  accessKeyId: AKIAIOSFODNN7EXAMPLE
  secretAccessKey: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
  region: us-east-1
  # sessionToken: IQoJb3JpZ2luI...  # optional, for temporary credentials
```

The plugin's `configSchema` wraps `AWSConfigSchema` in `z.object({ aws:
AWSConfigSchema })`. The `aws` key itself is optional — the plugin installs
without credentials, and `AWSService.isAuthenticated()` returns `false` until
credentials are supplied.

| Field             | Type   | Required | Default | Description                                 |
|:------------------|:-------|:---------|:--------|:--------------------------------------------|
| `accessKeyId`     | string | Yes*     | –       | AWS Access Key ID for authentication        |
| `secretAccessKey` | string | Yes*     | –       | AWS Secret Access Key for authentication    |
| `region`          | string | Yes*     | –       | AWS region (e.g., `us-east-1`)              |
| `sessionToken`    | string | No       | –       | AWS session token for temporary credentials |

*Required only when the `aws` config section is present. The entire section may
be omitted; the service reports `authenticated: false` in that case.

### Schema Metadata

The `AWSConfigSchema` carries `.meta()` annotations that drive configuration UI
rendering:

| Field             | `.meta()` annotation                                              |
|:------------------|:------------------------------------------------------------------|
| `accessKeyId`     | `{ description: "AWS access key ID" }`                            |
| `secretAccessKey` | `{ sensitive: true, description: "AWS secret access key" }`       |
| `sessionToken`    | `{ sensitive: true, description: "Temporary session token (STS)" }` |
| `region`          | `{ description: "Default AWS region (e.g. us-east-1)" }`          |
| (schema root)     | `{ description: "AWS configuration options" }`                    |

### Environment Variables

The package does not automatically load environment variables. Users must
explicitly read environment variables and pass them to the configuration, for
example through a YAML config file or a config layer:

```typescript
{
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    region: process.env.AWS_REGION!,
  }
}
```

## Core Components

### AWSService

Main service class for AWS functionality management. Implements the
`TokenRingService` interface.

```typescript
export default class AWSService implements TokenRingService {
  readonly name = "AWSService";
  description = "Provides AWS functionality";
  private stsClient: STSClient | undefined;
  private s3Client: S3Client | undefined;
  private bucketClients = new Map<string, Bun.S3Client>();
  private options: z.output<typeof AWSConfigSchema> | undefined;

  constructor(options?: z.output<typeof AWSConfigSchema>);
}
```

The plugin creates `AWSService` with no constructor arguments; configuration is
applied later via `reconfigure()`. When constructed directly with options, the
service uses them immediately.

#### AWSService Methods

| Method                  | Description                                                                    |
|:------------------------|:-------------------------------------------------------------------------------|
| `reconfigure(options)`  | Replaces the stored credentials and drops the cached STS, SDK S3 and per-bucket clients. |
| `getRegion()`           | Returns the configured AWS region. Throws `ConfigurationError` if not configured. |
| `initializeAWSClient<T>(ClientClass, clientConfig?)` | Creates a new AWS SDK client instance using configured credentials. |
| `getSTSClient()`        | Gets or creates the STS client singleton. Throws `ConfigurationError` if not authenticated. |
| `getS3Client()`         | Gets or creates the AWS SDK S3 client, used for account-level calls such as `ListBuckets`. Throws `ConfigurationError` if not authenticated. |
| `getBucketClient(bucket)` | Gets or creates Bun's built-in `S3Client` for one configured bucket (its region and endpoint), cached per bucket. Throws `ConfigurationError` if not authenticated. |
| `getS3Buckets()`        | The configured `aws.s3.buckets` as `{ bucket, mount }` pairs; empty when not authenticated. |
| `isAuthenticated()`     | Returns `true` when `accessKeyId`, `secretAccessKey`, and `region` are all set. |
| `getCallerIdentity()`   | Calls STS `GetCallerIdentity` and returns account info. Throws `ConfigurationError` if not authenticated. |
| `status()`              | Reports service status as a discriminated union without throwing when unauthenticated. |

#### `reconfigure(options)`

```typescript
reconfigure(options: z.output<typeof AWSConfigSchema>): void
```

Replaces the stored credential options and drops the cached STS client, the SDK S3
client and every per-bucket client, so the next calls create fresh clients with
the new credentials.

#### `getRegion()`

```typescript
getRegion(): string
```

Returns the configured AWS region. Throws `ConfigurationError` with the message
`"AWS credentials are not configured."` when no options are set.

#### `initializeAWSClient<T>(ClientClass, clientConfig?)`

```typescript
initializeAWSClient<T>(
  ClientClass: new (config: {
    region: string;
    credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
  } & Record<string, unknown>) => T,
  clientConfig: Record<string, unknown> = {},
): T
```

Creates and returns a new AWS SDK client instance using the configured
credentials. The `sessionToken` is included only when present. Additional
`clientConfig` properties are merged into the constructor call. Throws
`ConfigurationError` if no options are set.

#### `getSTSClient()`

```typescript
getSTSClient(): STSClient
```

Returns the cached STS client, creating one via `initializeAWSClient(STSClient)`
on first call. Throws `ConfigurationError` if not authenticated.

#### `getS3Client()`

```typescript
getS3Client(): S3Client
```

Returns the cached AWS SDK S3 client, creating one via `initializeAWSClient(S3Client)`
on first call. Only the `aws_listS3Buckets` tool uses it (Bun's client has no
`ListBuckets`). Throws `ConfigurationError` if not authenticated.

#### `getBucketClient(bucket)`

```typescript
getBucketClient(bucket: string): Bun.S3Client
```

Returns Bun's built-in `S3Client` for one configured bucket, created with the
configured credentials and the bucket's own `region` and `endpoint` when set, and
cached per bucket. `S3Store` makes all its calls through it. Throws
`ConfigurationError` if not authenticated.

#### `getS3Buckets()`

```typescript
getS3Buckets(): { bucket: string; mount: S3BucketMount }[]
```

Returns the buckets configured under `aws.s3.buckets`, keyed by bucket name.
Returns an empty array when credentials are not configured. `S3Store` reads its
mounts from here.

#### `isAuthenticated()`

```typescript
isAuthenticated(): boolean
```

Returns `true` when `options.accessKeyId`, `options.secretAccessKey`, and
`options.region` are all truthy.

#### `getCallerIdentity()`

```typescript
async getCallerIdentity(): Promise<AWSAccountInfo>
```

Calls STS `GetCallerIdentity` and returns the response. Throws
`ConfigurationError` if not authenticated.

**Returns:** `AWSAccountInfo` — `{ Arn?: string; Account?: string; UserId?: string }`.

#### `status()`

```typescript
async status(): Promise<AWSServiceStatus>
```

Reports the service status without throwing when credentials are missing or
invalid.

**Returns:** `AWSServiceStatus` discriminated union on `authenticated`:

| Status           | Additional Fields                                    | Description                                    |
|:-----------------|:-----------------------------------------------------|:-----------------------------------------------|
| `authenticated: true`  | `active: true`, `service: "AWSService"`, `accountInfo: AWSAccountInfo` | Credentials are configured and STS `GetCallerIdentity` succeeded. |
| `authenticated: false` | `active: true`, `service: "AWSService"`        | Credentials are not configured (`isAuthenticated()` returns `false`). |

When not authenticated, returns `{ active: true, service: "AWSService", authenticated: false }`
without calling STS. When credentials are configured but the STS call fails (e.g. invalid
credentials or network error), the error propagates from `status()`.

## Services & Lifecycle

### Plugin Lifecycle

The plugin defines no agent lifecycle hooks. It registers the `AWSService` and
wires up tools and commands during `install`, and applies config changes via
`reconfigure`.

| Property       | Value                                                                  |
|:---------------|:-----------------------------------------------------------------------|
| `name`         | `@tokenring-ai/aws`                                                    |
| `displayName`  | `AWS Integration`                                                      |
| `version`      | `0.2.0`                                                                |
| `description`  | `Integration for AWS services, focusing on S3 storage and STS authentication.` |
| `configSchema` | `z.object({ aws: AWSConfigSchema })`                                   |

**`install(app)`** performs the following steps:

1. Registers `AWSService` on the app via `app.addService(AWSService, awsService)`
   (no constructor arguments — config is applied via `reconfigure`).
2. Waits for `ChatService` to become available, then registers the
   `aws_listS3Buckets` tool via `chatService.addTools(tools)`.
3. Waits for `AgentCommandService` to become available, then registers the
   `aws status` command via `agentCommandService.addAgentCommands(agentCommands)`.
4. Waits for `RemoteStoreService` (from `@tokenring-ai/filesystem`), then registers
   an `S3Store`, the `s3://` remote store.

**`reconfigure(app, config)`** calls
`app.requireService(AWSService).reconfigure(config.aws)`, which updates the
stored credentials and resets cached clients, then
`RemoteStoreService.mountsChanged()`, so added or removed buckets (and their
`@` search providers) take effect. This enables live credential
updates without an app restart.

### Plugin Installation

```typescript
import TokenRingApp from "@tokenring-ai/app";
import PluginManager from "@tokenring-ai/app/PluginManager";
import awsPlugin from "@tokenring-ai/aws/plugin";

const app = new TokenRingApp({ app: { workingDirectory, workspaceDirectory, configDirectories } });
const pluginManager = app.addService(new PluginManager(app));
await pluginManager.installPlugins([awsPlugin]);
```

Credentials are supplied through the layered configuration system (YAML config
files or config layers), not through the plugin install call directly.

## RPC

This package does not define RPC endpoints.

## Dependencies

| Package                 | Purpose                                            |
|:------------------------|:---------------------------------------------------|
| `@tokenring-ai/agent`   | Agent framework for tool and command execution     |
| `@tokenring-ai/app`     | Application framework — `TokenRingPlugin`, `TokenRingService`, `ConfigurationError` |
| `@tokenring-ai/chat`    | Chat service for tool registration — `TokenRingToolDefinition`, `TokenRingToolResult`, `ToolCallError` |
| `@tokenring-ai/utility` | String indentation utility (`indent`)              |
| `@tokenring-ai/filesystem` | `RemoteStoreService` and the `RemoteStore` interface that `S3Store` implements |
| `mime-types`            | Types S3 objects by extension when S3 stores them as octet-stream |
| `@aws-sdk/client-s3`    | `ListBuckets` for the `aws_listS3Buckets` tool (the `s3://` store uses Bun's built-in client) |
| `@aws-sdk/client-sts`   | STS service client                                 |
| `zod`                   | Runtime type validation                            |

## Testing

```bash
bun test
```

`test/S3Store.test.ts` covers the `s3://` store against a fake S3 client: mounts
and prefixes, folder listing, stat of files, folders and missing keys, reads typed
by extension, refusing keys outside the prefix, paged name search, create and
replace, per-bucket clients and console links, and unconfigured buckets.

The suite `test/AWSService.test.ts` covers the `status()` method: it returns
`authenticated: false` without throwing when credentials are absent, when
credentials are incomplete, and returns `authenticated: true` with account info
when credentials are configured (using a mocked `getCallerIdentity`).

## License

MIT License — see LICENSE file for details.
