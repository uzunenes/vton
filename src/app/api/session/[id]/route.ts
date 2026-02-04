/**
 * Session API Routes
 * Handles session management, logging, and output persistence
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const BASE_OUTPUT_DIR = process.cwd() + '/outputs';

// Ensure directory exists
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Get session directory
function getSessionDir(sessionId: string): string {
  const date = new Date().toISOString().split('T')[0];
  return path.join(BASE_OUTPUT_DIR, date, sessionId);
}

// GET - Get session info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const sessionDir = getSessionDir(sessionId);
  const sessionFile = path.join(sessionDir, 'session.json');

  try {
    if (fs.existsSync(sessionFile)) {
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      return NextResponse.json(sessionData);
    } else {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Failed to get session:', error);
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
  }
}

// POST - Create session or handle sub-routes
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const action = pathParts[pathParts.length - 1];

  // Route to appropriate handler based on action
  // The path will be like /api/session/[id]/logs or /api/session/[id]/output
  // But Next.js catches all at [id], so we need to check the actual URL

  try {
    const body = await request.json();

    // Check if this is a create session request
    if (action === sessionId) {
      return handleCreateSession(sessionId, body);
    }

    // For other actions, check the X-Action header or body.action
    const requestAction = request.headers.get('X-Action') || body.action || 'create';

    switch (requestAction) {
      case 'logs':
        return handleSaveLogs(sessionId, body);
      case 'output':
        return handleSaveOutput(sessionId, body);
      case 'input':
        return handleSaveInput(sessionId, body);
      case 'metadata':
        return handleSaveMetadata(sessionId, body);
      case 'complete':
        return handleCompleteSession(sessionId, body);
      default:
        return handleCreateSession(sessionId, body);
    }
  } catch (error) {
    console.error('Session API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create a new session
async function handleCreateSession(sessionId: string, body: any) {
  const sessionDir = getSessionDir(sessionId);

  // Create directory structure
  ensureDir(path.join(sessionDir, 'inputs'));
  ensureDir(path.join(sessionDir, 'outputs'));
  ensureDir(path.join(sessionDir, 'metadata'));

  // Create session.json
  const session = {
    id: sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active',
    inputs: body.inputs || {},
    outputs: [],
    metadata: {
      garmentCategory: body.garmentCategory,
    },
  };

  fs.writeFileSync(
    path.join(sessionDir, 'session.json'),
    JSON.stringify(session, null, 2)
  );

  // Create empty logs file
  fs.writeFileSync(path.join(sessionDir, 'logs.jsonl'), '');

  return NextResponse.json({
    sessionId,
    createdAt: session.createdAt,
    outputDirectory: sessionDir,
  });
}

// Save logs
async function handleSaveLogs(sessionId: string, body: any) {
  const sessionDir = getSessionDir(sessionId);
  const logsFile = path.join(sessionDir, 'logs.jsonl');

  ensureDir(sessionDir);

  const logs = body.logs || [body];
  const logLines = logs.map((log: any) => JSON.stringify({
    ...log,
    timestamp: log.timestamp || new Date().toISOString(),
  })).join('\n') + '\n';

  fs.appendFileSync(logsFile, logLines);

  return NextResponse.json({ success: true, logsWritten: logs.length });
}

// Save output (download from URL and save locally)
async function handleSaveOutput(sessionId: string, body: any) {
  const { url, type, filename, stepId, modelUsed, variant, metadata } = body;
  const sessionDir = getSessionDir(sessionId);
  const outputsDir = path.join(sessionDir, 'outputs');

  ensureDir(outputsDir);

  try {
    // Download the file from URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const outputPath = path.join(outputsDir, filename);

    fs.writeFileSync(outputPath, buffer);

    // Get file info
    const stats = fs.statSync(outputPath);

    // Update session.json with new output
    const sessionFile = path.join(sessionDir, 'session.json');
    if (fs.existsSync(sessionFile)) {
      const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      session.outputs = session.outputs || [];
      session.outputs.push({
        stepId,
        type,
        filename,
        url,
        localPath: outputPath,
        modelUsed,
        variant,
        savedAt: new Date().toISOString(),
        fileSize: stats.size,
      });
      session.updatedAt = new Date().toISOString();
      fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
    }

    return NextResponse.json({
      success: true,
      localPath: outputPath,
      fileSize: stats.size,
      contentType: type === 'video' ? 'video/mp4' : 'image/png',
    });
  } catch (error) {
    console.error('Failed to save output:', error);
    return NextResponse.json({ error: 'Failed to save output' }, { status: 500 });
  }
}

// Save input (from base64)
async function handleSaveInput(sessionId: string, body: any) {
  const { filename, contentType, data, metadata } = body;
  const sessionDir = getSessionDir(sessionId);
  const inputsDir = path.join(sessionDir, 'inputs');

  ensureDir(inputsDir);

  try {
    // Decode base64 and save
    const buffer = Buffer.from(data, 'base64');
    const inputPath = path.join(inputsDir, filename);

    fs.writeFileSync(inputPath, buffer);

    const stats = fs.statSync(inputPath);

    return NextResponse.json({
      success: true,
      localPath: inputPath,
      fileSize: stats.size,
    });
  } catch (error) {
    console.error('Failed to save input:', error);
    return NextResponse.json({ error: 'Failed to save input' }, { status: 500 });
  }
}

// Save metadata for a step
async function handleSaveMetadata(sessionId: string, body: any) {
  const { stepId, metadata } = body;
  const sessionDir = getSessionDir(sessionId);
  const metadataDir = path.join(sessionDir, 'metadata');

  ensureDir(metadataDir);

  const metadataFile = path.join(metadataDir, `${stepId}.json`);
  fs.writeFileSync(metadataFile, JSON.stringify({
    stepId,
    savedAt: new Date().toISOString(),
    ...metadata,
  }, null, 2));

  return NextResponse.json({ success: true });
}

// Complete session
async function handleCompleteSession(sessionId: string, body: any) {
  const sessionDir = getSessionDir(sessionId);
  const sessionFile = path.join(sessionDir, 'session.json');

  if (fs.existsSync(sessionFile)) {
    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    session.updatedAt = new Date().toISOString();
    session.metadata = {
      ...session.metadata,
      ...body.metadata,
    };
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
  }

  return NextResponse.json({ success: true });
}
