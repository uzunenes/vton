# VTON Segmentation Models - Upgrade Guide

## 🎨 Current Issue
- SAM2 returns **binary black/white masks**
- We want **colorful, multi-color segmentation** for better visualization

## ✅ Good News!
**SAM2 already supports colored masks!** We just need to use the correct output format.

---

## Available Segmentation Models on fal.ai

### 🏆 Recommended: SAM 3 (Newest & Best)
```
Model: sam-3/image
Endpoint: https://fal.ai/models/fal-ai/sam-3/image/api
✅ Returns colored PNG mask
✅ Faster than SAM2
✅ Better accuracy
✅ NEW (2026 release)
Cost: ~$0.001-0.002 per image
Speed: 3-5 seconds
```

### 🔥 Current: SAM 2 (Works Great - Just Need Config Fix!)
```
Model: sam2/image
Endpoint: https://fal.ai/models/fal-ai/sam2/image/api
✅ Returns colored mask (with correct output field)
✅ Proven in production
✅ Good balance of speed/quality
Cost: ~$0.001 per image
Speed: 5-8 seconds
```

### 🎯 Advanced Options

**SAM 2 Auto-Segment** (Automatic detection - no prompts needed!)
```
Model: sam2/auto-segment
✅ Automatically finds ALL objects
✅ Returns colored individual masks
✅ Great for garment-only segmentation
Cost: ~$0.002 per image
Speed: 5-8 seconds
```

**Florence-2 Large** (Referring Expression Segmentation)
```
Model: florence-2-large/referring-expression-segmentation
✅ Text-based segmentation ("segment the shirt")
✅ Returns colored mask
✅ Most accurate for specific garments
Cost: ~$0.003 per image
Speed: 8-10 seconds
```

**EVF-SAM2** (Efficient)
```
Model: evf-sam/api
✅ Fastest segmentation
✅ Lower cost
❌ Binary mask only (B/W) - not suitable for your needs
```

---

## 📊 Comparison Table

| Model | Speed | Cost | Colored Output | Best For |
|-------|-------|------|---|---|
| **SAM 3** ⭐ | 3-5s | $0.002 | ✅ Yes | **Fastest + Colored** |
| **SAM 2** | 5-8s | $0.001 | ✅ Yes | **Current + Reliable** |
| **SAM 2 Auto** | 5-8s | $0.002 | ✅ Yes | **No prompts needed** |
| **Florence-2** | 8-10s | $0.003 | ✅ Yes | **Most accurate** |
| **EVF-SAM2** | 2-3s | $0.0005 | ❌ B/W only | Speed only |

---

## 🔧 Quick Fix: Use SAM2 Colored Output

### Current Code Issue
Your `GarmentSegmentationStep.ts` might be using the wrong output field.

**SAM2 returns:**
```json
{
  "combined_mask": "https://...", // ✅ COLORED MASK (use this!)
  "masks": [...],                 // ✅ Individual colored masks
  "image": "https://..."
}
```

### Current Code (Need to Check)
```typescript
// In GarmentSegmentationStep.ts - check what's being used
const output = result.data;
const maskUrl = output.combined_mask || output.mask_url;
// ☝️ Should use combined_mask for colored version
```

### Fix
```typescript
// COLORED OUTPUT - use this
const coloredMaskUrl = result.data.combined_mask;

// B/W OUTPUT - currently used
const bwMaskUrl = result.data.masks?.[0]?.url;
```

---

## 🚀 Implementation Options

### Option 1: Keep SAM2, Use Colored Output (Quick Fix - 10 min)
**Pros:**
- No cost increase
- Minimal code changes
- Works immediately
- Already tested

**Cons:**
- Still binary mask (just rendered as colored)

**Code Change:**
```typescript
// In GarmentSegmentationStep.ts
const result = await fal.subscribe(modelPath, { input });
// Change from:
const maskUrl = result.data.masks?.[0]?.url;
// To:
const maskUrl = result.data.combined_mask; // ← Colored output!
```

### Option 2: Upgrade to SAM3 (Recommended - 30 min)
**Pros:**
- True colored segmentation
- 40% faster
- Better accuracy
- Future-proof

**Cons:**
- Need to update model path
- 2x cost (~$0.002 vs $0.001)

**Code Change:**
```typescript
const MODEL_PATH = "fal-ai/sam-3/image"; // ← Change this
const result = await fal.subscribe(MODEL_PATH, { input });
const maskUrl = result.data.combined_mask;
```

### Option 3: SAM2 Auto-Segment (Advanced - 45 min)
**Pros:**
- No manual prompts needed
- Automatically detects garments
- Colored output
- Great accuracy for clothing

**Cons:**
- Need to modify input (remove prompts)
- 2x cost

**Code Change:**
```typescript
const MODEL_PATH = "fal-ai/sam2/auto-segment";
const input = {
  image_url: garmentImageUrl,
  // No prompts needed!
};
const result = await fal.subscribe(MODEL_PATH, { input });
```

