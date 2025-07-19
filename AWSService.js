
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { S3Client } from "@aws-sdk/client-s3";
import { Service } from "@token-ring/registry";

/**
 * AWSService provides an interface for interacting with various AWS services.
 * It handles AWS client initialization and basic authentication checks.
 * Configuration is typically provided via constructor arguments defined in `constructorProperties`.
 */
export default class AWSService extends Service {
 name = "AWSService";
 description = "Provides AWS functionality";
 /**
  * Defines the properties required by the constructor for this service.
  * Used by the system for configuration and validation.
  * @type {Object<string, {type: string, required: boolean, description: string}>}
  */
 static constructorProperties = {
  accessKeyId: { type: "string", required: true, description: "AWS Access Key ID" },
  secretAccessKey: { type: "string", required: true, description: "AWS Secret Access Key" },
  sessionToken: { type: "string", required: false, description: "AWS Session Token (optional)" },
  region: { type: "string", required: true, description: "AWS Region" }
 };

 /**
  * Creates an instance of AWSService.
  * @param {object} params - Parameters for the service.
  * @param {string} params.accessKeyId - AWS Access Key ID.
  * @param {string} params.secretAccessKey - AWS Secret AccessKey.
  * @param {string} [params.sessionToken] - AWS Session Token (optional).
  * @param {string} params.region - AWS Region.
  */
 constructor({ accessKeyId, secretAccessKey, sessionToken, region }) {
  super();
  this.accessKeyId = accessKeyId;
  this.secretAccessKey = secretAccessKey;
  this.sessionToken = sessionToken;
  this.region = region;
 }

 /**
  * Initializes a generic AWS SDK client.
  * @param {Function} ClientClass - The AWS SDK client class (e.g., STSClient, S3Client).
  * @param {object} [clientConfig={}] - Additional configuration for the client.
  * @returns {object} An instance of the specified AWS SDK client.
  */
 initializeAWSClient(ClientClass, clientConfig = {}) {
  const credentials = {
   accessKeyId: this.accessKeyId,
   secretAccessKey: this.secretAccessKey,
  };
  if (this.sessionToken) {
   credentials.sessionToken = this.sessionToken;
  }
  return new ClientClass({
   region: this.region,
   credentials,
   ...clientConfig,
  });
 }

 /**
  * Retrieves an STS (Security Token Service) client.
  * Initializes the client if it doesn't exist.
  * @returns {STSClient} The STS client instance.
  */
 getSTSClient() {
  if (!this.stsClient) {
   this.stsClient = this.initializeAWSClient(STSClient);
  }
  return this.stsClient;
 }

 /**
  * Retrieves an S3 (Simple Storage Service) client.
  * Initializes the client if it doesn't exist.
  * @returns {S3Client} The S3 client instance.
  */
 getS3Client() {
  if (!this.s3Client) {
   this.s3Client = this.initializeAWSClient(S3Client);
  }
  return this.s3Client;
 }

 /**
  * Checks if the necessary AWS credentials and region are configured for the service.
  * @returns {boolean} True if authenticated (credentials and region are set), false otherwise.
  */
 isAuthenticated() {
  return !!(this.accessKeyId && this.secretAccessKey && this.region);
 }

 /**
  * Retrieves the caller identity using AWS STS.
  * This can be used to verify credentials and get account information.
  * @returns {Promise<object>} A promise that resolves to an object containing Arn, Account, and UserId.
  * @throws {Error} If AWS credentials are not configured or if the STS call fails.
  */
 async getCallerIdentity() {
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
  } catch (error) {
   console.error("Error getting caller identity:", error);
   throw error;
  }
 }

 /**
  * Starts the AWSService.
  * Attempts to verify AWS credentials by getting the caller identity.
  * Logs success or failure.
  * @param {TokenRingRegistry} registry - The service registry.
  */
 async start(registry) {
  console.log("AWSService starting");
  try {
   const identity = await this.getCallerIdentity();
   console.log("AWS authentication successful:", identity);
  } catch (error) {
   console.error("AWSService failed to start:", error.message);
  }
 }

 /**
  * Stops the AWSService.
  * Currently, this method only logs a message and does not perform any cleanup.
  * @param {TokenRingRegistry} registry - The service registry.
  */
 async stop(registry) {
  console.log("AWSService stopping");
 }

 /**
  * Reports the status of the service.
  * @param {TokenRingRegistry} registry - The package registry
  * @returns {Object} Status information.
  */
 async status(registry) {
  try {
   const identity = await this.getCallerIdentity();
   return {
    active: true,
    service: "AWSService",
    authenticated: true,
    accountInfo: identity,
   };
  } catch (error) {
   return {
    active: false,
    service: "AWSService",
    authenticated: false,
    error: error.message,
   };
  }
 }
}
