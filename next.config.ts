import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    serverExternalPackages: ["archiver"],
    outputFileTracingIncludes: {
        "/api/download": [
            "./vendor/yt-dlp",
            "./vendor/yt-dlp.exe",
            "./node_modules/ffmpeg-static/ffmpeg",
        ],
        "/api/bulk-download": [
            "./vendor/yt-dlp",
            "./vendor/yt-dlp.exe",
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
