import { spawn } from "child_process";
import fs from "fs";
import { mkdtemp, readdir, rm, stat } from "fs/promises";
import os from "os";
import path from "path";
import { PassThrough, Readable } from "stream";

import * as archiverNamespace from "archiver";
import { NextResponse } from "next/server";

import {
    audioFormatSchema,
    downloadTypeSchema,
    normalizeYoutubeError,
    youtubeUrlSchema,
} from "@/lib/youtube";
import { getYtDlpBaseArgs, ytDlpBinaryPath } from "@/lib/yt-dlp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_CONCURRENCY = 4;
const ZipArchive = (
    archiverNamespace as typeof archiverNamespace & {
        ZipArchive: new (options: { zlib: { level: number } }) => {
            append: (source: string | Buffer, data: { name: string }) => void;
            file: (filePath: string, data: { name: string }) => void;
            finalize: () => void;
            on: (event: string, listener: (...args: unknown[]) => void) => void;
            pipe: (stream: PassThrough) => void;
        };
    }
).ZipArchive;

function encodeFilename(filename: string) {
    const fallback = filename.replace(/[^\x20-\x7E]/g, "_");
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function parseUrls(value: unknown) {
    if (Array.isArray(value)) {
        return value.map(String);
    }

    if (typeof value === "string") {
        return value
            .split(/[\s,]+/)
            .map((url) => url.trim())
            .filter(Boolean);
    }

    return [];
}

async function getNewFilePath(tempDir: string, beforeFiles: Set<string>) {
    const entries = await readdir(tempDir);
    const newFiles = entries.filter((entry) => !beforeFiles.has(entry));
    if (newFiles.length === 0) {
        return null;
    }

    const filesWithStats = await Promise.all(
        newFiles.map(async (entry) => {
            const filePath = path.join(tempDir, entry);
            return {
                filePath,
                stats: await stat(filePath),
            };
        })
    );

    return filesWithStats
        .filter((entry) => entry.stats.isFile() && entry.stats.size > 0)
        .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs)[0]?.filePath;
}

async function downloadToTempFile({
    audioFormat,
    url,
    index,
    tempDir,
    type,
}: {
    audioFormat: "wav" | "mp3" | "m4a";
    url: string;
    index: number;
    tempDir: string;
    type: "audio" | "video";
}) {
    const beforeFiles = new Set(await readdir(tempDir));
    const outputTemplate = path.join(
        tempDir,
        `${String(index).padStart(2, "0")} - %(title).120B.%(ext)s`
    );
    const args = [
        url,
        ...getYtDlpBaseArgs(type, audioFormat),
        "--output",
        outputTemplate,
        "--print",
        "after_move:filepath",
    ];

    return new Promise<string>((resolve, reject) => {
        const child = spawn(ytDlpBinaryPath, args, {
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";

        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
            stdout += chunk;
        });
        child.stderr.on("data", (chunk: string) => {
            stderr += chunk;
        });
        child.on("error", reject);
        child.on("close", async (code) => {
            if (code !== 0) {
                reject(new Error(stderr || `yt-dlp exited with code ${code}`));
                return;
            }

            const printedPath = stdout.trim().split("\n").at(-1);
            if (printedPath && fs.existsSync(printedPath)) {
                resolve(printedPath);
                return;
            }

            const filePath = await getNewFilePath(tempDir, beforeFiles);
            if (filePath) {
                resolve(filePath);
                return;
            }

            reject(new Error("ダウンロード済みファイルが見つかりませんでした"));
        });
    });
}

type DownloadResult =
    | {
          filePath: string;
          index: number;
          url: string;
      }
    | {
          error: unknown;
          index: number;
          url: string;
      };

async function mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>
) {
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    async function worker() {
        for (;;) {
            const currentIndex = nextIndex;
            nextIndex += 1;

            if (currentIndex >= items.length) {
                return;
            }

            results[currentIndex] = await mapper(
                items[currentIndex],
                currentIndex
            );
        }
    }

    await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, () =>
            worker()
        )
    );

    return results;
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const typeResult = downloadTypeSchema.safeParse(body?.type ?? "audio");
    const audioFormatResult = audioFormatSchema.safeParse(
        body?.audioFormat ?? "wav"
    );
    const urls = parseUrls(body?.urls);
    const concurrency = urls.length >= MAX_CONCURRENCY ? MAX_CONCURRENCY : 1;
    const invalidUrl = urls.find((url) => !youtubeUrlSchema.safeParse(url).success);

    if (
        !typeResult.success ||
        !audioFormatResult.success ||
        urls.length === 0 ||
        invalidUrl
    ) {
        return NextResponse.json(
            {
                error: invalidUrl
                    ? `対応している YouTube URL ではありません: ${invalidUrl}`
                    : audioFormatResult.error?.issues[0]?.message ||
                      "URL を 1 件以上入力してください",
            },
            { status: 400 }
        );
    }

    const zipStream = new PassThrough();
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const zipName = `kbc-youtube-downloads-${new Date()
        .toISOString()
        .slice(0, 10)}.zip`;

    archive.on("error", (error) => {
        zipStream.destroy(error instanceof Error ? error : new Error(String(error)));
    });
    archive.pipe(zipStream);

    void (async () => {
        const tempDir = await mkdtemp(path.join(os.tmpdir(), "kbc-ytdl-"));
        const failures: string[] = [];

        try {
            const results = await mapWithConcurrency<string, DownloadResult>(
                urls,
                concurrency,
                async (url, index) => {
                    try {
                        const filePath = await downloadToTempFile({
                            audioFormat: audioFormatResult.data,
                            url,
                            index: index + 1,
                            tempDir,
                            type: typeResult.data,
                        });
                        return { filePath, index, url };
                    } catch (error) {
                        return { error, index, url };
                    }
                }
            );

            for (const result of results) {
                if ("filePath" in result) {
                    archive.file(result.filePath, {
                        name: path.basename(result.filePath),
                    });
                    continue;
                }

                failures.push(
                    `${result.url}\n${normalizeYoutubeError(result.error)}`
                );
            }

            if (failures.length > 0) {
                archive.append(failures.join("\n\n"), {
                    name: "failed-downloads.txt",
                });
            }
        } finally {
            archive.finalize();
            archive.on("end", () => {
                void rm(tempDir, { recursive: true, force: true });
            });
        }
    })().catch((error) => {
        archive.append(normalizeYoutubeError(error), {
            name: "failed-downloads.txt",
        });
        archive.finalize();
    });

    return new Response(Readable.toWeb(zipStream) as ReadableStream, {
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": encodeFilename(zipName),
            "Cache-Control": "no-store",
        },
    });
}
