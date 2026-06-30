// One-off: upload local video files to Mux as placeholder reels and print the
// resulting playback ids. Used to bootstrap the placeholder reel lessons in
// seed-placeholder-lessons.ts — once the playback ids are in that file they
// are durable; this script does not need to run again on subsequent seeds.
//
// Run:
//   FILES="/abs/path/reel-01.mp4,/abs/path/reel-02.mp4" \
//     MUX_TOKEN_ID=... MUX_TOKEN_SECRET=... \
//     npx tsx src/scripts/upload-placeholder-reels.ts
//
// The script will:
//   1. create a Mux direct upload per file (basic quality, EN auto-subs)
//   2. PUT the bytes
//   3. poll until the asset is "ready"
//   4. print a JSON map of file -> { uploadId, assetId, playbackId,
//      durationSeconds, aspectRatio } that the seed script consumes.

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Mux from "@mux/mux-node";

const POLL_MS = 4_000;
const TIMEOUT_MS = 10 * 60_000;

async function pollUploadAssetId(mux: Mux, uploadId: string): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const u = await mux.video.uploads.retrieve(uploadId);
    if (u.asset_id) return u.asset_id;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`upload ${uploadId}: timed out waiting for asset_id`);
}

async function pollAssetReady(mux: Mux, assetId: string) {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const a = await mux.video.assets.retrieve(assetId);
    if (a.status === "ready") return a;
    if (a.status === "errored") {
      throw new Error(`asset ${assetId}: errored — ${JSON.stringify(a.errors)}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`asset ${assetId}: timed out waiting for "ready"`);
}

async function main() {
  const filesEnv = process.env.FILES;
  if (!filesEnv) throw new Error("FILES env var required (comma-separated paths)");
  const files = filesEnv.split(",").map((s) => s.trim()).filter(Boolean);
  for (const f of files) {
    if (!fs.existsSync(f)) throw new Error(`not a file: ${f}`);
  }
  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    throw new Error("MUX_TOKEN_ID / MUX_TOKEN_SECRET not set");
  }
  const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
  });

  const out: Record<
    string,
    {
      uploadId: string;
      assetId: string;
      playbackId: string;
      durationSeconds: number | null;
      aspectRatio: number | null;
    }
  > = {};

  for (const file of files) {
    const base = path.basename(file);
    console.log(`\n→ ${base}`);

    const upload = await mux.video.uploads.create({
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
        video_quality: "basic",
        input: [
          {
            generated_subtitles: [
              { language_code: "en", name: "English (CC)" },
            ],
          },
        ],
      },
    });
    console.log(`  upload created: ${upload.id}`);

    const bytes = fs.readFileSync(file);
    const put = await fetch(upload.url, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4" },
      body: bytes,
    });
    if (!put.ok) throw new Error(`PUT failed: ${put.status} ${put.statusText}`);
    console.log(`  bytes uploaded (${(bytes.length / (1024 * 1024)).toFixed(1)} MB)`);

    const assetId = await pollUploadAssetId(mux, upload.id);
    console.log(`  asset created: ${assetId}`);

    const asset = await pollAssetReady(mux, assetId);
    const playbackId = asset.playback_ids?.[0]?.id;
    if (!playbackId) throw new Error(`asset ${assetId}: no playback_id on ready`);
    const durationSeconds = asset.duration ?? null;
    const ar = asset.aspect_ratio
      ? Number(asset.aspect_ratio.split(":")[0]) /
        Number(asset.aspect_ratio.split(":")[1])
      : null;
    console.log(
      `  ready · playback=${playbackId} · ${durationSeconds?.toFixed(1)}s · ar=${ar?.toFixed(3)}`,
    );

    out[base] = {
      uploadId: upload.id,
      assetId,
      playbackId,
      durationSeconds,
      aspectRatio: ar,
    };
  }

  console.log("\n----- RESULT (paste into seed-placeholder-lessons.ts) -----");
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
