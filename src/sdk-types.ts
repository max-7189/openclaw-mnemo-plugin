// Minimal shape of the runtime contexts we rely on.
// OpenClaw's plugin-sdk package doesn't publicly re-export these from its
// top-level entry, so we declare just what this plugin uses. The live runtime
// provides the full interface — these stubs exist purely for tsc --noEmit.

export interface OpenClawPluginToolContext {
  requesterSenderId?: string;
  messageChannel?: string;
  sessionKey?: string;
  agentId?: string;
}

export interface PluginCommandContext {
  senderId?: string;
  channel?: string;
  sessionKey?: string;
  args?: string;
}
