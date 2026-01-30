import {S3Client} from "@aws-sdk/client-s3";
import {GetCallerIdentityCommand, STSClient} from "@aws-sdk/client-sts";
import Agent from "@tokenring-ai/agent/Agent";

import {TokenRingService} from "@tokenring-ai/app/types";
import waitForAbort from "@tokenring-ai/utility/promise/waitForAbort";
import {z} from "zod";

import {AWSConfigSchema} from "./schema.ts";

/**
 * AWSService provides an interface for interacting with various AWS services.
 * It handles AWS client initialization and basic authentication checks.
 */
export default class AWSService implements TokenRingService {
  name = "AWSService";
  description = "Provides AWS functionality";
  private stsClient?: STSClient;
  private s3Client?: S3Client;

  constructor(readonly options: z.output<typeof AWSConfigSchema>) {
  }

  /**
   * Initializes a generic AWS SDK client.
   */
  initializeAWSClient<T>(ClientClass: new (config: {
    region: string;
    credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
  } & Record<string, unknown>) => T, clientConfig: Record<string, unknown> = {}): T {
    const credentials = {
      accessKeyId: this.options.accessKeyId,
      secretAccessKey: this.options.secretAccessKey,
      ...(this.options.sessionToken ? {sessionToken: this.options.sessionToken} : {}),
    };
    return new ClientClass({
      region: this.options.region,
      credentials,
      ...clientConfig,
    });
  }

  /** Gets or creates an STS client. */
  getSTSClient(): STSClient {
    if (!this.stsClient) {
      this.stsClient = this.initializeAWSClient(STSClient);
    }
    return this.stsClient;
  }

  /** Gets or creates an S3 client. */
  getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = this.initializeAWSClient(S3Client);
    }
    return this.s3Client;
  }

  /** Checks if credentials and region are configured. */
  isAuthenticated(): boolean {
    return !!(this.options.accessKeyId && this.options.secretAccessKey && this.options.region);
  }

  /** Retrieves the caller identity using AWS STS. */
  async getCallerIdentity(): Promise<{ Arn?: string; Account?: string; UserId?: string }> {
    if (!this.isAuthenticated()) {
      throw new Error("AWS credentials are not configured.");
    }
    const stsClient = this.getSTSClient();
    try {
      const command = new GetCallerIdentityCommand({});
      const response = await stsClient.send(command);
      return {
        Arn: response.Arn,
        Account: response.Account,
        UserId: response.UserId,
      };
    } catch (error: any) {
      console.error("Error getting caller identity:", error);
      throw error;
    }
  }

  /** Starts the AWSService. */
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

  /** Reports the status of the service. */
  async status(_agent: Agent): Promise<{
    active: boolean;
    service: string;
    authenticated: boolean;
    accountInfo?: { Arn?: string; Account?: string; UserId?: string };
    error?: string;
  }> {
    try {
      const identity = await this.getCallerIdentity();
      return {
        active: true,
        service: "AWSService",
        authenticated: true,
        accountInfo: identity,
      };
    } catch (error: any) {
      return {
        active: false,
        service: "AWSService",
        authenticated: false,
        error: error.message,
      };
    }
  }
}
