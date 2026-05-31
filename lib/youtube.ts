import ytdl from "@distube/ytdl-core";
import { z } from "zod";

export const downloadTypeSchema = z.enum(["audio", "video"]);
export const audioFormatSchema = z.enum(["wav", "mp3", "m4a"]);

export const youtubeUrlSchema = z
    .string()
    .trim()
    .url("YouTube の URL を入力してください")
    .refine((value) => ytdl.validateURL(value), {
        message: "対応している YouTube URL ではありません",
    });

export type DownloadType = z.infer<typeof downloadTypeSchema>;
export type AudioFormat = z.infer<typeof audioFormatSchema>;

function getConfiguredYoutubeCookies() {
    const base64Cookies = process.env.YOUTUBE_COOKIES_BASE64?.trim();
    if (base64Cookies) {
        return Buffer.from(base64Cookies, "base64").toString("utf8").trim();
    }

    return process.env.YOUTUBE_COOKIES?.trim() || "";
}

function parseNetscapeCookieHeader(cookies: string) {
    return cookies
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => line.split("\t"))
        .filter((columns) => columns.length >= 7)
        .map((columns) => `${columns[5]}=${columns[6]}`)
        .join("; ");
}

export function getYoutubeCookieHeader() {
    const cookies = getConfiguredYoutubeCookies();
    if (!cookies) {
        return "";
    }

    if (cookies.includes("\t") || cookies.includes("# Netscape HTTP Cookie File")) {
        return parseNetscapeCookieHeader(cookies);
    }

    return cookies;
}

export function getYtdlOptions(): ytdl.getInfoOptions {
    const cookie = getYoutubeCookieHeader();

    return {
        lang: "ja",
        playerClients: ["WEB", "WEB_EMBEDDED", "IOS", "ANDROID", "TV"],
        requestOptions: cookie
            ? {
                  headers: {
                      cookie,
                  },
              }
            : undefined,
    };
}

export function chooseDownloadFormat(
    formats: ytdl.videoFormat[],
    type: DownloadType,
) {
    const candidates: ytdl.chooseFormatOptions[] =
        type === "audio"
            ? [
                  { quality: "highestaudio", filter: "audioonly" },
                  { quality: "highestaudio", filter: "audio" },
                  { quality: "highest", filter: "audioandvideo" },
              ]
            : [
                  { quality: "highest", filter: "audioandvideo" },
                  { quality: "highest", filter: "videoandaudio" },
                  { quality: "highest", filter: "video" },
              ];
    const playableFormats = formats.filter((format) => Boolean(format.url));

    if (playableFormats.length === 0) {
        throw new Error("NO_PLAYABLE_FORMATS");
    }

    for (const candidate of candidates) {
        try {
            const format = ytdl.chooseFormat(playableFormats, candidate);
            if (format?.url) {
                return format;
            }
        } catch {
            // Try the next format group.
        }
    }

    throw new Error("NO_PLAYABLE_FORMATS");
}

export function getFileExtension(format: ytdl.videoFormat) {
    const mimeType = format.mimeType?.split(";")[0];
    if (mimeType === "audio/webm" || mimeType === "video/webm") {
        return "webm";
    }
    if (mimeType === "audio/mp4" || mimeType === "video/mp4") {
        return "mp4";
    }
    return format.container || "mp4";
}

export function toSafeFilename(title: string) {
    return title
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
}

export function normalizeYoutubeError(error: unknown) {
    const message =
        error instanceof Error ? error.message : "動画情報の取得に失敗しました";
    const lowerMessage = message.toLowerCase();

    if (
        message === "NO_PLAYABLE_FORMATS" ||
        lowerMessage.includes("no playable formats") ||
        lowerMessage.includes("failed to find any playable formats") ||
        lowerMessage.includes("requested format is not available")
    ) {
        return "再生可能な音声・動画形式が見つかりません。Cookie の期限切れ、YouTube の bot 確認、または動画側の制限の可能性があります。";
    }

    if (
        lowerMessage.includes("sign in") ||
        lowerMessage.includes("confirm") ||
        lowerMessage.includes("bot") ||
        lowerMessage.includes("login")
    ) {
        return "YouTube からログイン確認または bot 確認を求められました。Vercel の YOUTUBE_COOKIES または YOUTUBE_COOKIES_BASE64 にブラウザの Cookie を設定してください。";
    }

    if (
        lowerMessage.includes("unavailable") ||
        lowerMessage.includes("private video") ||
        lowerMessage.includes("video unavailable")
    ) {
        return "この動画は利用できません。削除、非公開、地域制限、または配信者側の制限を確認してください。";
    }

    if (
        lowerMessage.includes("region") ||
        lowerMessage.includes("country") ||
        lowerMessage.includes("not made this video available")
    ) {
        return "この動画は現在の地域では視聴できません。配信地域の制限を確認してください。";
    }

    return message;
}

export { ytdl };
