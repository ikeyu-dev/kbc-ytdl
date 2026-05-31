"use client";

import {
    Clock3,
    Download,
    ListChecks,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
    DownloaderPanel,
    type AudioFormat,
    type DownloadType,
} from "@/components/DownloaderPanel";

function getConcurrency(count: number) {
    return count >= 4 ? 4 : 1;
}

function formatEstimate(count: number) {
    if (count === 0) {
        return "未入力";
    }
    const concurrency = getConcurrency(count);
    const minSeconds = (count * 5) / concurrency;
    const maxSeconds = (count * 18) / concurrency;
    const toMinutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));
    return `${toMinutes(minSeconds)}〜${toMinutes(maxSeconds)}分`;
}

export function DownloaderApp() {
    const [type, setType] = useState<DownloadType>("audio");
    const [audioFormat, setAudioFormat] = useState<AudioFormat>("wav");
    const [pastedCount, setPastedCount] = useState(0);

    const estimate = useMemo(
        () => formatEstimate(pastedCount),
        [pastedCount]
    );

    return (
        <main className="min-h-screen p-3 sm:p-5 lg:h-screen lg:overflow-hidden lg:p-7">
            <div className="mx-auto grid max-w-7xl items-stretch gap-5 lg:h-full lg:min-h-0 lg:grid-cols-[20rem_1fr]">
                <aside className="rounded-lg border border-base-300 bg-base-100 shadow-xl lg:h-full lg:overflow-auto">
                    <div className="border-b border-base-300 p-5">
                        <div className="flex items-center gap-3">
                            <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-content shadow-sm">
                                <Download className="size-6" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm text-base-content/60">
                                    KBC Tool
                                </p>
                                <h1 className="text-xl font-bold leading-tight">
                                    YouTube Downloader
                                </h1>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 p-5">
                        <label className="form-control">
                            <span className="label pb-1 text-sm font-bold">
                                保存対象
                            </span>
                            <select
                                className="select select-bordered w-full"
                                value={type}
                                onChange={(event) =>
                                    setType(event.target.value as DownloadType)
                                }
                            >
                                <option value="audio">音声のみ</option>
                                <option value="video">動画 / mp4</option>
                            </select>
                        </label>

                        {type === "audio" && (
                            <label className="form-control">
                                <span className="label pb-1 text-sm font-bold">
                                    音声形式
                                </span>
                                <select
                                    className="select select-bordered w-full"
                                    value={audioFormat}
                                    onChange={(event) =>
                                        setAudioFormat(
                                            event.target.value as AudioFormat
                                        )
                                    }
                                >
                                    <option value="wav">wav</option>
                                    <option value="mp3">mp3</option>
                                    <option value="m4a">m4a</option>
                                </select>
                            </label>
                        )}

                        <div className="grid gap-2">
                            <div className="flex items-center gap-3 rounded-md bg-base-200 p-3">
                                <ListChecks className="size-5 text-primary" />
                                <div>
                                    <p className="font-bold leading-tight">
                                        {pastedCount} 件
                                    </p>
                                    <p className="text-xs text-base-content/60">
                                        zipファイルでダウンロードされます
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 rounded-md bg-base-200 p-3">
                                <Clock3 className="size-5 text-primary" />
                                <div>
                                    <p className="font-bold leading-tight">
                                        {estimate}
                                    </p>
                                    <p className="text-xs text-base-content/60">
                                        処理時間の目安
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                <section className="min-w-0 lg:h-full lg:min-h-0">
                    <DownloaderPanel
                        audioFormat={audioFormat}
                        onBulkCountChange={setPastedCount}
                        type={type}
                    />
                </section>
            </div>
        </main>
    );
}
