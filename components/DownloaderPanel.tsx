"use client";

import {
    AlertCircle,
    Archive,
    ClipboardPaste,
    Download,
    FileAudio,
    FileVideo,
    Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type DownloadType = "audio" | "video";
export type AudioFormat = "wav" | "mp3" | "m4a";

interface DownloaderPanelProps {
    audioFormat: AudioFormat;
    onBulkCountChange: (count: number) => void;
    type: DownloadType;
}

export function DownloaderPanel({
    audioFormat,
    onBulkCountChange,
    type,
}: DownloaderPanelProps) {
    const [url, setUrl] = useState("");
    const [bulkUrls, setBulkUrls] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    async function pasteFromClipboard() {
        const text = await navigator.clipboard.readText();
        setUrl(text.trim());
    }

    async function pasteBulkFromClipboard() {
        const text = await navigator.clipboard.readText();
        setBulkUrls(text.trim());
    }

    const bulkUrlList = useMemo(
        () =>
            bulkUrls
                .split(/[\s,]+/)
                .map((item) => item.trim())
                .filter(Boolean),
        [bulkUrls]
    );

    useEffect(() => {
        onBulkCountChange(bulkUrlList.length);
    }, [bulkUrlList.length, onBulkCountChange]);

    async function handleBulkDownload() {
        setBulkLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/bulk-download", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    audioFormat,
                    type,
                    urls: bulkUrlList,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.error || "zip の作成に失敗しました");
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = `kbc-youtube-downloads-${new Date()
                .toISOString()
                .slice(0, 10)}.zip`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(objectUrl);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "zip の作成に失敗しました"
            );
        } finally {
            setBulkLoading(false);
        }
    }

    return (
        <div className="card h-full min-h-0 rounded-lg border border-base-300 bg-base-100 shadow-xl">
            <div className="card-body flex h-full min-h-0 flex-col gap-5 p-5 sm:p-6">
                <div className="flex flex-col gap-3 border-base-300 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">
                            ダウンロード
                        </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <span className="badge badge-outline gap-2 p-3">
                            {type === "audio" ? (
                                <FileAudio className="size-4" />
                            ) : (
                                <FileVideo className="size-4" />
                            )}
                            {type === "audio"
                                ? `音声 / ${audioFormat}`
                                : "動画 / mp4"}
                        </span>
                    </div>
                </div>

                <section className="rounded-lg border border-base-300 bg-base-100 p-4">
                    <form
                        action="/api/download"
                        className="grid gap-3"
                        method="GET"
                    >
                        <input
                            name="type"
                            type="hidden"
                            value={type}
                        />
                        <input
                            name="audioFormat"
                            type="hidden"
                            value={audioFormat}
                        />
                        <label className="form-control">
                            <span className="label pb-1 text-sm font-bold">
                                YouTube URL
                            </span>
                            <div className="join w-full">
                                <input
                                    className="input input-bordered join-item min-w-0 flex-1 bg-base-100"
                                    inputMode="url"
                                    name="url"
                                    placeholder="https://youtu.be/..."
                                    required
                                    value={url}
                                    onChange={(event) =>
                                        setUrl(event.target.value)
                                    }
                                />
                                <button
                                    type="button"
                                    className="btn join-item btn-outline px-3"
                                    onClick={pasteFromClipboard}
                                    aria-label="クリップボードから貼り付け"
                                    title="クリップボードから貼り付け"
                                >
                                    <ClipboardPaste className="size-5" />
                                </button>
                            </div>
                        </label>

                        <button
                            type="submit"
                            className="btn btn-primary gap-2 sm:w-fit"
                            disabled={!url.trim()}
                        >
                            <Download className="size-5" />
                            ダウンロード
                        </button>
                    </form>
                </section>

                {error && (
                    <div className="alert alert-error items-start">
                        <AlertCircle className="size-5 shrink-0" />
                        <span className="break-words">{error}</span>
                    </div>
                )}

                <section className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-base-300 bg-base-100 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-sm text-base-content/60">
                                スプレッドシートからまとめて貼り付け
                            </p>
                            <h3 className="text-xl font-bold">
                                一括ダウンロード
                            </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="badge badge-primary w-fit">
                                {bulkUrlList.length} 件
                            </span>
                        </div>
                    </div>

                    <label className="form-control flex min-h-0 w-full flex-1 flex-col">
                        <span className="label pb-1 text-sm font-bold">
                            複数 YouTube URL
                        </span>
                        <textarea
                            className="textarea textarea-bordered block min-h-40 w-full max-w-none flex-1 resize-none bg-base-100 leading-relaxed lg:min-h-0"
                            placeholder={"https://youtu.be/...\nhttps://youtu.be/..."}
                            value={bulkUrls}
                            onChange={(event) =>
                                setBulkUrls(event.target.value)
                            }
                        />
                    </label>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                            type="button"
                            className="btn btn-outline gap-2"
                            onClick={pasteBulkFromClipboard}
                        >
                            <ClipboardPaste className="size-5" />
                            貼り付け
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary gap-2"
                            disabled={
                                bulkLoading || bulkUrlList.length === 0
                            }
                            onClick={handleBulkDownload}
                        >
                            {bulkLoading ? (
                                <Loader2 className="size-5 animate-spin" />
                            ) : (
                                <Archive className="size-5" />
                            )}
                            zip を作成して保存
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
