import * as os from "node:os";
import * as path from "node:path";

export interface UserMemoryConfig {
  enabled: boolean;
  baseDir: string;
  promotionThreshold: number;
}

const DEFAULT_BASE = path.join(os.homedir(), ".openclaw", "workspace", "memory", "users");

export function parseConfig(value: unknown): UserMemoryConfig {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const cfg = raw.config as Record<string, unknown> | undefined;

  const enabled =
    typeof cfg?.enabled === "boolean" ? cfg.enabled :
    typeof raw.enabled === "boolean" ? raw.enabled : true;

  const baseDir =
    (typeof cfg?.baseDir === "string" && cfg.baseDir.trim()) ||
    (typeof raw.baseDir === "string" && raw.baseDir.trim()) ||
    DEFAULT_BASE;

  const thresholdRaw =
    (typeof cfg?.promotionThreshold === "number" && cfg.promotionThreshold) ||
    (typeof raw.promotionThreshold === "number" && raw.promotionThreshold) ||
    2;

  return {
    enabled,
    baseDir,
    promotionThreshold: Math.max(1, Math.floor(thresholdRaw)),
  };
}

export const configSchema = { parse: parseConfig };
