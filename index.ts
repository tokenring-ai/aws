import TokenRingApp from "@tokenring-ai/app"; 
import {AgentCommandService} from "@tokenring-ai/agent";
import {ChatService} from "@tokenring-ai/chat";
import {TokenRingPlugin} from "@tokenring-ai/app";
import {z} from "zod";
import AWSService from "./AWSService.ts";
import chatCommands from "./chatCommands.ts";
import packageJSON from './package.json' with {type: 'json'};
import tools from "./tools.ts";

export const AWSConfigSchema = z.any().optional();

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app: TokenRingApp) {
    const config = app.getConfigSlice('aws', AWSConfigSchema);
    if (config) {
      app.waitForService(ChatService, chatService =>
        chatService.addTools(packageJSON.name, tools)
      );
      app.waitForService(AgentCommandService, agentCommandService =>
        agentCommandService.addAgentCommands(chatCommands)
      );
      app.addServices(new AWSService(config));
    }
  }
} as TokenRingPlugin;

export {default as AWSService} from "./AWSService.ts";
