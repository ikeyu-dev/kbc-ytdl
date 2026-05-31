import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    serverExternalPackages: ["archiver"],
    outputFileTracingIncludes: {
        "/api/download": [
            "./node_modules/youtube-dl-exec/bin/yt-dlp",
            "./node_modules/ffmpeg-static/ffmpeg",
        ],
        "/api/bulk-download": [
            "./node_modules/youtube-dl-exec/bin/yt-dlp",
            "./node_modules/ffmpeg-static/ffmpeg",
        ],
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "i.ytimg.com",
            },
            {
                protocol: "https",
                hostname: "img.youtube.com",
            },
        ],
    },
};

export default nextConfig;
