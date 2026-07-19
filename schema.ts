import z from "zod";

export const AWSConfigSchema = z
  .object({
    accessKeyId: z.string().meta({ description: "AWS access key ID" }),
    secretAccessKey: z.string().meta({ sensitive: true, description: "AWS secret access key" }),
    sessionToken: z.string().exactOptional().meta({ sensitive: true, description: "Temporary session token (STS)" }),
    region: z.string().meta({ description: "Default AWS region (e.g. us-east-1)" }),
  })
  .strict();
