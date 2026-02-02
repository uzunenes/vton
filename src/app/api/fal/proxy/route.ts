import { NextResponse } from "next/server";

async function handleRequest(request: Request) {
    const targetUrl = request.headers.get("x-fal-target-url");

    if (!targetUrl) {
        return NextResponse.json({ error: "Missing x-fal-target-url header" }, { status: 400 });
    }

    // Forward all headers except host and connection-related ones
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("connection");
    headers.delete("x-fal-target-url");
    headers.set("Authorization", `Key ${process.env.FAL_KEY}`);

    // Create upstream request
    console.log(`PROXY ${request.method} DEBUG: Forwarding to`, targetUrl);

    const upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.body, // Stream the body directly (supports binary/JSON)
        // @ts-ignore - 'duplex' is needed for node fetch with bodies
        duplex: 'half',
    });

    // Forward response
    return new NextResponse(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: upstreamResponse.headers,
    });
}

export const POST = handleRequest;
export const PUT = handleRequest;

export async function GET(request: Request) {
    const targetUrl = request.headers.get("x-fal-target-url");

    if (!targetUrl) {
        return NextResponse.json({ error: "Missing x-fal-target-url header" }, { status: 400 });
    }

    // Forward all headers except host and connection-related ones
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("connection");
    headers.delete("x-fal-target-url");
    headers.set("Authorization", `Key ${process.env.FAL_KEY}`);

    console.log("PROXY GET DEBUG: Forwarding to", targetUrl);

    const upstreamResponse = await fetch(targetUrl, {
        method: "GET",
        headers: headers,
    });

    console.log("PROXY GET DEBUG: Upstream Status", upstreamResponse.status);

    if (!upstreamResponse.ok) {
        const errorText = await upstreamResponse.text();
        console.error("PROXY GET DEBUG: Upstream Error Body", errorText);
        return new NextResponse(errorText, {
            status: upstreamResponse.status,
            headers: upstreamResponse.headers
        });
    }

    // Forward response
    return new NextResponse(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: upstreamResponse.headers,
    });
}
