import { AgentCommandService } from "@tokenring-ai/agent";
import type { TokenRingPlugin } from "@tokenring-ai/app";
import { ChatService } from "@tokenring-ai/chat";
import { z } from "zod";
import AWSService from "./AWSService.ts";
import agentCommands from "./commands.ts";
import packageJSON from "./package.json" with { type: "json" };
import { AWSConfigSchema } from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  aws: AWSConfigSchema.exactOptional(),
});

export default {
  name: packageJSON.name,
  displayName: "AWS Integration",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app) {
    app.addServices(new AWSService());
    app.waitForService(ChatService, chatService => chatService.addTools(...tools));
    app.waitForService(AgentCommandService, agentCommandService => agentCommandService.addAgentCommands(agentCommands));
  },
  reconfigure(app, config) {
    if (config.aws) {
      app.requireService(AWSService).reconfigure(config.aws);
    }
  },
  configSchema: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
