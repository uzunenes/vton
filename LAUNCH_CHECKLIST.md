# VTON MVP - Launch Checklist

## Pre-Launch (Before Demo)

### Environment Setup
- [ ] `.env.local` has FAL_KEY
  ```bash
  cat .env.local | grep FAL_KEY
  ```
- [ ] `NEXT_PUBLIC_USE_MOCK=false` (real API, not mock)
- [ ] `NEXT_PUBLIC_ENABLE_AB_COMPARISON=true` (show both models)
- [ ] `NEXT_PUBLIC_API_TIMEOUT=120000` (2 minutes for video gen)

### Server Startup
```bash
# Kill any existing processes
pkill -f "next dev" || true

# Clear cache
rm -rf .next

# Start fresh
npm run dev
```

- [ ] Server starts on `http://localhost:3000`
- [ ] No TypeScript errors in logs
- [ ] Homepage loads in browser
- [ ] Check console (F12 → Console) - no red errors

### Browser Prep
- [ ] Chrome, Firefox, or Safari (test on target browser)
- [ ] Full screen mode (F11) for better demo view
- [ ] Close other tabs (reduce memory)
- [ ] Test camera permission once
  - Allow access to camera when prompted
  - Verify it works

### Assets Ready
- [ ] Test garment image (PNG or JPG)
  - Format: Flat-lay or mannequin
  - Size: 512x512 or larger
  - Background: Solid color preferred
- [ ] Webcam/built-in camera working
- [ ] Good lighting in room
- [ ] All 5-6 people gathered

---

## During Demo

### Step 1: Garment Upload (2 min)
- [ ] Homepage loads at "Upload" step
- [ ] Select category (default: Tops)
- [ ] Click upload area
- [ ] Select test garment image
- [ ] Wait for "Ready" badge
- [ ] Button "Open Camera" becomes enabled

### Step 2: Camera Capture (3 min)
- [ ] Click "Open Camera"
- [ ] Browser asks for camera permission → Allow
- [ ] Live feed shows in right panel
- [ ] Stand/position yourself
- [ ] Wait for "Captured" badge
- [ ] See thumbnail in left panel
- [ ] Click "Confirm & Start Try-On"

### Step 3: Pipeline Processing (4 min)
- [ ] Full-screen pipeline overlay appears
- [ ] Status shows current step

**Segmentation (8 sec):**
- [ ] Status: "Segmenting garment..."
- [ ] Completes without error

**VTON (15 sec):**
- [ ] Status: "Awaiting Approval"
- [ ] Two model results visible (FASHN + Leffa)
- [ ] Can select which to approve
- [ ] Click "Approve"

**Video Generation (20 sec):**
- [ ] Status: "Generating runway video..."
- [ ] Takes longest part
- [ ] Completes with final video

### Step 4: Review Results (1 min)
- [ ] Try-on image shows person with garment
- [ ] Video plays (should be ~5 seconds)
- [ ] "Save Image" and "Save Video" buttons work
- [ ] Files appear in `./outputs`

### Step 5: Reset (30 sec)
- [ ] Click "New Try-On"
- [ ] Returns to upload step
- [ ] Ready for second attempt if needed

---

## Troubleshooting During Demo

### Issue: Upload Fails
```
Error appears at top: "Garment upload failed"

Cause: FAL_KEY issue
Fix:
1. Check .env.local has correct FAL_KEY
2. Restart server: Ctrl+C, then npm run dev
3. Refresh browser
```

### Issue: Camera Won't Activate
```
No video stream appears

Cause: Permission denied or hardware issue
Fix:
1. Allow camera permission when prompted
2. Check System Preferences → Security & Privacy
3. Refresh page and try again
```

### Issue: Pipeline Hangs
```
Status shows "Running" but no progress

Cause: API request timeout
Fix:
1. Wait up to 2 minutes
2. If still stuck: Check browser console (F12)
3. May need to increase NEXT_PUBLIC_API_TIMEOUT
```

### Issue: Segmentation Fails
```
Step shows error, can't proceed

Cause: Image quality or background issues
Fix:
1. Try different garment image (cleaner background)
2. Regenerate step
3. Check garment image is large enough (512+px)
```

### Issue: VTON Models Fail (Both)
```
Both FASHN and Leffa error

Cause: User image or body pose issue
Fix:
1. Retake user photo with better pose
2. Ensure full body visible
3. Better lighting helps
```

### Issue: Video Generation Timeout
```
Video step takes >120 seconds or times out

Cause: API latency or timeout too short
Fix:
1. Wait a bit longer (Kling API can be slow)
2. If repeats: Increase NEXT_PUBLIC_API_TIMEOUT=180000
3. Can skip video for demo (just approve image)
```

### Issue: Approval UI Doesn't Appear
```
Pipeline shows result but no buttons

Cause: React state issue or UI bug
Fix:
1. Refresh page (F5)
2. Restart server and reload
```

---

## Post-Demo

### Saving Results
- All outputs auto-save to `./outputs/{sessionId}/`
- Structure:
  ```
  outputs/
  ├── session-id-1/
  │   ├── inputs/
  │   │   ├── garment.jpg
  │   │   └── user.jpg
  │   ├── outputs/
  │   │   ├── segmented-garment.png
  │   │   ├── vton-result-fashn.png
  │   │   ├── vton-result-leffa.png
  │   │   └── video.mp4
  │   └── metadata.json
  ```

### Cleanup
- [ ] Commits are ready to push
- [ ] No uncommitted changes should remain
  ```bash
  git status
  ```
- [ ] Demo feedback captured
- [ ] Performance notes recorded

### Next Steps (For Product Team)
- [ ] Integration with Zara website planned
- [ ] User feedback on A/B comparison collected
- [ ] Video length preferences noted (5s vs 10s)
- [ ] Garment categories that work best identified

---

## Performance Notes

### Expected Timings
```
Garment Upload:        2-5 sec (to FAL storage)
Segmentation:          5-8 sec (SAM2)
VTON Single Model:     8-12 sec (FASHN or Leffa)
VTON A/B Both Models:  10-15 sec (parallel)
Video Generation:      15-25 sec (Kling 2.0)
─────────────────────────────────
Total Pipeline:        35-50 sec
```

### Factors That Affect Speed
- **Network Quality:** Slower internet = longer API calls
- **API Load:** Fal.ai busy = longer waits
- **Model Selection:** Some models faster than others
- **Video Duration:** Longer videos take more time

### How to Optimize
- Use nearby VPN/network if international
- Run demo during off-peak hours (evenings)
- Shorter video duration (5s instead of 10s)
- Single model instead of A/B (faster, but less choice)

---

## Emergency Recovery

### Server Won't Start
```bash
# Kill all node processes
pkill -f node

# Clear build cache
rm -rf .next node_modules

# Reinstall
npm install

# Start
npm run dev
```

### Need to Rollback Code
```bash
# See recent commits
git log --oneline -5

# Revert to last good commit
git reset --hard HEAD~1
```

### Lost Output Files
```bash
# Outputs are auto-saved to ./outputs
ls -la outputs/

# If needed, recreate from session logs
# (Advanced - contact dev team)
```

---

## Quick Links

- **Homepage:** http://localhost:3000
- **Demo Script:** ./DEMO_SCRIPT.md
- **Config:** .env.local
- **Outputs:** ./outputs
- **Logs:** console (F12 → Console)

---

**Ready to launch? Let's go! 🚀**
