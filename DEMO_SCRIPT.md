# VTON MVP - 5-6 Person Demo Script (10 minutes)

## Pre-Demo Checklist
- [ ] Dev server running: `npm run dev` on port 3000
- [ ] FAL_KEY in `.env.local` ✅
- [ ] Test garment image ready (flat-lay or mannequin)
- [ ] Device with camera/webcam ready
- [ ] All 5-6 people gathered around screen

---

## Demo Flow (10 minutes)

### **1. Introduction (1 min)**
```
"We're showing VTON - Virtual Try-On. 
It's an AI pipeline that takes a garment photo and a person,
then generates a realistic try-on image and runway video.

Three steps:
1. Upload garment
2. Capture your pose
3. AI does the magic - we get results in ~30 seconds
"
```

### **2. Garment Upload (2 min)**

**Action:**
- Go to homepage (should be at "Upload" step)
- Show category buttons (Tops, Bottoms, One-Piece, Accessory)
- Click "Tops" if not already selected
- Click upload area → select test garment image

**Expected Outcome:**
```
✅ Image preview appears
✅ "Uploading..." badge shows (2-5 seconds)
✅ "Ready" badge (green check) appears
✅ "Open Camera" button enables
```

**If Upload Fails:**
- Check FAL_KEY in `.env.local`
- Check browser console for errors (F12 → Console)
- Error message should appear at top: "Garment upload failed..."

**Talking Points:**
```
"This image gets uploaded to FAL.ai's storage.
We'll use it to run the VTON models.
Notice the skeleton overlay - that's pose detection."
```

---

### **3. Camera Capture (3 min)**

**Action:**
- Click "Open Camera" button
- Flow transitions to camera step
- Show garment thumbnail on left
- Live video feed on right
- Point camera at yourself, match the garment pose

**Expected Outcome:**
```
✅ Webcam stream shows in real-time
✅ MediaPipe pose landmarks detected (skeleton drawn on canvas)
✅ When pose is stable, "Captured" badge appears
✅ Thumbnail shows your captured image below
```

**If Camera Permission Denied:**
- Browser should ask for camera permission first
- Click "Allow" when prompted
- If denied → reload page, try again

**If Pose Not Detecting:**
- Make sure enough of your body is visible
- Better lighting helps
- Skeleton should draw on live feed

**Talking Points:**
```
"MediaPipe tracks 33 body landmarks in real-time.
The pipeline uses your pose to align the garment properly.
Once locked in, we auto-capture. Or click the shutter button."
```

---

### **4. Start Pipeline (0.5 min)**

**Action:**
- Once image captured, see "Confirm & Start Try-On" button
- Click it
- UI transitions to "Processing" step

**Expected Outcome:**
```
✅ Full-screen pipeline appears
✅ Progress bar shows "Segmentation" step running
✅ Floating status bar at top shows current step
```

**Talking Points:**
```
"Now the pipeline runs through 3 AI steps:
1. Segmentation - remove background from garment
2. Virtual Try-On - apply garment to your body
3. Video Generation - create runway video

Total time: ~30-40 seconds"
```

---

### **5. Monitor Pipeline (3-4 min)**

**Step A: Segmentation (5-8 seconds)**
```
Status: "Running"
Message: "Segmenting garment..."

Expected:
✅ Completes quickly with segmented image
```

**Step B: Virtual Try-On (10-15 seconds)**
```
Status: "Awaiting Approval"
Message: Shows try-on result image
A/B Models: FASHN v1.6 vs Leffa

Expected:
✅ Two model results shown
✅ User can select which looks better
✅ Approval panel appears with buttons:
   - Approve (green) → continue to video
   - Regenerate (yellow) → retry this step
   - Reject (red) → stop pipeline
```

**Interaction:**
- Show both FASHN and Leffa results
- Talk about model differences
- Click "Approve" to proceed

**Talking Points:**
```
"We run TWO models in parallel:
- FASHN v1.6: Fast, realistic
- Leffa: High quality, may be slower

You get to choose! This is A/B testing at the API level.
Notice how different each model handles the garment fit."
```

---

