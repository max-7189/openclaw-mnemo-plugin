---
name: user_memory
description: Remember the current user's preferences, corrections, and facts across sessions. Triggers when the user says "remember / don't / next time / from now on / I like / I prefer / I don't like / please note / 记住 / 别再 / 以后 / 下次 / 我喜欢 / 我不喜欢 / 请注意", expresses a durable preference, issues a correction, or reveals identity. Also triggers when the user restates a preference you have already saved (promote it).
---

# User Memory

Drives the four meta-tools in the `user-memory` plugin. All records are isolated per `user_id`.

## When to call each tool

### 1. Save — call `MEMORY_SAVE`

Trigger on any of the following signals:

- **Preferences**: "I prefer concise replies", "no emoji", "answer in Chinese", "我喜欢简洁回复"
- **Corrections**: "stop doing that", "don't do X again", "next time remember to...", "别再这样", "以后记得"
- **Facts**: "My name is Max", "I'm in New Zealand", "I lead the Dragon Beats project", "我叫 Max"
- **Positive feedback**: "this style is good, keep it", "perfect, do it like that from now on"
- **Explicit requests**: "remember X", "please memorize this", "记住 X", "帮我记一下"

**Restatement rule (important)**: If the user expresses a preference/fact that is **semantically equivalent** to one you have already saved (even with different wording), you **must** call `MEMORY_SAVE` again using the **same `key`**. This promotes the record from `candidate` to `stable` via the count threshold. Examples:

- Saved earlier: `preferred_response_length = "user prefers concise replies"`. User now says "reply shorter please" / "再次提醒，回复短一点" / "keep it brief" → call `MEMORY_SAVE` with `key="preferred_response_length"` again. Do **not** invent a new key like `short_reply_2`.
- Before saving, if unsure whether a related memory exists, run `MEMORY_SEARCH` first with the topic keyword and reuse any matching key.

Do not save:
- One-off task content (e.g. "help me write an email")
- Transient state of the current conversation
- Exact duplicates of an existing key with identical content (but restatements of the same preference should still re-save under the same key — that's what drives promotion)

### 2. Search — call `MEMORY_SEARCH`

Run once at the start of tasks where prior preferences likely apply:
- Writing / translating / drafting → search "style length language"
- Scheduling / task planning → search "timezone working hours"
- Email / notification wording → search "salutation tone"
- Any time you are unsure of user preferences before acting

Also search **before** a new `MEMORY_SAVE` when you suspect the same topic may already have a key — reuse it instead of creating a new one.

### 3. List — call `MEMORY_LIST`

When the user asks things like "what do you remember about me", "show me what you know", "audit my memory".

### 4. Delete — call `MEMORY_DELETE`

When the user says "forget X", "don't remember that any more", "delete the memory about Y". Run `MEMORY_SEARCH` first to locate the key, then `MEMORY_DELETE`. Users can also invoke `/forget <keyword>` directly, which bypasses the model.

## Call details

### `MEMORY_SAVE` parameters

- **key** — stable snake_case describing *what* is remembered.
  - Good: `preferred_response_length`, `timezone`, `chinese_name`, `emoji_preference`
  - Bad: `memory_1`, `note_20260417`, keys containing spaces or Chinese
  - **Always reuse the same key for the same topic** — this is how the threshold promotion works.
- **title** — short human-readable label shown to the user (Chinese OK), e.g. "偏好简洁回复".
- **type** — one of `preference | fact | feedback | project | reference`.
- **content** — the full memory text. On repeat saves with the same key, this is replaced with the latest version and `count` increments by 1.

### Reply-suffix (required)

`MEMORY_SAVE` and `MEMORY_DELETE` responses contain a line like:

```
Reply-suffix: （已记住：xxx）
```

**You must append the text inside the parentheses verbatim to the end of your reply**, on its own line. Do not reword it. This is the user's transparency channel — they need to see what you added to memory. Example:

```
好的，我会用简洁的风格回答。

（已记住：偏好简洁回复）
```

### Threshold promotion

- First save of a key → `status=candidate`
- Second save of the same key → `status=stable` (suffix becomes "已稳定记下：...")
- The user sees each status change through the suffix, so restatements are visible learning moments.

## Do not

- Do not blindly call `MEMORY_SAVE` on every message — only on clear signals.
- Do not read or write across users (the plugin isolates by `user_id`; do not try to work around it).
- Do not store secrets (passwords, tokens, API keys).
- Do not forget the Reply-suffix after saving or deleting.
- Do not invent a new key for a restated preference — reuse the existing one so it can promote.
