import { describe, expect, it, spyOn } from "bun:test";
import AWSService from "../AWSService.ts";

describe("AWSService.status", () => {
  it("returns authenticated: false without throwing when credentials are not configured", async () => {
    const service = new AWSService();

    await expect(service.status()).resolves.toEqual({
      active: true,
      service: "AWSService",
      authenticated: false,
    });
  });

  it("returns authenticated: false without throwing when credentials are incomplete", async () => {
    const service = new AWSService({
      accessKeyId: "",
      secretAccessKey: "secret",
      region: "us-east-1",
    });

    await expect(service.status()).resolves.toEqual({
      active: true,
      service: "AWSService",
      authenticated: false,
    });
  });

  it("returns authenticated: true and account info when credentials are configured", async () => {
    const service = new AWSService({
      accessKeyId: "AKIATEST",
      secretAccessKey: "secret",
      region: "us-east-1",
    });
    const identity = { Arn: "arn:aws:iam::123456789012:user/test", Account: "123456789012", UserId: "AIDATEST" };
    spyOn(service, "getCallerIdentity").mockResolvedValue(identity);

    await expect(service.status()).resolves.toEqual({
      active: true,
      service: "AWSService",
      authenticated: true,
      accountInfo: identity,
    });
  });
});
