import { NextResponse } from "next/server";
import {
    audioFormatSchema,
    chooseDownloadFormat,
    downloadTypeSchema,
    getFileExtension,
    getYtdlOptions,
    normalizeYoutubeError,
    toSafeFilename,
    youtubeUrlSchema,
    ytdl,
} from "@/lib/youtube";

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
        const info = await ytdl.getInfo(urlResult.data, getYtdlOptions());
        const format = chooseDownloadFormat(info.formats, typeResult.data);
        const extension =
            typeResult.data === "audio"
                ? audioFormatResult.data
                : getFileExtension(format);
        const details = info.videoDetails;
        const thumbnail =
            details.thumbnails.at(-1)?.url || details.thumbnails[0]?.url || null;

        return NextResponse.json({
            title: details.title,
            author: details.author.name,
            lengthSeconds: Number(details.lengthSeconds || 0),
            thumbnail,
            quality:
                format.qualityLabel ||
                (format.audioBitrate ? `${format.audioBitrate}kbps` : "best"),
            mimeType: format.mimeType?.split(";")[0] || null,
            extension,
            filename: `${toSafeFilename(details.title)}.${extension}`,
        });
    } catch (error) {
        return NextResponse.json(
            { error: normalizeYoutubeError(error) },
            { status: 502 }
        );
    }
}
