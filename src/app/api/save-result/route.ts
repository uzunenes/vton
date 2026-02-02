import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
    try {
        const { url, type } = await request.json();
        if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch resource");

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        // Include milliseconds for high-precision tracking
        const timeStr = now.toISOString().split('T')[1].replace(/:/g, '-').replace('.', '-').replace('Z', '');

        const dirPath = path.join(process.cwd(), "outputs", dateStr);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const ext = type === "video" ? "mp4" : "png";
        const fileName = `${type}_${timeStr}.${ext}`;
        const filePath = path.join(dirPath, fileName);

        fs.writeFileSync(filePath, buffer);

        console.log(`Saved output: ${filePath}`);
        return NextResponse.json({ success: true, path: filePath });
    } catch (error: any) {
        console.error("Save failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
