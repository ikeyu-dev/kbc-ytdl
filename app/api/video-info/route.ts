import { NextResponse } from "next/server";
import {
    audioFormatSchema,
    downloadTypeSchema,
    normalizeYoutubeError,
    youtubeUrlSchema,
} from "@/lib/youtube";
import { getYtDlpFilenameTitle, getYtDlpVideoInfo } from "@/lib/yt-dlp";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const urlResult = youtubeUrlSchema.safeParse(body?.url);
    const typeResult = downloadTypeSchema.safeParse(body?.type ?? "audio");
    const audioFormatResult = audioFormatSchema.safeParse(
        body?.audioFormat ?? "wav"
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
        const extension =
            typeResult.data === "audio"
                ? audioFormatResult.data
                : info.ext || "mp4";
        const thumbnail =
            info.thumbnails?.at(-1)?.url || info.thumbnail || null;

        return NextResponse.json({
            title: info.title || "YouTube video",
            author: info.uploader || "",
            lengthSeconds: Number(info.duration || 0),
            thumbnail,
            quality:
                info.format ||
                (info.height ? `${info.height}p` : info.format_id || "best"),
            mimeType: null,
            extension,
            filename: `${getYtDlpFilenameTitle(info)}.${extension}`,
        });
    } catch (error) {
        return NextResponse.json(
            { error: normalizeYoutubeError(error) },
            { status: 502 }
        );
    }
}
