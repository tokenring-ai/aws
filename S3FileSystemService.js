// packages/extra/aws/services/S3FileSystem.js
import AWSService from './AWSService.js'; // To access S3 client
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand
} from '@aws-sdk/client-s3';

import {FileSystemService} from "@token-ring/filesystem";

export default class S3FileSystemService extends FileSystemService {
  name = "S3FileSystemService";
  description = "Provides FileSystem interface for an AWS S3 bucket";

  static constructorProperties = {
    bucketName: {
      type: "string",
      required: true,
      description: "The name of the S3 bucket to interact with."
    },
    awsServiceInstanceName: {
      type: "string",
      required: true,
      description: "The name of the configured AWSService instance in the registry."
    },
    defaultSelectedFiles: {
      type: "array",
      required: false,
      description: "S3 keys of files/objects manually selected by default.",
      default: []
    }
    // region will be derived from the AWSService
  };

  constructor({ bucketName, awsServiceInstanceName, defaultSelectedFiles, registry }) {
    super({ defaultSelectedFiles }); // Pass defaultSelectedFiles to parent constructor

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
    this.registry = registry; // Store registry to get AWSService in start() or on-demand

    this.s3Client = null; // Will be initialized in start() or when first needed
  }

  /**
   * Helper to get the AWSService and S3Client.
   * This ensures AWSService is resolved via the registry.
   */
  _getS3Client() {
    if (this.s3Client) {
      return this.s3Client;
    }
    const awsService = this.registry.getService(this.awsServiceInstanceName);
    if (!awsService || !(awsService instanceof AWSService)) {
      throw new Error(`AWSService instance '${this.awsServiceInstanceName}' not found or is not of the correct type.`);
    }
    this.s3Client = awsService.getS3Client(); // Assuming AWSService has getS3Client()
    if (!this.s3Client) {
      throw new Error("Failed to get S3 client from AWSService.");
    }
    return this.s3Client;
  }

  _s3Key(fsPath) {
    if (typeof fsPath !== 'string') {
      throw new Error('Path must be a string.');
    }
    // Normalize, remove leading/trailing slashes, and ensure no relative traversals that go above root.
    const normalizedPath = fsPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    // Split and rejoin to handle '..' components safely.
    const parts = normalizedPath.split('/');
    const resultParts = [];
    for (const part of parts) {
      if (part === '..') {
        if (resultParts.length === 0) {
          // This would mean trying to go above the "root" (bucket)
          throw new Error(`Invalid path: ${fsPath} attempts to traverse above bucket root.`);
        }
        resultParts.pop();
      } else if (part !== '.' && part !== '') {
        resultParts.push(part);
      }
    }
    return resultParts.join('/');
  }

