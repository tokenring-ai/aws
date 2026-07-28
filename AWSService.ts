import { S3Client } from "@aws-sdk/client-s3";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingService } from "@tokenring-ai/app/types";
import { ConfigurationError } from "@tokenring-ai/app/types";
import type { z } from "zod";

import type { AWSConfigSchema } from "./schema.ts";

/**
 * AWSService provides an interface for interacting with various AWS services.
 * It handles AWS client initialization and basic authentication checks.
 */
export default class AWSService implements TokenRingService {
  readonly name = "AWSService";
  description = "Provides AWS functionality";
  private stsClient: STSClient | undefined;
  private s3Client: S3Client | undefined;
  private options: z.output<typeof AWSConfigSchema> | undefined;

  constructor(options?: z.output<typeof AWSConfigSchema>) {
    if (options) this.options = options;
  }

  reconfigure(options: z.output<typeof AWSConfigSchema>): void {
    this.options = options;
    this.stsClient = undefined;
    this.s3Client = undefined;
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

  /** Gets or creates an S3 client. */
  getS3Client(): S3Client {
    if (!this.isAuthenticated()) {
      throw new ConfigurationError(this.name, "AWS credentials are not configured.");
    }
    if (!this.s3Client) {
      this.s3Client = this.initializeAWSClient(S3Client);
    }
    return this.s3Client;
  }

  /** Checks if credentials and region are configured. */
  isAuthenticated(): boolean {
    return !!(this.options?.accessKeyId && this.options.secretAccessKey && this.options.region);
  }

  /** Retrieves the caller identity using AWS STS. */
  async getCallerIdentity(): Promise<{
    Arn?: string | undefined;
    Account?: string | undefined;
    UserId?: string | undefined;
  }> {
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

  /** Reports the status of the service. */
  async status(_agent: Agent): Promise<{
    active: true;
    service: string;
    authenticated: boolean;
    accountInfo?: { Arn?: string | undefined; Account?: string | undefined; UserId?: string | undefined };
  }> {
    const identity = await this.getCallerIdentity();
    return {
      active: true,
      service: "AWSService",
      authenticated: true,
      accountInfo: identity,
    };
  }
}
