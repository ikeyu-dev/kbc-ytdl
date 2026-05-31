import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const REALM = "KBC YouTube Downloader";

function unauthorized() {
    return new NextResponse("Authentication required", {
        status: 401,
        headers: {
            "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
        },
    });
}

function timingSafeEqual(a: string, b: string) {
    const encoder = new TextEncoder();
    const left = encoder.encode(a);
    const right = encoder.encode(b);
    if (left.length !== right.length) {
        return false;
    }

    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left[index] ^ right[index];
    }
    return mismatch === 0;
}

export function middleware(request: NextRequest) {
    const user = process.env.BASIC_AUTH_USER;
    const password = process.env.BASIC_AUTH_PASSWORD;

    if (!user || !password) {
        if (process.env.NODE_ENV === "development") {
            return NextResponse.next();
        }
        return unauthorized();
    }

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Basic ")) {
        return unauthorized();
    }

    const credentials = atob(authorization.slice("Basic ".length));
    const separatorIndex = credentials.indexOf(":");
    if (separatorIndex === -1) {
        return unauthorized();
    }

    const inputUser = credentials.slice(0, separatorIndex);
    const inputPassword = credentials.slice(separatorIndex + 1);

    if (
        !timingSafeEqual(inputUser, user) ||
        !timingSafeEqual(inputPassword, password)
    ) {
        return unauthorized();
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
