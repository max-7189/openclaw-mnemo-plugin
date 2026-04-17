# openclaw-mnemo-plugin

Per-user isolated memory plugin for [OpenClaw](https://github.com/sporthub-community-trust/openclaw). Each user of a shared agent (e.g. a single Discord bot serving many people) gets their own private memory store — preferences, corrections, facts — keyed by the channel + sender id of the incoming message.

Named after Mnemosyne, the Greek goddess of memory.

## Why

Out of the box, OpenClaw's `MEMORY.md` / `memory/YYYY-MM-DD.md` files are shared across every user talking to the same agent. That is fine for agent-wide operational notes, but wrong for anything personal: if user A says "I prefer concise replies", the agent will treat it as a global rule and apply it to user B as well.

This plugin adds a second memory layer that is **scoped per user**:

- Stored at `<baseDir>/<channel>:<senderId>/<key>.md`
- Each record is a Markdown file with YAML frontmatter (status, count, timestamps) + body
- The plugin resolves `user_id` from the runtime-populated `ctx.requesterSenderId` + `ctx.messageChannel` — users cannot spoof each other's ids via tool arguments
- Four meta-tools (`MEMORY_SAVE` / `MEMORY_SEARCH` / `MEMORY_LIST` / `MEMORY_DELETE`) let the agent decide *what* and *when* to remember
- Two slash commands (`/reflect`, `/forget`) give the user direct control

## How it works

### Meta-tools

| Tool | Purpose | Trigger examples |
|---|---|---|
| `MEMORY_SAVE` | Persist a preference, correction, or fact | "I prefer concise replies", "my name is Max", "stop using emoji" |
| `MEMORY_SEARCH` | Look up existing memories by substring | Run at the start of a task to surface relevant preferences |
| `MEMORY_LIST` | Dump everything for the current user | "What do you remember about me?" |
| `MEMORY_DELETE` | Forget a specific key | "Forget that I wanted short replies" |

### Commands

- `/reflect` — show the user everything the agent has stored about them, grouped by status (🟢 stable / 🟡 candidate).
- `/forget <keyword>` — fuzzy-match and delete. Bypasses the model so users can always clean up.

### Threshold promotion

Every save carries a `count` and a `status`:

- First save of a `key` → `status=candidate`, `count=1`
- Second save of the same `key` (including semantic restatements) → `count=2`, `status=stable`
- Threshold configurable via `promotionThreshold` (default `2`)

The return value of `MEMORY_SAVE` includes a line:

```
Reply-suffix: （已记住：<title>）
```

The companion skill (`skills/user-memory/SKILL.md`) instructs the agent to append this suffix verbatim to its reply. Users thus see every memory event as it happens — nothing is stored silently.

### User id resolution

Resolution priority, with sanitisation (`a-zA-Z0-9_.-:/` only):

1. `<ctx.messageChannel>:<ctx.requesterSenderId>` — trusted runtime signal from Discord / Telegram / …
2. `session:<ctx.sessionKey || ctx.agentId>` — fallback when there is no channel context
3. `default` — last-resort bucket for local / CLI sessions

Because ids come from the runtime (not from tool arguments), the model cannot reach across users even if prompted to.

## Install

1. Clone into your OpenClaw extensions directory:

   ```bash
   cd ~/.openclaw/extensions
   git clone https://github.com/max-7189/openclaw-mnemo-plugin.git user-memory
   ```

   (Keep the directory name `user-memory` so it matches the plugin `id`.)

2. Enable the plugin in `~/.openclaw/openclaw.json`:

   ```json5
   {
     "plugins": {
       "entries": {
         "user-memory": { "enabled": true }
       }
     },
     "tools": {
       "alsoAllow": ["user-memory"]
     }
   }
   ```

3. Copy `skills/user-memory/SKILL.md` into your agent workspace at `~/.openclaw/workspace/skills/user-memory/SKILL.md` so the agent knows when to invoke the tools.

4. Restart the gateway:

   ```bash
   systemctl --user restart openclaw-gateway.service
   ```

   You should see:

   ```
   [user-memory] Ready — 4 tools + 2 commands registered (baseDir=..., promotionThreshold=2)
   ```

## Configuration

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Enable or disable the plugin |
| `baseDir` | string | `~/.openclaw/workspace/memory/users` | Root directory for per-user stores |
| `promotionThreshold` | number | `2` | Save count at which `candidate` becomes `stable` |

## Storage layout

```
<baseDir>/
  discord:123456789/
    preferred_response_length.md
    timezone.md
  telegram:987654/
    chinese_name.md
  session:agent-abc123/
    ...
```

Each `.md` file looks like:

```markdown
---
key: preferred_response_length
title: Prefers concise replies
type: preference
status: stable
count: 2
created: 2026-04-17T08:32:03.425Z
updated: 2026-04-17T08:40:11.100Z
---

User prefers concise replies with no long preambles. Keep answers to ≤3 lines.
```

## Companion skill

`skills/user-memory/SKILL.md` is the instruction file the agent reads to decide *when* to call the tools. It covers:

- Trigger keyword list (English + Chinese)
- **Restatement rule**: the same preference, worded differently, must reuse the same `key` so the count increments
- Key naming conventions (stable `snake_case`, no timestamps, no duplicates)
- Required Reply-suffix handling for transparency

Drop the skill into your workspace and it will show up in `openclaw skills list`.

## Development

```bash
# Local dev flow — symlink the repo into your OpenClaw extensions
ln -s "$(pwd)" ~/.openclaw/extensions/user-memory
systemctl --user restart openclaw-gateway.service

# Watch logs
journalctl --user -u openclaw-gateway.service -f | grep user-memory
```

The plugin has no runtime dependencies beyond the OpenClaw plugin SDK supplied by the gateway. All I/O is plain Markdown files on disk — easy to inspect, grep, and back up.

## License

MIT — see [LICENSE](./LICENSE).
