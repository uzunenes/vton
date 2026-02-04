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
    
    const falKey = process.env.FAL_KEY;
    if (!falKey || falKey === 'your_fal_key_here') {
        console.error("CRITICAL: FAL_KEY is missing or using placeholder in .env.local");
        return NextResponse.json({ 
            error: "Authentication required. Please set FAL_KEY in .env.local" 
        }, { status: 401 });
    }
    
    headers.set("Authorization", `Key ${falKey}`);

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
    
    const falKey = process.env.FAL_KEY;
    if (!falKey || falKey === 'your_fal_key_here') {
        console.error("CRITICAL GET: FAL_KEY is missing or using placeholder in .env.local");
        return NextResponse.json({ 
            error: "Authentication required. Please set FAL_KEY in .env.local" 
        }, { status: 401 });
    }
    
    headers.set("Authorization", `Key ${falKey}`);

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
