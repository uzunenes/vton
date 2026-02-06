# VTON MVP - Quick Start Guide

## 30-Second Setup

```bash
# 1. Navigate to project
cd /home/uzunenes/Documents/GitHub/vton

# 2. Start dev server (kills old processes first)
pkill -f "next dev" || true
npm run dev

# 3. Open browser
# http://localhost:3000
```

That's it! You're running.

---

## What You'll See

```
┌─────────────────────────────────────────┐
│         VTON - Virtual Try-On           │
├─────────────────────────────────────────┤
│                                         │
│  Pick a Look                            │
│  Try It On.                             │
│                                         │
│  [Upload Garment Image Area]            │
│                                         │
│  Category: [👕 Tops] [👖 Bottoms] ... │
│                                         │
│  [Status: No Garment]                   │
│                                         │
└─────────────────────────────────────────┘
```

---

## The Flow (3 Steps)

### Step 1: Upload Garment (2 min)
1. Click upload area
2. Select a garment photo (PNG/JPG)
3. Wait for "Ready" badge
4. Click "Open Camera"

### Step 2: Capture You (2 min)
1. Allow camera permission
2. Position yourself to match garment pose
3. Auto-captures when stable
4. Click "Confirm & Start Try-On"

### Step 3: Pipeline (3-4 min)
1. **Segmentation** (8 sec) - Remove garment background
2. **VTON** (15 sec) - Apply garment to your body
   - See both FASHN v1.6 and Leffa models
   - Approve which one you like
3. **Video** (20 sec) - Generate runway video

---

## Result

You'll see:
- ✅ Try-on image (person wearing garment)
- ✅ Runway video (5 seconds)
- ✅ Save buttons (download to disk)

---

## Keyboard Shortcuts

| Action | Key |
|--------|-----|
| Fullscreen | F11 |
| Browser Console | F12 |
| Refresh | Ctrl+R / Cmd+R |
| Hard Refresh | Ctrl+Shift+R / Cmd+Shift+R |

---

## Common Tasks

### Check Server Status
```bash
ps aux | grep "next dev"
```

### View Saved Outputs
```bash
ls -la outputs/
```

### Check Environment Variables
```bash
cat .env.local
```

### View Error Logs
```bash
# Browser console (F12 → Console tab)
# Look for red error messages
```

### Restart Everything
```bash
pkill -f "next dev" || true
rm -rf .next
npm run dev
```

---

## Troubleshooting Cheat Sheet

| Problem | Solution |
|---------|----------|
| Server won't start | `pkill -f node && npm run dev` |
| Port 3000 in use | Server uses 3001 automatically, or kill process |
| Camera permission denied | Check browser settings → Allow camera |
| Upload fails | Check FAL_KEY in `.env.local` |
| Pipeline hangs | Wait 2 min, check console (F12), may be API load |
| Garment not detected | Try different garment image, cleaner background |

---

## Important Environment Variables

```
FAL_KEY                      - API key (required)
NEXT_PUBLIC_USE_MOCK         - false = real API, true = mock
NEXT_PUBLIC_ENABLE_AB_COMPARISON - true = show both models
NEXT_PUBLIC_API_TIMEOUT      - milliseconds (120000 = 2 min)
NEXT_PUBLIC_VIDEO_DURATION   - 5 or 10 seconds
```

---

## Files to Know

| File | Purpose |
|------|---------|
| `.env.local` | Configuration (FAL_KEY, settings) |
| `src/app/page.tsx` | Main UI (upload → camera → result) |
| `src/hooks/usePipeline.ts` | Pipeline state management |
| `src/lib/pipeline/PipelineOrchestrator.ts` | Step execution controller |
| `outputs/` | Auto-saved results (images, videos, logs) |

---

## Full Documentation

- **Demo Script:** `./DEMO_SCRIPT.md` (10-min walkthrough)
- **Launch Checklist:** `./LAUNCH_CHECKLIST.md` (pre-demo setup)
- **API Integration:** `./fal.ai.md` (API docs)

---

## Support

### Check Logs
```bash
# Browser console
Open DevTools: F12
Tab: Console
Look for error messages in red
```

### Check Network
```bash
# Browser Network tab
F12 → Network
Reload page
Look for failed requests (red) to fal.ai endpoints
```

### Restart Clean
```bash
# Nuclear option (works 99% of the time)
pkill -f next
rm -rf .next
npm install
npm run dev
```

---

**Good luck! You've got this. 🚀**

For detailed walkthrough, see `DEMO_SCRIPT.md`
