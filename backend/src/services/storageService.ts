import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config/index.js";

/**
 * Pluggable storage: local paths today; swap for S3-backed URLs + temp download later.
 */
export interface StorageService {
  readonly kind: "local" | "s3";
  /** Final MP4 path for a job. */
  getOutputVideoPath(jobId: string): string;
  /** Scratch directory for intermediate frames, audio, SRT. */
  getWorkDir(jobId: string): string;
  ensureBaseDirs(): Promise<void>;
}

export class LocalStorageService implements StorageService {
  readonly kind = "local" as const;

  constructor(private readonly cfg: AppConfig) {}

  getOutputVideoPath(jobId: string): string {
    return path.join(this.cfg.outputDir, `${jobId}.mp4`);
  }

  getWorkDir(jobId: string): string {
    return path.join(this.cfg.outputDir, jobId);
  }

  async ensureBaseDirs(): Promise<void> {
    await mkdir(this.cfg.outputDir, { recursive: true });
    await mkdir(this.cfg.assetsDir, { recursive: true });
  }
}

export function createStorageService(cfg: AppConfig): StorageService {
  if (cfg.storageProvider === "s3") {
    throw new Error("S3 storage is not wired yet; set STORAGE_PROVIDER=local");
  }
  return new LocalStorageService(cfg);
}
