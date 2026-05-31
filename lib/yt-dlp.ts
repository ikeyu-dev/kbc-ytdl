import path from "path";

import type { AudioFormat, DownloadType } from "@/lib/youtube";

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

    const cookie = process.env.YOUTUBE_COOKIES?.trim();
    if (cookie) {
        args.push("--add-header", `Cookie: ${cookie}`);
    }

    return args;
}
