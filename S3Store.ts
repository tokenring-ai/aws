import type { RemoteContent, RemoteEntry, RemoteListing, RemoteMount, RemoteSearchOptions, RemoteStore } from "@tokenring-ai/filesystem";
import { parseRemoteUrl } from "@tokenring-ai/filesystem/remote/RemoteStore";
import type { S3Client } from "bun";
import mime from "mime-types";
import type AWSService from "./AWSService.ts";
import type { S3BucketMount } from "./schema.ts";

const SCHEME = "s3";
/** S3 has no search API; search walks keys and stops after this many. */
const SEARCH_SCAN_LIMIT = 10_000;
const GENERIC_TYPES = new Set(["application/octet-stream", "binary/octet-stream", ""]);

type Target = { bucket: string; mount: S3BucketMount; key: string; client: S3Client };

/** `reports` → `reports/`; empty stays empty (the bucket root). */
function asFolderKey(key: string): string {
  return key === "" || key.endsWith("/") ? key : `${key}/`;
}

function baseName(key: string): string {
  return key.replace(/\/$/, "").split("/").at(-1) ?? key;
}

function isNotFound(error: unknown): boolean {
  const candidate = error as { code?: unknown; name?: unknown } | null;
  return candidate?.code === "NoSuchKey" || candidate?.code === "NotFound" || candidate?.name === "NotFound";
}

/**
 * S3 buckets as a remote store, with the usual URLs: `s3://<bucket>/<key>`. Keys ending in `/`
 * (and the bucket root) are folders, as in the S3 console. A bucket's `prefix` setting is its root,
 * and keys outside it are refused. Uses Bun's built-in S3 client, so S3-compatible stores work too.
 */
export default class S3Store implements RemoteStore {
  readonly scheme = SCHEME;
  readonly label = "Amazon S3";

  constructor(private readonly aws: AWSService) {}

  mounts(): RemoteMount[] {
    return this.aws.getS3Buckets().map(({ bucket, mount }) => ({
      scheme: SCHEME,
      authority: bucket,
      url: `${SCHEME}://${bucket}/${mount.prefix}`,
      label: `${mount.description} · ${bucket}${mount.prefix ? `/${mount.prefix.replace(/\/$/, "")}` : ""}`,
      writable: mount.writable,
      contextualSearch: mount.contextualSearch,
    }));
  }

  private target(url: string): Target {
    const parsed = parseRemoteUrl(url);
    if (!parsed || parsed.scheme !== SCHEME) throw new Error(`Not an S3 URL: ${url}`);
    const bucket = parsed.authority;
    const mount = this.aws.getS3Buckets().find(candidate => candidate.bucket === bucket)?.mount;
    if (!mount) throw new Error(`S3 bucket "${bucket}" is not configured`);
    const prefix = asFolderKey(mount.prefix);
    const key = parsed.path === "" ? prefix : parsed.path;
    if (!asFolderKey(key).startsWith(prefix)) throw new Error(`${url} is outside s3://${bucket}/${prefix}, the part of the bucket that is configured`);
    return { bucket, mount, key, client: this.aws.getBucketClient(bucket) };
  }

  /** The AWS console, for Amazon S3 only; S3-compatible endpoints have no shared web UI. */
  private consoleUrl(bucket: string, mount: S3BucketMount, key: string, folder: boolean): string | undefined {
    if (mount.endpoint) return undefined;
    const region = encodeURIComponent(mount.region ?? this.aws.getRegion());
    const prefix = encodeURIComponent(key);
    return folder
      ? `https://s3.console.aws.amazon.com/s3/buckets/${bucket}?region=${region}&prefix=${prefix}`
      : `https://s3.console.aws.amazon.com/s3/object/${bucket}?region=${region}&prefix=${prefix}`;
  }

  private folderEntry(bucket: string, mount: S3BucketMount, key: string): RemoteEntry {
    const folderKey = asFolderKey(key);
    return {
      url: `${SCHEME}://${bucket}/${folderKey}`,
      name: folderKey === "" ? bucket : baseName(folderKey),
      kind: "folder",
      webUrl: this.consoleUrl(bucket, mount, folderKey, true),
    };
  }

  private fileEntry(bucket: string, mount: S3BucketMount, key: string, size?: number, modified?: Date | string, contentType?: string): RemoteEntry {
    return {
      url: `${SCHEME}://${bucket}/${key}`,
      name: baseName(key),
      kind: "file",
      mimeType: contentType && !GENERIC_TYPES.has(contentType) ? contentType : mime.lookup(key) || "application/octet-stream",
      size,
      modified: modified === undefined ? undefined : new Date(modified).toISOString(),
      webUrl: this.consoleUrl(bucket, mount, key, false),
    };
  }

