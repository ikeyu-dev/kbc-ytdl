import { createWriteStream } from "node:fs";
import { chmod, mkdir, rename, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import https from "node:https";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const vendorDir = join(rootDir, "vendor");
const binaryName = process.platform === "win32" ? "deno.exe" : "deno";
const targetPath = join(vendorDir, binaryName);
const zipPath = join(vendorDir, "deno.zip");
const extractDir = join(vendorDir, "deno-extract");

const targetByPlatform = {
    "darwin-arm64": "aarch64-apple-darwin",
    "darwin-x64": "x86_64-apple-darwin",
    "linux-x64": "x86_64-unknown-linux-gnu",
    "win32-x64": "x86_64-pc-windows-msvc",
};

const releaseTarget = targetByPlatform[`${process.platform}-${process.arch}`];

if (!releaseTarget) {
    console.log(`Skipping Deno install for ${process.platform}-${process.arch}`);
    process.exit(0);
}

const downloadUrl = `https://github.com/denoland/deno/releases/latest/download/deno-${releaseTarget}.zip`;

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
                            reject(new Error("Too many redirects downloading Deno"));
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
                                `Failed to download Deno: HTTP ${response.statusCode}`
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
await rm(zipPath, { force: true });
await rm(extractDir, { recursive: true, force: true });
await mkdir(extractDir, { recursive: true });
await download(downloadUrl, zipPath);
await execFileAsync("unzip", ["-q", "-o", zipPath, "-d", extractDir]);
await rename(join(extractDir, binaryName), targetPath);
await chmod(targetPath, 0o755);
await rm(zipPath, { force: true });
await rm(extractDir, { recursive: true, force: true });

console.log(`Installed Deno standalone binary: ${targetPath}`);
