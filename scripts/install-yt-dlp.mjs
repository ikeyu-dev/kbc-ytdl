import { createWriteStream } from "node:fs";
import { chmod, mkdir, rename, rm } from "node:fs/promises";
import https from "node:https";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const vendorDir = join(rootDir, "vendor");
const targetPath = join(
    vendorDir,
    process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"
);
const tempPath = `${targetPath}.download`;

const assetNameByPlatform = {
    darwin: "yt-dlp_macos",
    linux: "yt-dlp_linux",
    win32: "yt-dlp.exe",
};

const assetName = assetNameByPlatform[process.platform];

if (!assetName) {
    throw new Error(`Unsupported platform for yt-dlp: ${process.platform}`);
}

const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName}`;

function download(url, destination, redirects = 0) {
    return new Promise((resolve, reject) => {
        https
            .get(
                url,
                {
                    headers: {
                        "User-Agent": "kbc-ytdl-installer",
                    },
                },
                (response) => {
                    if (
                        response.statusCode &&
                        response.statusCode >= 300 &&
                        response.statusCode < 400 &&
                        response.headers.location
                    ) {
                        response.resume();
                        if (redirects >= 5) {
                            reject(new Error("Too many redirects downloading yt-dlp"));
                            return;
                        }
                        download(response.headers.location, destination, redirects + 1)
                            .then(resolve)
                            .catch(reject);
                        return;
                    }

                    if (response.statusCode !== 200) {
                        response.resume();
                        reject(
                            new Error(
                                `Failed to download yt-dlp: HTTP ${response.statusCode}`
                            )
                        );
                        return;
                    }

                    const file = createWriteStream(destination);
                    response.pipe(file);
                    file.on("finish", () => {
                        file.close(resolve);
                    });
                    file.on("error", reject);
                }
            )
            .on("error", reject);
    });
}

await mkdir(vendorDir, { recursive: true });
await rm(tempPath, { force: true });
await download(downloadUrl, tempPath);
await chmod(tempPath, 0o755);
await rename(tempPath, targetPath);

console.log(`Installed yt-dlp standalone binary: ${targetPath}`);