  async list(url: string, options: { cursor?: string | undefined } = {}): Promise<RemoteListing> {
    const { bucket, mount, key, client } = this.target(url);
    const folderKey = asFolderKey(key);
    const response = await client.list({ prefix: folderKey, delimiter: "/", ...(options.cursor ? { continuationToken: options.cursor } : {}) });
    const folders = (response.commonPrefixes ?? []).map(prefix => this.folderEntry(bucket, mount, prefix.prefix));
    const files = (response.contents ?? []).flatMap(object =>
      // The folder's own placeholder object (`reports/`) is not a file in it.
      object.key !== folderKey ? [this.fileEntry(bucket, mount, object.key, object.size, object.lastModified)] : [],
    );
    return { entries: [...folders, ...files], cursor: response.isTruncated ? response.nextContinuationToken : undefined };
  }

  async stat(url: string): Promise<RemoteEntry | null> {
    const { bucket, mount, key, client } = this.target(url);
    if (key === "" || key.endsWith("/")) return this.folderEntry(bucket, mount, key);
    if (await client.exists(key)) {
      const stats = await client.stat(key);
      return this.fileEntry(bucket, mount, key, stats.size, stats.lastModified, stats.type);
    }
    // No object by that name; it may still be a folder written without its trailing slash.
    const children = await client.list({ prefix: `${key}/`, maxKeys: 1 });
    return (children.contents?.length ?? 0) > 0 ? this.folderEntry(bucket, mount, key) : null;
  }

  async read(url: string): Promise<RemoteContent> {
    const { bucket, mount, key, client } = this.target(url);
    if (key === "" || key.endsWith("/")) throw new Error(`${url} is a folder; list it instead`);
    const file = client.file(key);
    try {
      const [stats, bytes] = await Promise.all([file.stat(), file.bytes()]);
      const entry = this.fileEntry(bucket, mount, key, bytes.length, stats.lastModified, stats.type);
      return { name: entry.name, mimeType: entry.mimeType!, content: Buffer.from(bytes) };
    } catch (error: unknown) {
      if (isNotFound(error) || !(await client.exists(key))) throw new Error(`Not found: ${url}`);
      throw error;
    }
  }

  /** Matches file names (not contents) under the mount, walking at most {@link SEARCH_SCAN_LIMIT} keys. */
  async search(query: string, { authority, limit, signal }: RemoteSearchOptions): Promise<RemoteEntry[]> {
    const { bucket, mount, key: prefix, client } = this.target(`${SCHEME}://${authority}/`);
    const needle = query.trim().toLowerCase();
    const matches: RemoteEntry[] = [];
    let cursor: string | undefined;
    let scanned = 0;
    do {
      signal?.throwIfAborted();
      const response = await client.list({ prefix, ...(cursor ? { continuationToken: cursor } : {}) });
      for (const object of response.contents ?? []) {
        scanned++;
        if (object.key.endsWith("/")) continue;
        if (baseName(object.key).toLowerCase().includes(needle)) {
          matches.push(this.fileEntry(bucket, mount, object.key, object.size, object.lastModified));
          if (matches.length >= limit) return matches;
        }
      }
      cursor = response.isTruncated ? response.nextContinuationToken : undefined;
    } while (cursor && scanned < SEARCH_SCAN_LIMIT);
    return matches;
  }

  async create(folderUrl: string, name: string, content: Buffer, mimeType: string): Promise<RemoteEntry> {
    const { bucket, mount, key, client } = this.target(folderUrl);
    if (name.includes("/")) throw new Error(`"${name}" is not a file name; upload into the folder it belongs in`);
    const objectKey = `${asFolderKey(key)}${name}`;
    await client.write(objectKey, content, { type: mimeType });
    return this.fileEntry(bucket, mount, objectKey, content.length, new Date(), mimeType);
  }

  async update(url: string, content: Buffer, mimeType: string): Promise<RemoteEntry> {
    const { bucket, mount, key, client } = this.target(url);
    if (key === "" || key.endsWith("/")) throw new Error(`${url} is a folder, not a file`);
    await client.write(key, content, { type: mimeType });
    return this.fileEntry(bucket, mount, key, content.length, new Date(), mimeType);
  }
}
