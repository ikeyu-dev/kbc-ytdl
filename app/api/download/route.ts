import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import { mkdtemp, readdir, rm, stat } from "fs/promises";
import os from "os";
import path from "path";
import { Readable } from "stream";
import {
    audioFormatSchema,
    downloadTypeSchema,
    normalizeYoutubeError,
    toSafeFilename,
    youtubeUrlSchema,
} from "@/lib/youtube";
import {
    getYtDlpBaseArgs,
    getYtDlpFilenameTitle,
    getYtDlpVideoInfo,
    ytDlpBinaryPath,
} from "@/lib/yt-dlp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeFilename(filename: string) {
    const fallback = filename.replace(/[^\x20-\x7E]/g, "_");
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function getNewFilePath(tempDir: string, beforeFiles: Set<string>) {
    const entries = await readdir(tempDir);
    const newFiles = entries.filter((entry) => !beforeFiles.has(entry));
    const filesWithStats = await Promise.all(
        newFiles.map(async (entry) => {
            const filePath = path.join(tempDir, entry);
            return { filePath, stats: await stat(filePath) };
        })
    );

    return filesWithStats
        .filter((entry) => entry.stats.isFile() && entry.stats.size > 0)
        .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs)[0]?.filePath;
}

async function downloadToTempFile({
    audioFormat,
    title,
    type,
    url,
}: {
    audioFormat: "wav" | "mp3" | "m4a";
    title: string;
    type: "audio" | "video";
    url: string;
}) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "kbc-ytdl-single-"));
    const beforeFiles = new Set(await readdir(tempDir));
    const extension = type === "audio" ? audioFormat : "mp4";
    const outputTemplate = path.join(
        tempDir,
        `${toSafeFilename(title)}.%(ext)s`
    );
    const args = [
        url,
        ...getYtDlpBaseArgs(type, audioFormat),
        "--output",
        outputTemplate,
        "--print",
        "after_move:filepath",
    ];

    return new Promise<{ filePath: string; tempDir: string; filename: string }>(
        (resolve, reject) => {
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
                const filePath =
                    printedPath && fs.existsSync(printedPath)
                        ? printedPath
                        : await getNewFilePath(tempDir, beforeFiles);

                if (!filePath) {
                    reject(new Error("ダウンロード済みファイルが見つかりませんでした"));
                    return;
                }

                resolve({
                    filePath,
                    tempDir,
                    filename: `${toSafeFilename(title)}.${extension}`,
                });
            });
        }
    );
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const urlResult = youtubeUrlSchema.safeParse(searchParams.get("url"));
    const typeResult = downloadTypeSchema.safeParse(
        searchParams.get("type") ?? "audio"
    );
    const audioFormatResult = audioFormatSchema.safeParse(
        searchParams.get("audioFormat") ?? "wav"
    );

    if (!urlResult.success || !typeResult.success || !audioFormatResult.success) {
        return NextResponse.json(
            {
                error:
                    urlResult.error?.issues[0]?.message ||
                    typeResult.error?.issues[0]?.message ||
                    audioFormatResult.error?.issues[0]?.message ||
                    "入力内容を確認してください",
            },
            { status: 400 }
        );
    }

    try {
        const info = await getYtDlpVideoInfo(urlResult.data, typeResult.data);
        const { filePath, filename, tempDir } = await downloadToTempFile({
            audioFormat: audioFormatResult.data,
            title: getYtDlpFilenameTitle(info),
            type: typeResult.data,
            url: urlResult.data,
        });
        const fileStream = fs.createReadStream(filePath);
        fileStream.on("close", () => {
            void rm(tempDir, { recursive: true, force: true });
        });

        const headers = new Headers({
            "Content-Type": "application/octet-stream",
            "Content-Disposition": encodeFilename(filename),
            "Cache-Control": "no-store",
        });

        return new Response(Readable.toWeb(fileStream) as ReadableStream, {
            headers,
        });
    } catch (error) {
        return NextResponse.json(
            { error: normalizeYoutubeError(error) },
            { status: 502 }
        );
    }
}
