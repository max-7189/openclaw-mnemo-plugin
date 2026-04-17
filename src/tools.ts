import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { OpenClawPluginToolContext } from "./sdk-types.js";
import { resolveUserIdFromToolContext } from "./user-id.js";
import {
  saveRecord, listRecords, deleteRecord, searchRecords, readRecord,
  type MemoryType,
} from "./storage.js";
import type { UserMemoryConfig } from "./config.js";

const TYPE_ENUM = ["preference", "fact", "feedback", "project", "reference"] as const;

function formatRecord(r: { title: string; key: string; type: string; status: string; count: number; updated: string; content: string }): string {
  return `- [${r.status} ×${r.count}] ${r.title} (key=${r.key}, type=${r.type}, updated=${r.updated})\n    ${r.content.replace(/\n/g, " ").slice(0, 160)}`;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }], details: null };
}

export function registerTools(api: OpenClawPluginApi, cfg: UserMemoryConfig): void {
  // ── MEMORY_SAVE ──────────────────────────────────────────────
  api.registerTool((ctx: OpenClawPluginToolContext) => {
    const userId = resolveUserIdFromToolContext(ctx);
    return {
      name: "MEMORY_SAVE",
      label: "MEMORY_SAVE",
      description: "Persist a learning, preference, or fact about the current user. Use when the user expresses a durable preference, correction, or fact worth remembering across sessions.",
      parameters: {
        type: "object",
        required: ["key", "title", "type", "content"],
        properties: {
          key: {
            type: "string",
            description: "Stable snake_case identifier, e.g. 'preferred_response_length', 'timezone', 'chinese_name'. Reuse the same key to increment count.",
          },
          title: {
            type: "string",
            description: "Short human-readable title shown to the user in notifications, e.g. '偏好简洁回复'.",
          },
          type: { type: "string", enum: TYPE_ENUM as unknown as string[] },
          content: {
            type: "string",
            description: "Full memory text. On repeat saves for the same key, this replaces the previous content.",
          },
        },
        additionalProperties: false,
      },
      async execute(_id: string, params: Record<string, unknown>) {
        const key = String(params.key ?? "").trim();
        const title = String(params.title ?? "").trim();
        const type = String(params.type ?? "fact") as MemoryType;
        const content = String(params.content ?? "").trim();
        if (!key || !content) return textResult("Error: MEMORY_SAVE requires non-empty key and content.");

        const result = saveRecord(cfg.baseDir, userId, { key, title, type, content }, cfg.promotionThreshold);
        const suffix = result.promoted
          ? `（已稳定记下：${result.record.title}）`
          : `（已记住：${result.record.title}）`;
        const state = `status=${result.record.status} count=${result.record.count}`;
        return textResult(
          `Saved. ${state} key=${result.record.key} title=${JSON.stringify(result.record.title)}\n` +
          `Reply-suffix: ${suffix}`
        );
      },
    };
  });

  // ── MEMORY_SEARCH ────────────────────────────────────────────
  api.registerTool((ctx: OpenClawPluginToolContext) => {
    const userId = resolveUserIdFromToolContext(ctx);
    return {
      name: "MEMORY_SEARCH",
      label: "MEMORY_SEARCH",
      description: "Retrieve memories for the current user matching a query. Call at the start of a task if user preferences, facts, or past feedback might apply.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "Substring to match against title, key, or body." },
          type: { type: "string", enum: TYPE_ENUM as unknown as string[] },
          limit: { type: "number", description: "Max results (default 10)." },
        },
        additionalProperties: false,
      },
      async execute(_id: string, params: Record<string, unknown>) {
        const query = String(params.query ?? "").trim();
        const type = params.type ? (String(params.type) as MemoryType) : undefined;
        const limit = typeof params.limit === "number" ? params.limit : 10;
        const hits = searchRecords(cfg.baseDir, userId, query, { type, limit });
        if (hits.length === 0) return textResult(`No memories matched "${query}".`);
        return textResult(`Found ${hits.length} memories:\n${hits.map(formatRecord).join("\n")}`);
      },
    };
  });

  // ── MEMORY_LIST ──────────────────────────────────────────────
  api.registerTool((ctx: OpenClawPluginToolContext) => {
    const userId = resolveUserIdFromToolContext(ctx);
    return {
      name: "MEMORY_LIST",
      label: "MEMORY_LIST",
      description: "List all memories for the current user. Use when the user asks 'what do you remember about me' or when you need to audit stored context.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: TYPE_ENUM as unknown as string[] },
          status: { type: "string", enum: ["candidate", "stable"] },
        },
        additionalProperties: false,
      },
      async execute(_id: string, params: Record<string, unknown>) {
        const type = params.type ? (String(params.type) as MemoryType) : undefined;
        const status = params.status as "candidate" | "stable" | undefined;
        const all = listRecords(cfg.baseDir, userId, { type, status });
        if (all.length === 0) return textResult("No memories stored.");
        return textResult(`${all.length} memories:\n${all.map(formatRecord).join("\n")}`);
      },
    };
  });

  // ── MEMORY_DELETE ────────────────────────────────────────────
  api.registerTool((ctx: OpenClawPluginToolContext) => {
    const userId = resolveUserIdFromToolContext(ctx);
    return {
      name: "MEMORY_DELETE",
      label: "MEMORY_DELETE",
      description: "Delete a specific memory by key. Use when the user asks you to forget a fact or preference.",
      parameters: {
        type: "object",
        required: ["key"],
        properties: {
          key: { type: "string", description: "The stable key of the memory to delete." },
        },
        additionalProperties: false,
      },
      async execute(_id: string, params: Record<string, unknown>) {
        const key = String(params.key ?? "").trim();
        if (!key) return textResult("Error: MEMORY_DELETE requires a key.");
        const rec = readRecord(cfg.baseDir, userId, key);
        const ok = deleteRecord(cfg.baseDir, userId, key);
        if (!ok) return textResult(`No memory found with key="${key}".`);
        const title = rec?.title ?? key;
        return textResult(`Deleted. key=${key}\nReply-suffix: （已忘记：${title}）`);
      },
    };
  });
}