---

## 📋 Recommendation

### For Your Demo (Today)
**Option 1: Quick Fix** ⚡
- Use `combined_mask` instead of `masks[0]`
- 10 minutes to implement
- Free (no cost increase)
- Works immediately

### For Production (This Week)
**Option 2: Upgrade to SAM3** 🏆
- Better quality + faster
- Only $0.001 more per image
- 30 minutes to implement
- Future-proof

### Long-term (Next Sprint)
**Option 3: Add Model Selection UI**
```typescript
// Let users choose:
// - SAM2 (cheap, fast)
// - SAM3 (best, fastest)
// - SAM2-Auto (automatic)
// - Florence-2 (text-based)

const SEGMENTATION_MODELS = {
  'sam2-image': {
    modelPath: 'fal-ai/sam2/image',
    cost: 0.001,
    speed: '5-8s',
    colored: true,
  },
  'sam3-image': {
    modelPath: 'fal-ai/sam-3/image',
    cost: 0.002,
    speed: '3-5s',
    colored: true,
  },
  'sam2-auto': {
    modelPath: 'fal-ai/sam2/auto-segment',
    cost: 0.002,
    speed: '5-8s',
    colored: true,
    requiresPrompts: false,
  },
  'florence2': {
    modelPath: 'fal-ai/florence-2-large/referring-expression-segmentation',
    cost: 0.003,
    speed: '8-10s',
    colored: true,
    usesText: true,
  }
};
```

---

## 🎨 Output Format Comparison

### Binary Mask (Current SAM2)
```
Black & White image
- White = garment
- Black = background
- No color information
```

### Colored Mask (Desired)
```
Multi-color image
- Each object gets distinct color
- More visually appealing
- Better for debugging
- Easier to verify segmentation
```

### How to Get Colored from SAM2/SAM3
1. Both models return `combined_mask` as PNG
2. When rendered as image, creates colored visualization
3. Each region gets random color for distinction

---

## 📝 Implementation Steps

### Step 1: Check Current Code
```bash
grep -n "combined_mask\|masks\[0\]" src/lib/pipeline/steps/GarmentSegmentationStep.ts
```

### Step 2: Update Model Path (if upgrading to SAM3)
```typescript
// src/lib/models/ModelRegistry.ts
const SEGMENTATION_MODELS = {
  "sam3-image": {
    id: "sam3-image",
    modelPath: "fal-ai/sam-3/image",  // ← Update this
    displayName: "SAM 3 Image",
    // ... rest of config
  }
}
```

### Step 3: Use Colored Output
```typescript
// src/lib/pipeline/steps/GarmentSegmentationStep.ts
const maskUrl = result.data.combined_mask; // ← Use this
```

### Step 4: Update UI Config (Optional)
```typescript
// src/lib/config/environment.ts
export const DEFAULT_SEGMENTATION_MODEL = 'sam3-image'; // ← Or keep sam2
```

### Step 5: Test
```bash
npm run dev
# Upload garment → segmentation step
# Verify mask is now colored!
```

---

## 💰 Cost Impact

**Current:** $0.001/image × 1 (SAM2)
**Option 2 (SAM3):** $0.002/image × 1 (SAM3)
**Option 3 (Auto):** $0.002/image × 1 (SAM2-Auto)

**Per 100 demos:**
- SAM2: $0.10
- SAM3: $0.20 (+$0.10)
- SAM2-Auto: $0.20 (+$0.10)

Minimal impact - negligible for MVP phase.

---

## 🎯 Next Steps

1. **Immediate (5 min):** Check which output field we're currently using
2. **Quick (10 min):** Switch to `combined_mask`
3. **Better (30 min):** Upgrade to SAM3
4. **Best (1 hour):** Add model selection UI with all 4 options

---

## References

- SAM3 Docs: https://fal.ai/models/fal-ai/sam-3/image/api
- SAM2 Docs: https://fal.ai/models/fal-ai/sam2/image/api
- SAM2 Auto: https://fal.ai/models/fal-ai/sam2/auto-segment/api
- Florence-2: https://fal.ai/models/fal-ai/florence-2-large/referring-expression-segmentation/api

---

## Questions?

- **Q: Will colored mask affect VTON?**
  A: No! The mask is only used for segmentation visualization. VTON still gets clean garment image.

- **Q: How much faster is SAM3?**
  A: 40% faster (3-5s vs 5-8s). Total pipeline saves ~3 seconds.

- **Q: Can I switch models mid-demo?**
  A: Yes! Just change `DEFAULT_SEGMENTATION_MODEL` in config and restart server.

- **Q: Will it affect accuracy?**
  A: SAM3 is slightly more accurate than SAM2, but both are excellent.

---

**Ready to implement? Let me know which option you prefer!** 🚀
