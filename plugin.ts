import { AgentCommandService } from "@tokenring-ai/agent";
import type { TokenRingPlugin } from "@tokenring-ai/app";
import { ChatService } from "@tokenring-ai/chat";
import { RemoteStoreService } from "@tokenring-ai/filesystem";
import { z } from "zod";
import AWSService from "./AWSService.ts";
import agentCommands from "./commands.ts";
import packageJSON from "./package.json" with { type: "json" };
import S3Store from "./S3Store.ts";
import { AWSConfigSchema } from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  aws: AWSConfigSchema,
});

export default {
  name: packageJSON.name,
  displayName: "AWS Integration",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app) {
    const awsService = new AWSService();
    app.addService(AWSService, awsService);
    // Configured buckets appear as s3:// remote stores (tools, @ search, the Remote files app).
    app.waitForService(RemoteStoreService, remoteStores => remoteStores.registerStore(new S3Store(awsService)));
    app.waitForService(ChatService, chatService => chatService.addTools(tools));
    app.waitForService(AgentCommandService, agentCommandService => agentCommandService.addAgentCommands(agentCommands));
  },
  reconfigure(app, config) {
    app.requireService(AWSService).reconfigure(config.aws);
    app.getService(RemoteStoreService)?.mountsChanged();
  },
  configSchema: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
