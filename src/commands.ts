import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { PluginCommandContext } from "openclaw/plugin-sdk";
import { resolveUserIdFromCommand } from "./user-id.js";
import { listRecords, fuzzyDelete } from "./storage.js";
import type { UserMemoryConfig } from "./config.js";

export function registerCommands(api: OpenClawPluginApi, cfg: UserMemoryConfig): void {
  // /reflect — summarize what the agent remembers about this user
  api.registerCommand({
    name: "reflect",
    description: "Show what the agent remembers about you",
    handler: async (ctx: PluginCommandContext) => {
      const userId = resolveUserIdFromCommand({
        senderId: ctx.senderId,
        channel: ctx.channel,
        sessionKey: ctx.sessionKey,
      });
      const all = listRecords(cfg.baseDir, userId);
      if (all.length === 0) {
        return { text: `(user_id=${userId}) 还没有记录。` };
      }
      const stable = all.filter((r) => r.status === "stable");
      const candidate = all.filter((r) => r.status === "candidate");

      const sections: string[] = [`## 记忆总结 (user_id=${userId}, ${all.length} 条)\n`];
      if (stable.length > 0) {
        sections.push(`### 🟢 稳定 (${stable.length})`);
        for (const r of stable) {
          sections.push(`- **${r.title}** (×${r.count}) — ${r.content.replace(/\n/g, " ").slice(0, 120)}`);
        }
        sections.push("");
      }
      if (candidate.length > 0) {
        sections.push(`### 🟡 候选 (${candidate.length})`);
        for (const r of candidate) {
          sections.push(`- ${r.title} (×${r.count}) — ${r.content.replace(/\n/g, " ").slice(0, 120)}`);
        }
        sections.push("");
      }
      sections.push(`💡 用 \`/forget <关键词>\` 删除错误记忆`);
      return { text: sections.join("\n") };
    },
  });

  // /forget <keyword> — fuzzy match and delete
  api.registerCommand({
    name: "forget",
    description: "Delete memories matching a keyword",
    handler: async (ctx: PluginCommandContext) => {
      const userId = resolveUserIdFromCommand({
        senderId: ctx.senderId,
        channel: ctx.channel,
        sessionKey: ctx.sessionKey,
      });
      const keyword = (ctx.args ?? "").trim();
      if (!keyword) {
        return { text: "用法: `/forget <关键词>`\n例如: `/forget 简洁` 会删除所有匹配的记忆。" };
      }
      const { deleted, matched } = fuzzyDelete(cfg.baseDir, userId, keyword);
      if (matched.length === 0) {
        return { text: `没有匹配 "${keyword}" 的记忆。` };
      }
      const list = deleted.map((r) => `- ${r.title} (key=${r.key})`).join("\n");
      return { text: `已删除 ${deleted.length} 条匹配 "${keyword}" 的记忆：\n${list}` };
    },
  });
}