**Step C: Video Generation (15-20 seconds)**
```
Status: "Running"
Message: "Generating runway video..."

Expected:
✅ Takes longer (video generation is expensive)
✅ Final status: "Completed"
✅ Result image and video displayed in right panel
```

---

### **6. Review Results (1 min)**

**Action:**
- Scroll or view final result
- If video generated: play it
- Show "Save Image" and "Save Video" buttons

**Expected Outcome:**
```
✅ Try-on image shows person wearing the garment
✅ Video shows runway walk with garment
✅ Download buttons work
```

**Talking Points:**
```
"This is the final result.
The AI:
- Removed background from garment
- Applied it to your body with correct pose
- Generated a 5-second runway video

All done in ~40 seconds!
"
```

---

### **7. Save & Reset (0.5 min)**

**Action:**
- Click "Save Image" button (or "Save Video")
- Button changes to "Saved to Disk!"
- Click "New Try-On" to start over

**Expected Outcome:**
```
✅ Files saved to ./outputs directory
✅ Reset clears all state
✅ Back to upload step
```

---

## Troubleshooting Guide

### **Upload Fails**
```
❌ Error: "Garment upload failed"
✅ Solution: Check FAL_KEY in .env.local
```

### **Camera Permission Denied**
```
❌ Camera won't activate
✅ Solution: Browser settings → Allow camera for localhost
```

### **Pipeline Hangs**
```
❌ Status stuck on "Running"
✅ Solution: Wait up to 2 minutes (video gen is slow)
```

### **Segmentation Fails**
```
❌ Step completes but with error
✅ Solution: May need better garment image (solid background helps)
```

### **VTON Models Fail**
```
❌ Both FASHN and Leffa error
✅ Solution: Check user image quality, try different pose
```

### **Video Generation Timeout**
```
❌ Video step takes >90 seconds or errors
✅ Solution: May need to increase API timeout in .env.local
            NEXT_PUBLIC_API_TIMEOUT=180000
```

---

## Demo Notes

### Best Practices
- **Good Garment Images:** Flat-lay, solid background, clear edges
- **Good Poses:** Stand straight, arms at sides, full body visible
- **Good Lighting:** Well-lit room (helps pose detection)
- **Good Connection:** Stable internet (API calls take bandwidth)

### Quick Recovery
- If pipeline fails: Click "Retry" button in approval panel
- If need to start over: Click "New Try-On" or reset in footer
- If server crashes: `npm run dev` in terminal, refresh browser

### Key Metrics (Show During Demo)
- **Garment Upload:** 2-5 seconds
- **Segmentation:** 5-8 seconds
- **VTON (Single Model):** 8-12 seconds
- **VTON (A/B Both Models):** 10-15 seconds
- **Video Generation:** 15-25 seconds
- **Total Pipeline:** 35-50 seconds

---

## Talking Points (Key Concepts)

### What Makes This Special
```
1. Real API: Not fake/mock - using actual fal.ai models
2. A/B Testing: Compare multiple VTON models in real-time
3. Approval Gates: User controls flow at each critical step
4. Runway Video: Goes beyond static image → dynamic video
5. Clean UI: Modern, responsive design
```

### Technical Highlights
```
- MediaPipe for pose detection (33 landmarks, real-time)
- SAM2 for semantic segmentation (remove garment background)
- FASHN v1.6 & Leffa for virtual try-on
- Kling 2.0 for video generation
- Circuit breaker + retry logic for resilience
```

### Q&A Prep

**Q: How long does the whole process take?**
A: 35-50 seconds total. Mostly waiting for AI models to process.

**Q: Can we try on multiple garments?**
A: Yes! Click "New Try-On" to upload another garment.

**Q: What if the fit doesn't look right?**
A: Use "Regenerate" to retry, or try different user pose.

**Q: Can we use real products?**
A: Absolutely! Any garment photo works. Needs clear edges.

**Q: What about different categories (pants, dresses)?**
A: All supported. Select category before upload.

---

## Post-Demo

- Save outputs to `./outputs` directory (timestamped by session)
- All results include input images, output images, video, logs
- Ready for integration with Zara website or app

---

**Good luck! You've got this. 🚀**
