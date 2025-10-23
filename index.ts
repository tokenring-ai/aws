import {AgentTeam, TokenRingPackage} from "@tokenring-ai/agent";
import {z} from "zod";
import AWSService from "./AWSService.ts";
import * as chatCommands from "./chatCommands.ts";
import packageJSON from './package.json' with {type: 'json'};
import * as tools from "./tools.ts";

export const AWSConfigSchema = z.any().optional();

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(agentTeam: AgentTeam) {
    const config = agentTeam.getConfigSlice('aws', AWSConfigSchema);
    if (config) {
      agentTeam.addTools(packageJSON.name, tools);
      agentTeam.addChatCommands(chatCommands);
      agentTeam.addServices(new AWSService(config));
    }
  }
} as TokenRingPackage;

export {default as AWSService} from "./AWSService.ts";
