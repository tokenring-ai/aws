import AWSService from "./AWSService.ts";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";

import { FileSystemService } from "@token-ring/filesystem";
import {Registry} from "@token-ring/registry";

interface CtorParams {
  bucketName: string;
  awsServiceInstanceName: string;
  defaultSelectedFiles?: string[];
  registry: Registry;
}

export default class S3FileSystemService extends FileSystemService {
  name = "S3FileSystemService";
  description = "Provides FileSystem interface for an AWS S3 bucket";

  static constructorProperties = {
    bucketName: {
      type: "string",
      required: true,
      description: "The name of the S3 bucket to interact with.",
    },
    awsServiceInstanceName: {
      type: "string",
      required: true,
      description: "The name of the configured AWSService instance in the registry.",
    },
    defaultSelectedFiles: {
      type: "array",
      required: false,
      description: "S3 keys of files/objects manually selected by default.",
      default: [],
    },
  } as const;

  private bucketName: string;
  private awsServiceInstanceName: string;
  private registry: Registry;
  private s3Client: S3Client | null;

  constructor({ bucketName, awsServiceInstanceName, defaultSelectedFiles, registry }: CtorParams) {
    super({ defaultSelectedFiles });

    if (!registry) {
      throw new Error("S3FileSystem constructor requires a 'registry' instance.");
    }
    if (!bucketName) {
      throw new Error("S3FileSystem requires a 'bucketName'.");
    }
    if (!awsServiceInstanceName) {
      throw new Error("S3FileSystem requires an 'awsServiceInstanceName'.");
    }

    this.bucketName = bucketName;
    this.awsServiceInstanceName = awsServiceInstanceName;
    this.registry = registry;

    this.s3Client = null;
  }

  private _getS3Client(): S3Client {
    if (this.s3Client) {
      return this.s3Client;
    }
    const awsService = this.registry.requireFirstServiceByType(AWSService);
    this.s3Client = awsService.getS3Client();
    if (!this.s3Client) {
      throw new Error("Failed to get S3 client from AWSService.");
    }
    return this.s3Client;
  }

  private _s3Key(fsPath: string): string {
    if (typeof fsPath !== "string") {
      throw new Error("Path must be a string.");
    }
    const normalizedPath = fsPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    const parts = normalizedPath.split("/");
    const resultParts: string[] = [];
    for (const part of parts) {
      if (part === "..") {
        if (resultParts.length === 0) {
          throw new Error(`Invalid path: ${fsPath} attempts to traverse above bucket root.`);
        }
        resultParts.pop();
      } else if (part !== "." && part !== "") {
        resultParts.push(part);
      }
    }
    return resultParts.join("/");
  }

