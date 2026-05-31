import fs from "fs";
import os from "os";
import path from "path";

import {
    getYoutubeCookieHeader,
    type AudioFormat,
    type DownloadType,
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

function getConfiguredCookieFilePath() {
    const base64Cookies = process.env.YOUTUBE_COOKIES_BASE64?.trim();
    if (base64Cookies) {
        const cookieFilePath = path.join(os.tmpdir(), "kbc-youtube-cookies.txt");
        fs.writeFileSync(
            cookieFilePath,
            Buffer.from(base64Cookies, "base64").toString("utf8"),
            { mode: 0o600 }
        );
        return cookieFilePath;
    }

    const cookies = process.env.YOUTUBE_COOKIES?.trim();
    if (
        cookies &&
        (cookies.includes("\t") || cookies.includes("# Netscape HTTP Cookie File"))
    ) {
        const cookieFilePath = path.join(os.tmpdir(), "kbc-youtube-cookies.txt");
        fs.writeFileSync(cookieFilePath, cookies, { mode: 0o600 });
        return cookieFilePath;
    }

    return "";
}

export function getYtDlpBaseArgs(type: DownloadType, audioFormat: AudioFormat) {
    const args = [
        "--format",
        type === "audio" ? "bestaudio/best" : "best[ext=mp4]/best",
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "--js-runtimes",
        "node,deno",
        "--ffmpeg-location",
        ffmpegBinaryPath,
    ];

    if (type === "audio") {
        args.push("--extract-audio", "--audio-format", audioFormat);
    }

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
