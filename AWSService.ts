import { S3Client } from "@aws-sdk/client-s3";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import type { TokenRingService } from "@tokenring-ai/app/types";
import { ConfigurationError } from "@tokenring-ai/app/types";
import { S3Client as BunS3Client } from "bun";
import type { z } from "zod";

import type { AWSConfigSchema, S3BucketMount } from "./schema.ts";

export type AWSAccountInfo = {
  Arn?: string | undefined;
  Account?: string | undefined;
  UserId?: string | undefined;
};

export type AWSServiceStatus =
  | {
      active: true;
      service: string;
      authenticated: true;
      accountInfo: AWSAccountInfo;
    }
  | {
      active: true;
      service: string;
      authenticated: false;
    };

/**
 * AWSService provides an interface for interacting with various AWS services.
 * It handles AWS client initialization and basic authentication checks.
 */
export default class AWSService implements TokenRingService {
  readonly name = "AWSService";
  description = "Provides AWS functionality";
  private stsClient: STSClient | undefined;
  private s3Client: S3Client | undefined;
  /** Bun's built-in S3 clients, one per configured bucket mount. */
  private bucketClients = new Map<string, BunS3Client>();
  private options: z.output<typeof AWSConfigSchema> | undefined;

  constructor(options?: z.output<typeof AWSConfigSchema>) {
    if (options) this.options = options;
  }

  reconfigure(options: z.output<typeof AWSConfigSchema>): void {
    this.options = options;
    this.stsClient = undefined;
    this.s3Client = undefined;
    this.bucketClients.clear();
  }

  getRegion(): string {
    if (!this.options) {
      throw new ConfigurationError(this.name, "AWS credentials are not configured.");
    }
    return this.options.region;
  }

  /**
   * Initializes a generic AWS SDK client.
   */
  initializeAWSClient<T>(
    ClientClass: new (
      config: {
        region: string;
        credentials: {
          accessKeyId: string;
          secretAccessKey: string;
          sessionToken?: string;
        };
      } & Record<string, unknown>,
    ) => T,
    clientConfig: Record<string, unknown> = {},
  ): T {
    if (!this.options) {
      throw new ConfigurationError(this.name, "AWS credentials are not configured.");
    }
    const credentials = {
      accessKeyId: this.options.accessKeyId,
      secretAccessKey: this.options.secretAccessKey,
      ...(this.options.sessionToken ? { sessionToken: this.options.sessionToken } : {}),
    };
    return new ClientClass({
      region: this.options.region,
      credentials,
      ...clientConfig,
    });
  }

  /** Gets or creates an STS client. */
  getSTSClient(): STSClient {
    if (!this.isAuthenticated()) {
      throw new ConfigurationError(this.name, "AWS credentials are not configured.");
    }
    if (!this.stsClient) {
      this.stsClient = this.initializeAWSClient(STSClient);
    }
    return this.stsClient;
  }

  /** Gets or creates the AWS SDK S3 client (used for account-level calls such as ListBuckets). */
  getS3Client(): S3Client {
    if (!this.isAuthenticated()) {
      throw new ConfigurationError(this.name, "AWS credentials are not configured.");
    }
    if (!this.s3Client) {
      this.s3Client = this.initializeAWSClient(S3Client);
    }
    return this.s3Client;
  }

  /**
   * Gets or creates Bun's built-in S3 client for one configured bucket, using the bucket's own
   * region and endpoint when it sets them (an endpoint makes it work with R2, MinIO and the like).
   */
  getBucketClient(bucket: string): BunS3Client {
    if (!this.isAuthenticated() || !this.options) {
      throw new ConfigurationError(this.name, "AWS credentials are not configured.");
    }
    let client = this.bucketClients.get(bucket);
    if (!client) {
      const mount = this.options.s3?.buckets[bucket];
      client = new BunS3Client({
        accessKeyId: this.options.accessKeyId,
        secretAccessKey: this.options.secretAccessKey,
        ...(this.options.sessionToken ? { sessionToken: this.options.sessionToken } : {}),
        region: mount?.region ?? this.options.region,
        ...(mount?.endpoint ? { endpoint: mount.endpoint } : {}),
        bucket,
      });
      this.bucketClients.set(bucket, client);
    }
    return client;
  }

  /** Configured S3 bucket mounts (the s3:// remote store), keyed by bucket name. Empty without credentials. */
  getS3Buckets(): { bucket: string; mount: S3BucketMount }[] {
    if (!this.isAuthenticated()) return [];
    return Object.entries(this.options?.s3?.buckets ?? {}).map(([bucket, mount]) => ({ bucket, mount }));
  }

  /** Checks if credentials and region are configured. */
  isAuthenticated(): boolean {
    return !!(this.options?.accessKeyId && this.options.secretAccessKey && this.options.region);
  }

  /** Retrieves the caller identity using AWS STS. */
  async getCallerIdentity(): Promise<AWSAccountInfo> {
    if (!this.isAuthenticated()) {
      throw new ConfigurationError(this.name, "AWS credentials are not configured.");
    }
    const stsClient = this.getSTSClient();
    const command = new GetCallerIdentityCommand({});
    const response = await stsClient.send(command);
    return {
      Arn: response.Arn,
      Account: response.Account,
      UserId: response.UserId,
    };
  }

  /** Reports the status of the service without throwing when unauthenticated. */
  async status(): Promise<AWSServiceStatus> {
    if (!this.isAuthenticated()) {
      return { active: true, service: "AWSService", authenticated: false };
    }
    const identity = await this.getCallerIdentity();
    return {
      active: true,
      service: "AWSService",
      authenticated: true,
      accountInfo: identity,
    };
  }
}
