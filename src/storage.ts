import * as fs from "node:fs";
import * as path from "node:path";

export type MemoryType = "preference" | "fact" | "feedback" | "project" | "reference";
export type MemoryStatus = "candidate" | "stable";

export interface MemoryRecord {
  key: string;
  title: string;
  type: MemoryType;
  status: MemoryStatus;
  count: number;
  created: string;
  updated: string;
  content: string;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export function sanitizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-.]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "unnamed";
}

function userDir(baseDir: string, userId: string): string {
  return path.join(baseDir, userId);
}

function recordPath(baseDir: string, userId: string, key: string): string {
  return path.join(userDir(baseDir, userId), `${sanitizeKey(key)}.md`);
}

function parseRecord(raw: string): Omit<MemoryRecord, "content"> & { content: string } | null {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return null;
  const fm: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return {
    key: fm.key ?? "",
    title: fm.title ?? "",
    type: (fm.type as MemoryType) ?? "fact",
    status: (fm.status as MemoryStatus) ?? "candidate",
    count: Number(fm.count) || 1,
    created: fm.created ?? new Date().toISOString(),
    updated: fm.updated ?? new Date().toISOString(),
    content: m[2].trim(),
  };
}

function serializeRecord(r: MemoryRecord): string {
  return `---
key: ${r.key}
title: ${r.title}
type: ${r.type}
status: ${r.status}
count: ${r.count}
created: ${r.created}
updated: ${r.updated}
---

${r.content}
`;
}

export function readRecord(baseDir: string, userId: string, key: string): MemoryRecord | null {
  const file = recordPath(baseDir, userId, key);
  try {
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = parseRecord(raw);
    if (!parsed) return null;
    return parsed as MemoryRecord;
  } catch {
    return null;
  }
}

export interface SaveResult {
  record: MemoryRecord;
  promoted: boolean;
  created: boolean;
}

export function saveRecord(
  baseDir: string,
  userId: string,
  input: { key: string; title: string; type: MemoryType; content: string },
  promotionThreshold: number,
): SaveResult {
  fs.mkdirSync(userDir(baseDir, userId), { recursive: true });
  const now = new Date().toISOString();
  const existing = readRecord(baseDir, userId, input.key);

  if (existing) {
    const newCount = existing.count + 1;
    const wasStable = existing.status === "stable";
    const nextStatus: MemoryStatus = newCount >= promotionThreshold ? "stable" : "candidate";
    const promoted = !wasStable && nextStatus === "stable";
    const record: MemoryRecord = {
      ...existing,
      title: input.title || existing.title,
      type: input.type || existing.type,
      count: newCount,
      status: nextStatus,
      content: input.content,
      updated: now,
    };
    fs.writeFileSync(recordPath(baseDir, userId, input.key), serializeRecord(record));
    return { record, promoted, created: false };
  }

  const record: MemoryRecord = {
    key: sanitizeKey(input.key),
    title: input.title || input.key,
    type: input.type,
    status: promotionThreshold <= 1 ? "stable" : "candidate",
    count: 1,
    created: now,
    updated: now,
    content: input.content,
  };
  fs.writeFileSync(recordPath(baseDir, userId, record.key), serializeRecord(record));
  return { record, promoted: record.status === "stable", created: true };
}

export function listRecords(baseDir: string, userId: string, opts?: { type?: MemoryType; status?: MemoryStatus }): MemoryRecord[] {
  const dir = userDir(baseDir, userId);
  let entries: string[] = [];
  try { entries = fs.readdirSync(dir).filter((f) => f.endsWith(".md")); } catch { return []; }

  const results: MemoryRecord[] = [];
  for (const name of entries) {
    const key = name.replace(/\.md$/, "");
    const rec = readRecord(baseDir, userId, key);
    if (!rec) continue;
    if (opts?.type && rec.type !== opts.type) continue;
    if (opts?.status && rec.status !== opts.status) continue;
    results.push(rec);
  }
  results.sort((a, b) => (a.updated < b.updated ? 1 : -1));
  return results;
}

export function deleteRecord(baseDir: string, userId: string, key: string): boolean {
  const file = recordPath(baseDir, userId, key);
  try { fs.unlinkSync(file); return true; } catch { return false; }
}

export function searchRecords(baseDir: string, userId: string, query: string, opts?: { type?: MemoryType; limit?: number }): MemoryRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = listRecords(baseDir, userId, opts?.type ? { type: opts.type } : undefined);
  const hits = all.filter((r) =>
    r.title.toLowerCase().includes(q) ||
    r.key.toLowerCase().includes(q) ||
    r.content.toLowerCase().includes(q)
  );
  return hits.slice(0, opts?.limit ?? 10);
}

export function fuzzyDelete(baseDir: string, userId: string, keyword: string): { deleted: MemoryRecord[]; matched: MemoryRecord[] } {
  const hits = searchRecords(baseDir, userId, keyword, { limit: 50 });
  const deleted: MemoryRecord[] = [];
  for (const rec of hits) {
    if (deleteRecord(baseDir, userId, rec.key)) deleted.push(rec);
  }
  return { deleted, matched: hits };
}