  async writeFile(fsPath: string, content: any): Promise<boolean> {
    const s3Client = this._getS3Client();
    const s3Key = this._s3Key(fsPath);
    if (!s3Key) throw new Error("Path results in an empty S3 key.");

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: content,
    });
    await s3Client.send(command);
    return true;
  }

  async getFile(fsPath: string): Promise<string> {
    const s3Client = this._getS3Client();
    const s3Key = this._s3Key(fsPath);
    if (!s3Key) throw new Error("Path results in an empty S3 key.");

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });
    const response: any = await s3Client.send(command);
    return response.Body.transformToString();
  }

  async deleteFile(fsPath: string): Promise<boolean> {
    const s3Client = this._getS3Client();
    const s3Key = this._s3Key(fsPath);
    if (!s3Key) throw new Error("Path results in an empty S3 key for deletion.");

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });
    await s3Client.send(command);
    return true;
  }

  async exists(fsPath: string): Promise<boolean> {
    const s3Client = this._getS3Client();
    const s3Key = this._s3Key(fsPath);

    if (!s3Key) {
      return false;
    }

    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });
    try {
      await s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async stat(fsPath: string): Promise<{
    path: string;
    isFile: boolean;
    isDirectory: boolean;
    size: number | undefined;
    modified: any;
    contentType?: string;
    etag?: string;
  }> {
    const s3Client = this._getS3Client();
    const originalS3Key = this._s3Key(fsPath);
    const s3Key = originalS3Key || "";

    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    try {
      if (!s3Key) {
        throw { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } } as any;
      }
      const response: any = await s3Client.send(command);
      return {
        path: fsPath,
        isFile: true,
        isDirectory: false,
        size: response.ContentLength,
        modified: response.LastModified,
        contentType: response.ContentType,
        etag: response.ETag?.replace(/"/g, ""),
      };
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        const prefixToCheck = originalS3Key ? originalS3Key + "/" : "";
        const listCommand = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefixToCheck,
          MaxKeys: 1,
        });
        const listResponse: any = await s3Client.send(listCommand);
        if (
          (listResponse.KeyCount && listResponse.KeyCount > 0) ||
          (listResponse.CommonPrefixes && listResponse.CommonPrefixes.length > 0) ||
          originalS3Key === ""
        ) {
          return {
            path: fsPath,
            isFile: false,
            isDirectory: true,
            size: 0,
            modified: null,
          };
        }
        throw new Error(`Path not found: ${fsPath}`);
      }
      throw error;
    }
  }

  async copy(sourceFsPath: string, destinationFsPath: string, _options: any = {}): Promise<boolean> {
    const s3Client = this._getS3Client();
    const sourceKey = this._s3Key(sourceFsPath);
    const destinationKey = this._s3Key(destinationFsPath);

    if (!sourceKey) throw new Error("Source path results in an empty S3 key.");
    if (!destinationKey) throw new Error("Destination path results in an empty S3 key.");

    const command = new CopyObjectCommand({
      Bucket: this.bucketName,
      CopySource: `${this.bucketName}/${sourceKey}`,
      Key: destinationKey,
    });
    await s3Client.send(command);
    return true;
  }

  async *getDirectoryTree(fsPath: string, params: { ig?: (p: string) => boolean; recursive?: boolean } = {}): AsyncGenerator<string> {
    const { ig, recursive = true } = params;
    const s3Prefix = this._s3Key(fsPath);
    const normalizedPrefix = s3Prefix === "" ? "" : s3Prefix.endsWith("/") ? s3Prefix : s3Prefix + "/";

    const s3Client = this._getS3Client();
    let continuationToken: string | undefined = undefined;

    const ignoreFilter = ig || (await super.createIgnoreFilter());

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: normalizedPrefix,
        ContinuationToken: continuationToken,
      });
      const response: any = await s3Client.send(command);

      if (response.Contents) {
        for (const item of response.Contents) {
          if (item.Key === normalizedPrefix && item.Key.endsWith("/")) {
            continue;
          }
          if (!ignoreFilter(item.Key)) {
            yield item.Key as string;
          }
        }
      }

      continuationToken = response.NextContinuationToken as string | undefined;
    } while (continuationToken);
  }

  async createDirectory(fsPath: string, _options: any = {}): Promise<boolean> {
    let s3Key = this._s3Key(fsPath);
    if (s3Key === "") {
      return true;
    }
    if (!s3Key.endsWith("/")) {
      s3Key += "/";
    }

    try {
      const existingStat = await this.stat(s3Key);
      if (existingStat.isDirectory) {
        return true;
      }
    } catch (error: any) {
      if (!error.message?.startsWith("Path not found:")) {
        throw error;
      }
    }

    const s3Client = this._getS3Client();
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: "",
    });
    await s3Client.send(command);
    return true;
  }

  async chown(_path: string, _uid: number, _gid: number): Promise<never> {
    throw new Error("Method chown is not supported by S3FileSystem.");
  }

  async chmod(_path: string, _mode: number): Promise<never> {
    throw new Error("Method chmod is not supported by S3FileSystem.");
  }

  async rename(_oldPath: string, _newPath: string): Promise<never> {
    throw new Error("Method rename is not supported by S3FileSystem. Use copy() and deleteFile() to achieve a move operation.");
  }

  async watch(_dir: string, _options: any): Promise<never> {
    throw new Error("Method watch is not supported by S3FileSystem.");
  }

  async executeCommand(_command: string, _options: any): Promise<never> {
    throw new Error("Method executeCommand is not supported by S3FileSystem.");
  }

  async borrowFile(_fileName: string, _callback: any): Promise<never> {
    throw new Error("Method borrowFile is not supported by S3FileSystem.");
  }

  async glob(_pattern: string, _options: any = {}): Promise<never> {
    throw new Error("Method glob is not fully supported by S3FileSystem. Only prefix-based listing is available via getDirectoryTree.");
  }

  async grep(_searchString: string, _options: any = {}): Promise<never> {
    throw new Error("Method grep is not supported by S3FileSystem. Consider using S3 Select for specific use cases or downloading files for local search.");
  }
}
