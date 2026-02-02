import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { message, level = "INFO", data } = body;

        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] ${message} ${data ? JSON.stringify(data) : ''}\n`;

        const logFilePath = path.join(process.cwd(), "debug-vton.log");

        // Append to file
        fs.appendFileSync(logFilePath, logLine);

        // Also log to console so it shows in terminal
        console.log(logLine.trim());

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to write log", error);
        return NextResponse.json({ error: "Failed to log" }, { status: 500 });
    }
}