  async writeFile(fsPath, content) {
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

  async getFile(fsPath) {
    const s3Client = this._getS3Client();
    const s3Key = this._s3Key(fsPath);
    if (!s3Key) throw new Error("Path results in an empty S3 key.");

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });
    const response = await s3Client.send(command);
    return response.Body.transformToString();
  }

  async deleteFile(fsPath) {
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

  async exists(fsPath) {
    const s3Client = this._getS3Client();
    const s3Key = this._s3Key(fsPath);

    if (!s3Key) { // Path like '/' or '' results in empty key
      return false; // Bucket existence is implicitly true if configured, but an empty key isn't an object.
    }

    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });
    try {
      await s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async stat(fsPath) {
    const s3Client = this._getS3Client();
    const originalS3Key = this._s3Key(fsPath); // Keep original for potential directory check

    // S3 keys should not be empty for stat, but if _s3Key produced one (e.g. from '/'), treat as dir check.
    const s3Key = originalS3Key || '';


    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key, // If s3Key is empty, HeadObject on bucket which is not what we want for a file/dir stat.
                 // However, S3 keys can't be empty. If originalS3Key is empty, this will fail as intended.
    });

    try {
      // If s3Key is empty (e.g. path was '/'), this HeadObject will likely fail or return bucket info not object info.
      // An empty key is not a valid object key for stat.
      if (!s3Key) {
         // Treat root path as a directory.
         // Fall through to directory check logic, but provide a valid prefix for it.
         // This effectively means we are checking if the bucket (root) contains any objects.
         // A truly empty s3Key means we are stat-ing the root.
         throw { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } }; // Simulate not found to trigger dir check
      }
      const response = await s3Client.send(command);
      return {
        path: fsPath,
        isFile: true,
        isDirectory: false,
        size: response.ContentLength,
        modified: response.LastModified,
        contentType: response.ContentType,
        etag: response.ETag?.replace(/"/g, ''),
      };
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        // It's not a file, check if it's a "directory" (prefix)
        // For root ('/' or ''), originalS3Key will be empty. We list the root of the bucket.
        const prefixToCheck = originalS3Key ? originalS3Key + '/' : '';
        const listCommand = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefixToCheck,
          MaxKeys: 1, // We only need to know if anything exists under this prefix
        });
        const listResponse = await s3Client.send(listCommand);
        // Check KeyCount (objects directly under prefix) or CommonPrefixes (subdirectories)
        if ((listResponse.KeyCount && listResponse.KeyCount > 0) || (listResponse.CommonPrefixes && listResponse.CommonPrefixes.length > 0) || originalS3Key === '') {
           // If originalS3Key is empty, it's the root, which is always a directory.
          return {
            path: fsPath,
            isFile: false,
            isDirectory: true,
            size: 0,
            modified: null, // S3 prefixes don't have a direct LastModified date
          };
        }
        throw new Error(`Path not found: ${fsPath}`);
      }
      throw error; // Re-throw other errors
    }
  }

  async copy(sourceFsPath, destinationFsPath, options = {}) {
    const s3Client = this._getS3Client();
    const sourceKey = this._s3Key(sourceFsPath);
    const destinationKey = this._s3Key(destinationFsPath);

    if (!sourceKey) throw new Error("Source path results in an empty S3 key.");
    if (!destinationKey) throw new Error("Destination path results in an empty S3 key.");


    const command = new CopyObjectCommand({
      Bucket: this.bucketName,
      CopySource: `${this.bucketName}/${sourceKey}`, // Must be URL-encoded if special chars, S3 SDK handles this
      Key: destinationKey,
    });
    await s3Client.send(command);
    return true;
  }

  async *getDirectoryTree(fsPath, params = {}) {
    const { ig, recursive = true } = params; // `recursive` is handled by not using Delimiter or by depth of iteration
    const s3Prefix = this._s3Key(fsPath);
    // Ensure prefix for listing ends with / if not empty, to list "inside" the directory
    const normalizedPrefix = s3Prefix === '' ? '' : (s3Prefix.endsWith('/') ? s3Prefix : s3Prefix + '/');

    const s3Client = this._getS3Client();
    let continuationToken = undefined;

    // Use the ignore filter from the parent class if not provided
    const ignoreFilter = ig || (await super.createIgnoreFilter());

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: normalizedPrefix,
        ContinuationToken: continuationToken,
        // Delimiter: recursive ? undefined : '/', // If set to '/', only lists top-level items in that prefix
      });
      const response = await s3Client.send(command);

      if (response.Contents) {
        for (const item of response.Contents) {
          // S3 keys are already relative to the bucket root.
          // The ignoreFilter expects paths relative to the conceptual root.
          // Do not yield the directory prefix object itself if it exists (e.g. object named "folder/")
          if (item.Key === normalizedPrefix && item.Key.endsWith('/')) {
            continue;
          }
          if (!ignoreFilter(item.Key)) {
            yield item.Key;
          }
        }
      }

      // To handle "directories" explicitly if Delimiter was used:
      // if (response.CommonPrefixes) {
      //   for (const commonPrefix of response.CommonPrefixes) {
      //     if (!ignoreFilter(commonPrefix.Prefix)) {
      //       yield commonPrefix.Prefix;
      //     }
      //   }
      // }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
  }

  async createDirectory(fsPath, options = {}) {
    let s3Key = this._s3Key(fsPath);
    if (s3Key === '') { // Root directory always exists and cannot be "created" as an object
      return true;
    }
    // Ensure key ends with a slash to denote a directory marker object
    if (!s3Key.endsWith('/')) {
      s3Key += '/';
    }

    // Check if this directory object (or any object with this prefix) already exists.
    // this.stat will tell us if it's a file, a directory (prefix), or doesn't exist.
    try {
      const existingStat = await this.stat(s3Key); // Use fsPath to match user intent, _s3Key will normalize
      if (existingStat.isDirectory) {
        return true; // Directory already effectively exists
      }
      if (existingStat.isFile) {
        // An actual file exists with the name of the intended directory (ending in /). This is unlikely with _s3Key.
        // Or, a file exists with name "foo" and we try to create "foo/".
        // S3 allows "foo" and "foo/" to coexist. So, proceed to create the "foo/" marker.
      }
    } catch (error) {
      // Path not found, so we can create it.
      if (!error.message.startsWith("Path not found:")) {
        throw error; // Re-throw unexpected errors
      }
    }

    // Create an empty object for the directory marker
    const s3Client = this._getS3Client();
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key, // The key ending with a slash
      Body: '',
    });
    await s3Client.send(command);
    return true;
  }

  // TODO: Implement listFiles, which would be similar to getDirectoryTree but might format output differently (e.g., FileSystemEntry objects)
  // TODO: Implement deleteDirectory (requires listing and deleting all objects under the prefix)

  async chown(path, uid, gid) {
    throw new Error('Method chown is not supported by S3FileSystem.');
  }

  async chmod(path, mode) {
    throw new Error('Method chmod is not supported by S3FileSystem.');
  }

  async rename(oldPath, newPath) {
    // S3 rename is copy + delete. This can be a higher-level utility.
    // The core FileSystem expects a more atomic rename.
    throw new Error('Method rename is not supported by S3FileSystem. Use copy() and deleteFile() to achieve a move operation.');
  }

  async watch(dir, options) {
    throw new Error('Method watch is not supported by S3FileSystem.');
  }

  async executeCommand(command, options) {
    throw new Error('Method executeCommand is not supported by S3FileSystem.');
  }

  async borrowFile(fileName, callback) {
    throw new Error('Method borrowFile is not supported by S3FileSystem.');
  }

  async glob(pattern, options = {}) {
    // S3 ListObjectsV2 supports Prefix, not full glob patterns directly.
    // A simple prefix match can be done, but full glob requires client-side filtering of many keys.
    throw new Error('Method glob is not fully supported by S3FileSystem. Only prefix-based listing is available via getDirectoryTree.');
  }

  async grep(searchString, options = {}) {
    throw new Error('Method grep is not supported by S3FileSystem. Consider using S3 Select for specific use cases or downloading files for local search.');
  }
}
