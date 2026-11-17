import z from "zod";

export const S3BucketMountSchema = z
  .object({
    description: z.string().default("S3").meta({ description: "Label shown for this bucket" }),
    prefix: z.string().default("").meta({ description: "Only keys under this prefix are reachable, e.g. reports/ (empty for the whole bucket)" }),
    region: z.string().exactOptional().meta({ description: "The bucket's region, when it differs from the default region" }),
    endpoint: z.string().exactOptional().meta({ description: "S3-compatible endpoint (Cloudflare R2, MinIO, …); omit for Amazon S3" }),
    writable: z.boolean().default(false).meta({ description: "Allow agents to upload files to this bucket (each upload still asks for approval)" }),
    contextualSearch: z.boolean().default(false).meta({ description: "Include this bucket's file names in chat @ search" }),
  })
  .strict();

export type S3BucketMount = z.output<typeof S3BucketMountSchema>;

export const AWSConfigSchema = z
  .object({
    accessKeyId: z.string().meta({ description: "AWS access key ID" }),
    secretAccessKey: z.string().meta({ sensitive: true, description: "AWS secret access key" }),
    sessionToken: z.string().exactOptional().meta({ sensitive: true, description: "Temporary session token (STS)" }),
    region: z.string().meta({ description: "Default AWS region (e.g. us-east-1)" }),
    s3: z
      .object({
        buckets: z
          .record(z.string(), S3BucketMountSchema)
          .default({})
          .meta({ description: "Buckets agents and the Remote files app can reach, keyed by bucket name (s3://<bucket>/<key>)" }),
      })
      .exactOptional()
      .meta({ label: "S3 buckets" }),
  })
  .strict()
  .meta({ description: "AWS configuration options" })
  .optional();
