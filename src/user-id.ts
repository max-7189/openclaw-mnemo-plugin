import type { OpenClawPluginToolContext } from "openclaw/plugin-sdk";

function sanitize(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_\-:.]/g, "_").slice(0, 128);
}

export function resolveUserIdFromToolContext(ctx: OpenClawPluginToolContext): string {
  const sender = ctx.requesterSenderId?.trim();
  if (sender) {
    const channel = ctx.messageChannel?.trim();
    return sanitize(channel ? `${channel}:${sender}` : sender);
  }
  const key = ctx.sessionKey?.trim() || ctx.agentId?.trim();
  if (key) return sanitize(`session:${key}`);
  return "default";
}

export function resolveUserIdFromCommand(ctx: { senderId?: string; channel?: string; sessionKey?: string }): string {
  const sender = ctx.senderId?.trim();
  if (sender) {
    const channel = ctx.channel?.trim();
    return sanitize(channel ? `${channel}:${sender}` : sender);
  }
  const key = ctx.sessionKey?.trim();
  if (key) return sanitize(`session:${key}`);
  return "default";
}
