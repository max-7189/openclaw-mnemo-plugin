import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { parseConfig, configSchema } from "./src/config.js";
import { registerTools } from "./src/tools.js";
import { registerCommands } from "./src/commands.js";

const userMemoryPlugin = {
  id: "user-memory",
  name: "User Memory",
  description: "Per-user isolated memory with description-driven save/search and /reflect + /forget commands.",
  configSchema,

  register(api: OpenClawPluginApi) {
    const cfg = parseConfig(api.pluginConfig);

    if (!cfg.enabled) {
      api.logger.debug?.("[user-memory] Plugin disabled");
      return;
    }

    registerTools(api, cfg);
    registerCommands(api, cfg);

    api.logger.info(
      `[user-memory] Ready — 4 tools + 2 commands registered ` +
      `(baseDir=${cfg.baseDir}, promotionThreshold=${cfg.promotionThreshold})`
    );
  },
};

export default userMemoryPlugin;
