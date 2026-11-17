import { describe, expect, it, mock } from "bun:test";
import type AWSService from "../AWSService.ts";
import S3Store from "../S3Store.ts";
import type { S3BucketMount } from "../schema.ts";

type Sent = { method: string; key?: string; options?: Record<string, unknown> };

const mountDefaults: S3BucketMount = { description: "S3", prefix: "", writable: true, contextualSearch: false };
const modified = new Date("2026-01-02T00:00:00Z");

/** A fake of Bun's S3Client: `objects` maps keys to bodies. */
function fakeS3(objects: Record<string, string>, mount: Partial<S3BucketMount> = {}, pageSize = 1000) {
  const sent: Sent[] = [];
  const keys = () => Object.keys(objects).sort();
  const missing = () => Object.assign(new Error("The specified key does not exist."), { code: "NoSuchKey", name: "S3Error" });
  const client = {
    list: mock(async (options: { prefix?: string; delimiter?: string; continuationToken?: string; maxKeys?: number }) => {
      sent.push({ method: "list", options });
      const prefix = options.prefix ?? "";
      const matching = keys().filter(candidate => candidate.startsWith(prefix));
      if (options.delimiter === "/") {
        const folders = new Set<string>();
        const files: string[] = [];
        for (const candidate of matching) {
          const rest = candidate.slice(prefix.length);
          const slash = rest.indexOf("/");
          if (slash >= 0 && slash < rest.length - 1) folders.add(prefix + rest.slice(0, slash + 1));
          else files.push(candidate);
        }
        return {
          commonPrefixes: [...folders].map(folder => ({ prefix: folder })),
          contents: files.map(key => ({ key, size: objects[key]!.length, lastModified: modified.toISOString() })),
          isTruncated: false,
        };
      }
      const start = options.continuationToken ? Number(options.continuationToken) : 0;
      const page = matching.slice(start, start + (options.maxKeys ?? pageSize));
      const truncated = start + page.length < matching.length && options.maxKeys === undefined;
      return {
        contents: page.map(key => ({ key, size: objects[key]!.length })),
        isTruncated: truncated,
        nextContinuationToken: truncated ? String(start + page.length) : undefined,
      };
    }),
    exists: mock(async (key: string) => key in objects),
    stat: mock(async (key: string) => {
      if (!(key in objects)) throw missing();
      return { size: objects[key]!.length, lastModified: modified, etag: "e", type: "binary/octet-stream" };
    }),
    file: (key: string) => ({
      stat: async () => client.stat(key),
      bytes: async () => {
        if (!(key in objects)) throw missing();
        return new TextEncoder().encode(objects[key]);
      },
    }),
    write: mock(async (key: string, data: Buffer, options: { type: string }) => {
      sent.push({ method: "write", key, options });
      objects[key] = data.toString();
      return data.length;
    }),
  };
  const clientsFor: string[] = [];
  const aws = {
    getS3Buckets: () => [{ bucket: "media", mount: { ...mountDefaults, ...mount } }],
    getBucketClient: (bucket: string) => {
      clientsFor.push(bucket);
      return client;
    },
    getRegion: () => "us-east-1",
  } as unknown as AWSService;
  return { store: new S3Store(aws), sent, objects, clientsFor };
}

