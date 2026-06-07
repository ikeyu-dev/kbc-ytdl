import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

import {
    getYoutubeCookieHeader,
    type AudioFormat,
    type DownloadType,
    toSafeFilename,
} from "@/lib/youtube";

export const ytDlpBinaryPath = path.join(
    process.cwd(),
    "vendor",
    process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"
);

export const ffmpegBinaryPath = path.join(
    process.cwd(),
    "node_modules",
    "ffmpeg-static",
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
);

export const denoBinaryPath = path.join(
    process.cwd(),
    "vendor",
    process.platform === "win32" ? "deno.exe" : "deno"
);

function getConfiguredCookieFilePath() {
    const cookies = process.env.YOUTUBE_COOKIES?.trim();
    if (
        cookies &&
        (cookies.includes("\t") || cookies.includes("# Netscape HTTP Cookie File"))
    ) {
        const cookieFilePath = path.join(os.tmpdir(), "kbc-youtube-cookies.txt");
        fs.writeFileSync(cookieFilePath, cookies, { mode: 0o600 });
        return cookieFilePath;
    }

    const localCookieFilePath = path.join(process.cwd(), "www.youtube.com_cookies.txt");
    if (
        process.env.NODE_ENV === "development" &&
        fs.existsSync(localCookieFilePath)
    ) {
        return localCookieFilePath;
    }

    return "";
}

function getYtDlpCommonArgs() {
    const args = [
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "--extractor-args",
        "youtube:player_client=android,ios,tv",
        "--ffmpeg-location",
        ffmpegBinaryPath,
    ];

    args.push(
        "--js-runtimes",
        fs.existsSync(denoBinaryPath) ? `deno:${denoBinaryPath}` : "deno,node"
    );

    const cookieFilePath = getConfiguredCookieFilePath();
    if (cookieFilePath) {
        args.push("--cookies", cookieFilePath);
    } else {
        const cookie = getYoutubeCookieHeader();
        if (cookie) {
            args.push("--add-header", `Cookie: ${cookie}`);
        }
    }

    return args;
}

function getYtDlpFormatArgs(type: DownloadType) {
    return [
        "--format",
        type === "audio" ? "bestaudio/best" : "best[ext=mp4]/best",
    ];
}

export function getYtDlpBaseArgs(type: DownloadType, audioFormat: AudioFormat) {
    const args = [...getYtDlpFormatArgs(type), ...getYtDlpCommonArgs()];

    if (type === "audio") {
        args.push("--extract-audio", "--audio-format", audioFormat);
    }

    return args;
}

interface YtDlpVideoInfo {
    duration?: number;
    ext?: string;
    format?: string;
    format_id?: string;
    height?: number;
    thumbnail?: string;
    thumbnails?: { url?: string }[];
    title?: string;
    uploader?: string;
    vcodec?: string;
    acodec?: string;
}

export function getYtDlpVideoInfo(
    url: string,
    type: DownloadType
): Promise<YtDlpVideoInfo> {
    const args = [
        url,
        ...getYtDlpFormatArgs(type),
        ...getYtDlpCommonArgs(),
        "--skip-download",
        "--dump-single-json",
    ];

    return new Promise((resolve, reject) => {
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
        child.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(stderr || `yt-dlp exited with code ${code}`));
                return;
            }

            try {
                resolve(JSON.parse(stdout) as YtDlpVideoInfo);
            } catch {
                reject(new Error("動画情報の解析に失敗しました"));
            }
        });
    });
}

export function getYtDlpFilenameTitle(info: YtDlpVideoInfo) {
    return toSafeFilename(info.title || "youtube-download");
}
