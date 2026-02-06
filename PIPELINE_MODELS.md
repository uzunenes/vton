# 🎬 VTON Pipeline - Kullanılan Modeller Rehberi

## 📋 Pipeline Akışı

```
1️⃣ Kıyafet Görüntüsü
    ↓
2️⃣ SAM3 Segmentasyonu (Renkli Maske)
    ↓
3️⃣ İnsan Fotoğrafı
    ↓
4️⃣ VTON (Virtual Try-On) - FASHN v1.6 + Leffa (A/B Karşılaştırması)
    ↓
5️⃣ Kling 2.0 Master (Video Oluşturma)
    ↓
6️⃣ Final Video Çıktısı
```

---

## 🔧 Her Adımda Kullanılan Modeller

### **ADIM 1: Segmentasyon** ✅ (YENİ - SAM3)

**Model:** SAM3 Image (Segment Anything Model 3)
- **Sağlayıcı:** Meta AI (fal.ai)
- **Endpoint:** `fal-ai/sam-3/image`
- **Amaç:** Kıyafet resminden arka planı çıkarma
- **Giriş:** Kıyafet görüntüsü
- **Çıktı:** Renkli segmentasyon maskesi
- **Hız:** 50ms (~100x daha hızlı SAM2'den)
- **Doğruluk:** 2x daha iyi SAM2'den
- **Maliyet:** $0.005 per görüntü
- **Özellikler:**
  - ✅ Nokta tabanlı segmentasyon
  - ✅ Kutu tabanlı segmentasyon
  - ✅ Metin komutları (yeni - "kırmızı gömleği segmente et")
  - ✅ Renkli çıktı garantili

**Yardımcı:** SAM2-Auto (otomatik, prompt yok) - alternatif seçenek

---

### **ADIM 2: Virtual Try-On (VTON)** 👕

**Kullanılan Modeller:** İki model paralel olarak çalışır (A/B Comparison)

#### **Model 1: FASHN v1.6** ⭐ (Birincil)

- **Sağlayıcı:** FASHN (fal.ai)
- **Endpoint:** `fal-ai/fashn/tryon/v1.6`
- **Amaç:** Yüksek doğrulukta kıyafet deneme
- **Giriş:** 
  - İnsan fotoğrafı
  - Segmentasyonlu kıyafet görüntüsü
  - Kıyafet kategorisi (üst, alt, tam vücut)
- **Çıktı:** Try-on sonuç görüntüsü
- **Hız:** 15 saniye ortalama
- **Maliyet:** $0.05 per çalıştırma
- **Maksimum Çözünürlük:** 864x1296 piksel
- **Özellikler:**
  - ✅ Metin ve desen baskısında mükemmel
  - ✅ İnpainting maskesi destekli
  - ✅ Vücut ayarlaması yapabiliyor
  - ✅ Kıyafet restore edebiliyor

**Desteklenen Kıyafet Türleri:**
- Upper body (gömlekler, ceketler, kazaklar)
- Lower body (pantolonlar, etekler, şortlar)
- Full body (elbiseler, tulum)

---

#### **Model 2: Leffa VTON** (İkincil - A/B Karşılaştırması)

- **Sağlayıcı:** Leffa (fal.ai)
- **Endpoint:** `fal-ai/leffa/virtual-tryon`
- **Amaç:** Ticari kalite sanal deneme
- **Giriş:**
  - İnsan fotoğrafı
  - Segmentasyonlu kıyafet görüntüsü
  - Kıyafet kategorisi
  - Inference step sayısı (kalite/hız dengesi)
- **Çıktı:** Try-on sonuç görüntüsü
- **Hız:** 12 saniye ortalama
- **Maliyet:** $0.04 per çalıştırma
- **Maksimum Çözünürlük:** 1024x1024 piksel
- **Özellikler:**
  - ✅ Inference step kontrolü (hız optimize)
  - ✅ Ticari kalite sonuçlar
  - ✅ Tüm vücut türleri
  - ⚠️ İnpainting maskesi desteklenmiyor

**Desteklenen Kıyafet Türleri:**
- Upper body (üst giysileri)
- Lower body (alt giysileri)
- Full body (tam vücut)

---

#### **Model 3: IDM-VTON** (Legacy - Yedek)

- **Sağlayıcı:** IDM-VTON (fal.ai)
- **Endpoint:** `fal-ai/idm-vton`
- **Durum:** ⚠️ ESKİ - Yedek olarak var, kullanılmıyor
- **Hız:** 20 saniye
- **Maliyet:** $0.03 per çalıştırma
- **Not:** FASHN v1.6 ve Leffa tarafından değiştirildi

---

### **ADIM 3: Video Oluşturma** 🎥

**Model:** Kling 2.0 Master (Birincil)

- **Sağlayıcı:** Kuaishou Kling (fal.ai)
- **Endpoint:** `fal-ai/kling-video/v2/master/image-to-video`
- **Amaç:** VTON sonucundan video pist oluşturma
- **Giriş:** 
  - VTON try-on görüntüsü
  - Moda pisti açıklaması
  - Video süresi (5 veya 10 saniye)
  - CFG Scale (kalite kontrolü)
  - Negatif prompt
- **Çıktı:** MP4 format video
- **Hız:** 120 saniye (2 dakika)
- **Maliyet:** $1.0 per video ⚠️ (En pahalı adım)
- **Desteklenen Süreler:** 5s, 10s
- **Desteklenen Çözünürlükler:** 720p, 1080p
- **Özellikler:**
  - ✅ Premium kalite moda videoları
  - ✅ Doğal hareket
  - ✅ Fashion runway stilleri
  - ✅ Image-to-video (foto → video)
  - ❌ Text-to-video desteklenmiyor

**Alternativler (Backup):**

**MiniMax Hailuo** (Faster)
- Endpoint: `fal-ai/minimax/video-01-live/image-to-video`
- Hız: 90 saniye (30s daha hızlı!)
- Maliyet: $0.5 (50% daha ucuz)
- Çözünürlük: 720p max
- Süreler: Sadece 5 saniye
- ✅ Image-to-video ve Text-to-video

**Grok Video** (Legacy)
- Endpoint: `xai/grok-imagine-video/text-to-video`
- Maliyet: $0.3
- Durum: ⚠️ Eski, yedek olarak var

---

## 📊 Modeller Karşılaştırma Tablosu

### **Segmentasyon Modelleri**

| Model | Sağlayıcı | Hız | Doğruluk | Renkli | Maliyet | Metin |
|-------|-----------|-----|----------|--------|---------|-------|
| **SAM3** ⭐ | Meta AI | 50ms | 2x iyi | ✅ | $0.005 | ✅ |
| SAM2-Auto | Meta AI | 8s | İyi | ✅ | $0.002 | ❌ |
| SAM2 (Eski) | Meta AI | 5-8s | İyi | Kısmi | $0.002 | ❌ |

---

### **VTON Modelleri (Virtual Try-On)**

| Model | Hız | Maliyet | Max Çözün. | Metin/Desen | Mask | Rank |
|-------|-----|---------|-----------|------------|------|------|
| **FASHN v1.6** ⭐ | 15s | $0.05 | 864x1296 | ✅ Mükemmel | ✅ | 1️⃣ |
| **Leffa** ⭐ | 12s | $0.04 | 1024x1024 | ✅ İyi | ❌ | 2️⃣ |
| IDM-VTON | 20s | $0.03 | 768x1024 | ✅ | ✅ | 3️⃣ |

---

### **Video Modelleri**

| Model | Hız | Maliyet | Kalite | Max Çözün. | Süreler | Rank |
|-------|-----|---------|--------|-----------|---------|------|
| **Kling 2.0** ⭐ | 120s | $1.0 | 🏆 Premium | 1080p | 5s, 10s | 1️⃣ |
| MiniMax Hailuo | 90s | $0.5 | 👍 İyi | 720p | 5s | 2️⃣ |
| Grok Video | - | $0.3 | 👎 Eski | 720p | 6s | 3️⃣ |

---

## 💰 Maliyet Analizi

### **Tek Demo İçin (1 kişi = 1 kıyafet)**

| Adım | Model | Birim Maliyet |
|------|-------|---------------|
| Segmentasyon | SAM3 | $0.005 |
| VTON 1 | FASHN v1.6 | $0.05 |
| VTON 2 | Leffa | $0.04 |
| Video | Kling 2.0 | $1.0 |
| **TOPLAM** | - | **$1.095** |

### **100 Demo Çalıştırma**

- **Segmentasyon:** 0.005 × 100 = **$0.50**
- **VTON (her ikisi):** (0.05 + 0.04) × 100 = **$9.00**
- **Video:** 1.0 × 100 = **$100.00**
- **TOPLAM:** **$109.50**
- **Kişi Başı:** $1.095

⚠️ **Video en pahalı adım!** Toplam maliyetin %92'sini oluşturuyor.

---

## 🚀 Optimizasyon Fırsatları

### **1. Video Maliyetini Azalt**

**Seçenek A: MiniMax Hailuo'ya Geç**
- Tasarruf: 90 saniye hızlanma + %50 maliyet azalması
- Dezavantaj: 720p max, daha düşük kalite
- Potansiyel Tasarruf: 100 demo = $50

**Seçenek B: Video Opsiyonel Yap**
- Yalnızca onaylanan demolar için video oluştur
- Demo sayısını %30 azalt = $30 tasarruf (100 demoda)

**Seçenek C: Video Batch İşleme**
- Aynı giysi için 3+ video toplu oluştur
- Video fiyatı paylaş

### **2. VTON Optimizasyonu**

**Seçenek A: Tek Model Kullan**
- Leffa'yı seç (12s, $0.04, en ucuz)
- Tasarruf: $9 per 100 demo
- Dezavantaj: Daha düşük kalite

**Seçenek B: Adaptive Selection**
- Metin/desen varsa FASHN (iyi)
- Basit renkli kıyafet için Leffa (hızlı)

### **3. Segmentasyon Optimizasyonu**

**Seçenek A: SAM2-Auto Kullan**
- 100x daha hızlı (otomatik)
- %60 daha ucuz ($0.002)
- Tasarruf: minimal
- Dezavantaj: Daha az kontrol

---

## 🎯 Önerileri Pipeline Ayarı

### **Hızlı Demo (Ekonomik)**
```
SAM3 → Leffa → MiniMax → ~30 saniye, $0.595/demo
```

### **Kalite Demo (Standart)** ⭐ CURRENT
```
SAM3 → FASHN v1.6 + Leffa → Kling 2.0 → ~2 dakika, $1.095/demo
```

### **Premium Demo (Professional)**
```
SAM3 → FASHN v1.6 → Kling 2.0 (1080p) → ~2.5 dakika, $1.055/demo
```

---

## 📈 Gelecekte Yapılabilecek Iyileştirmeler

### **Kısa Vadeli (Bu Ay)**
- [ ] MiniMax Hailuo'yu test et (hız/maliyet)
- [ ] Video kalitesi karşılaştırması yap
- [ ] Batch video işlemesi ekle

### **Orta Vadeli (Bu Çeyrek)**
- [ ] Metin prompt tabanlı VTON seçimi ekle
- [ ] Model seçim arayüzü (kullanıcı seçer)
- [ ] Maliyet dashboard (real-time izleme)

### **Uzun Vadeli (Gelecek)**
- [ ] Yeni modeller (2026'da çıkanlar)
- [ ] Custom VTON modeleri (ince ayar)
- [ ] Lokal video generation (maliyet = 0)
- [ ] AI tabanlı model seçimi (otomatik)

---

## 🔍 Model Detay Bilgileri

### **SAM3 Segmentasyonu**

**Giriş Parametreleri:**
```typescript
{
  image_url: string;           // Kıyafet görüntüsü
  prompts: [{x, y, label}]?;  // İsteğe bağlı nokta
  text_prompt?: string;        // Yeni! "kırmızı gömlek"
  apply_mask: boolean;         // Maske uygula
}
```

**Çıktı Parametreleri:**
```typescript
{
  combined_mask: { url: string };    // ✅ Renkli maske
  masks: Array<{ url: string }>;     // B/W maskeler
  bounding_boxes: Array<{...}>;      // Yeni! Kutu koordinatları
  confidence_scores: Array<number>;  // Güven seviyeleri
}
```

---

### **FASHN v1.6 VTON**

**Giriş Parametreleri:**
```typescript
{
  model_image: string;          // İnsan fotoğrafı
  garment_image: string;        // Segmentlenmış kıyafet
  category: string;             // "upper_body" | "lower_body" | "full_body"
  adjust_body?: boolean;        // Vücut ayarla
  restore_clothes?: boolean;    // Kıyafet restore et
}
```

**Çıktı Parametreleri:**
```typescript
{
  image: {
    url: string;     // Try-on görüntüsü
    width: number;   // 864
    height: number;  // 1296
  }
}
```

---

### **Kling 2.0 Master Video**

**Giriş Parametreleri:**
```typescript
{
  image_url: string;           // VTON sonucu
  prompt: string;              // "Model elegan hareket yapıyor"
  duration: number;            // 5 | 10 saniye
  cfg_scale?: number;          // 7.5 (yaratıcılık)
  negative_prompt?: string;    // Neler olmamalı
}
```

**Çıktı Parametreleri:**
```typescript
{
  video: {
    url: string;       // MP4 video linki
    duration: number;  // Saniye cinsinden
  }
}
```

---

## ✅ Şu Anda Kurulu olan Modeller

### **Aktif (Kullanım):**
- ✅ SAM3 Image - Segmentasyon
- ✅ FASHN v1.6 - VTON Birincil
- ✅ Leffa - VTON İkincil (A/B)
- ✅ Kling 2.0 Master - Video Oluşturma

### **Backup/Alternatif:**
- ⏸️ SAM2-Auto - Otomatik segmentasyon
- ⏸️ MiniMax Hailuo - Hızlı video
- ⏸️ Grok Video - Legacy video
- ⏸️ IDM-VTON - Legacy VTON

---

## 🎬 Pipeline State Örneği

```json
{
  "pipelineId": "demo-001",
  "status": "completed",
  "steps": {
    "segmentation": {
      "status": "completed",
      "model": "sam3-image",
      "duration": 0.05,
      "cost": 0.005,
      "output": "https://fal.io/segmented-mask.png"
    },
    "virtual-tryon": {
      "status": "completed",
      "models": {
        "fashn-v1.6": {
          "duration": 15,
          "cost": 0.05,
          "output": "https://fal.io/tryon-fashn.png"
        },
        "leffa": {
          "duration": 12,
          "cost": 0.04,
          "output": "https://fal.io/tryon-leffa.png"
        }
      },
      "selectedVariant": "fashn-v1.6"
    },
    "video-generation": {
      "status": "completed",
      "model": "kling-2.0-master",
      "duration": 120,
      "cost": 1.0,
      "output": "https://fal.io/video.mp4"
    }
  },
  "totalCost": 1.095,
  "totalDuration": 135
}
```

---

## 📞 Hızlı Referans

**En Hızlı Demo:**
- SAM3 (50ms) + Leffa (12s) + MiniMax (90s) = 102 saniye

**En Kaliteli Demo:**
- SAM3 (50ms) + FASHN (15s) + Kling 1080p (120s) = 135 saniye

**En Ucuz Demo:**
- SAM2-Auto (8s) + Leffa (12s) + MiniMax (90s) = 110 saniye, $0.535

**Şu Anda Kullanılan:**
- SAM3 (50ms) + FASHN + Leffa (A/B) + Kling (120s) = 135-145 saniye, $1.095

---

**Sorularınız varsa veya bir model değiştirmek isterseniz, yalnızca ilgili dosyaları güncelleyebilirim!** 🚀