describe("S3Store", () => {
  it("offers one mount per configured bucket, rooted at its prefix", () => {
    const { store } = fakeS3({}, { prefix: "reports/", description: "Media" });
    expect(store.mounts()).toEqual([
      { scheme: "s3", authority: "media", url: "s3://media/reports/", label: "Media · media/reports", writable: true, contextualSearch: false },
    ]);
  });

  it("lists a folder as sub-folders and files, skipping the folder's own marker object", async () => {
    const { store } = fakeS3({ "reports/": "", "reports/q1.csv": "a,b", "reports/2026/q2.csv": "c,d", "top.txt": "hi" });
    const listing = await store.list("s3://media/reports");
    expect(listing.entries.map(entry => [entry.url, entry.kind, entry.name])).toEqual([
      ["s3://media/reports/2026/", "folder", "2026"],
      ["s3://media/reports/q1.csv", "file", "q1.csv"],
    ]);
    expect(listing.entries[1]!.mimeType).toBe("text/csv");
  });

  it("stats files, folders without a trailing slash, and missing keys", async () => {
    const { store } = fakeS3({ "reports/q1.csv": "a,b" });
    expect(await store.stat("s3://media/reports/q1.csv")).toMatchObject({ kind: "file", size: 3, mimeType: "text/csv", modified: "2026-01-02T00:00:00.000Z" });
    expect(await store.stat("s3://media/reports")).toMatchObject({ kind: "folder", url: "s3://media/reports/" });
    expect(await store.stat("s3://media/nope.txt")).toBeNull();
  });

  it("reads objects, typing them by extension when S3 only says octet-stream", async () => {
    const { store } = fakeS3({ "notes/plan.md": "# Plan" });
    expect(await store.read("s3://media/notes/plan.md")).toEqual({ name: "plan.md", mimeType: "text/markdown", content: Buffer.from("# Plan") });
    await expect(store.read("s3://media/notes/missing.md")).rejects.toThrow("Not found: s3://media/notes/missing.md");
    await expect(store.read("s3://media/notes/")).rejects.toThrow(/is a folder/);
  });

  it("refuses keys outside the configured prefix", async () => {
    const { store } = fakeS3({ "secret/key.txt": "x" }, { prefix: "public" });
    await expect(store.read("s3://media/secret/key.txt")).rejects.toThrow(/outside s3:\/\/media\/public\//);
    await expect(store.list("s3://media/")).resolves.toEqual({ entries: [], cursor: undefined });
  });

  it("searches file names across pages and stops at the limit", async () => {
    const objects: Record<string, string> = {};
    for (let i = 0; i < 25; i++) objects[`logs/${String(i).padStart(2, "0")}-report.txt`] = "x";
    objects["logs/other.txt"] = "y";
    const { store, sent } = fakeS3(objects, {}, 10);
    const results = await store.search("REPORT", { authority: "media", limit: 12 });
    expect(results).toHaveLength(12);
    expect(results[0]!.url).toBe("s3://media/logs/00-report.txt");
    expect(sent.filter(call => call.method === "list")).toHaveLength(2);
  });

  it("creates into a folder and replaces existing objects", async () => {
    const { store, objects, sent } = fakeS3({ "notes/plan.md": "old" });
    const created = await store.create("s3://media/notes/", "new.txt", Buffer.from("hi"), "text/plain");
    expect(created).toMatchObject({ url: "s3://media/notes/new.txt", kind: "file", size: 2 });
    expect(sent.at(-1)).toEqual({ method: "write", key: "notes/new.txt", options: { type: "text/plain" } });
    await store.update("s3://media/notes/plan.md", Buffer.from("new"), "text/markdown");
    expect(objects["notes/plan.md"]).toBe("new");
    await expect(store.create("s3://media/notes/", "a/b.txt", Buffer.from(""), "text/plain")).rejects.toThrow(/not a file name/);
  });

  it("uses the bucket's own client, and links to the AWS console only for Amazon S3", async () => {
    const amazon = fakeS3({ "a.txt": "x" });
    expect((await amazon.store.stat("s3://media/a.txt"))?.webUrl).toBe("https://s3.console.aws.amazon.com/s3/object/media?region=us-east-1&prefix=a.txt");
    expect(amazon.clientsFor).toEqual(["media"]);

    const minio = fakeS3({ "a.txt": "x" }, { endpoint: "http://localhost:9000" });
    expect((await minio.store.stat("s3://media/a.txt"))?.webUrl).toBeUndefined();
  });

  it("refuses buckets that are not configured", async () => {
    const { store } = fakeS3({});
    await expect(store.list("s3://elsewhere/")).rejects.toThrow('S3 bucket "elsewhere" is not configured');
  });
});
