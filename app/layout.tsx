import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "KBC YouTube Downloader",
    description: "KBC YouTube Downloader",
};

export const viewport: Viewport = {
    themeColor: "#0086bf",
    width: "device-width",
    initialScale: 1,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="ja"
            data-theme="light"
        >
            <body>{children}</body>
        </html>
    );
}
