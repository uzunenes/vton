# 🚀 Firebase Deploy Checklist

## ✅ Tamamlananlar:

1. **Firebase Login** ✅
2. **Proje Seçimi** ✅ (`antigravity-vton-core`)
3. **Firestore Rules** ✅ Deployed
4. **Firestore Database** ✅ Oluşturuldu

---

## ⏳ Şu An Yapılması Gerekenler:

### 1. Firebase Storage'ı Aktifleştir (MANUEL)
   - URL: https://console.firebase.google.com/project/antigravity-vton-core/storage
   - "Get Started" tıkla
   - **Production mode** seç
   - Location: **europe-west3** (Amsterdam)
   - "Done" tıkla

### 2. Storage Rules'ı Deploy Et
```bash
firebase deploy --only storage:rules
```

### 3. Authentication'ı Aktifleştir (MANUEL)
   - URL: https://console.firebase.google.com/project/antigravity-vton-core/authentication
   - "Get Started" tıkla
   - Sign-in methods sekmesi:
     - **Email/Password** → Enable
     - **Google** → Enable (opsiyonel)

### 4. Environment Variables (.env.local)
```bash
cp .env.template .env.local
```

Sonra `.env.local` dosyasını düzenle:

#### Firebase Config (Firebase Console → Project Settings → General)
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=antigravity-vton-core.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=antigravity-vton-core
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=antigravity-vton-core.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=349443708500
NEXT_PUBLIC_FIREBASE_APP_ID=1:349443708500:web:...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-...
```

#### Firebase Admin SDK (Service Account)
- Firebase Console → Project Settings → Service Accounts
- "Generate new private key" → İndir
- JSON'dan al:

```env
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@antigravity-vton-core.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n"
```

#### Stripe Keys
- https://dashboard.stripe.com/apikeys

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

#### FAL.AI Key (Mevcut)
```env
FAL_KEY=mevcut_fal_key_buraya
```

#### App URL
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 📦 5. Functions Deploy (Opsiyonel - şimdilik atla)
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

---

## 🧪 6. Yerel Test
```bash
npm run dev
```

Tarayıcıda: http://localhost:3000

### Test Adımları:
1. Sign Up yapın
2. Email doğrulaması yapın
3. Login olun
4. Dashboard'a gidin
5. VTON denemesi yapın

---

## 🌍 7. Production Deploy (Vercel)

### GitHub'a Push
```bash
git add .
git commit -m "Firebase SaaS integration complete"
git push origin main
```

### Vercel'de Deploy
1. https://vercel.com → Import Project
2. GitHub repo seç
3. Environment Variables ekle (`.env.local` içeriğini kopyala)
4. Deploy!

### Post-Deploy
- [ ] Vercel URL'i Firebase'e authorized domains'e ekle
- [ ] Stripe webhook URL güncelle
- [ ] Production environment variables güncelle

---

## 🔍 Troubleshooting

### Firebase Permission Errors
```bash
firebase deploy --debug
```

### Storage Upload Hataları
- CORS ayarlarını kontrol et
- Storage rules'ı kontrol et

### Authentication Hataları
- Authorized domains kontrol et
- Email verification ayarlarını kontrol et

---

## 📊 Monitoring URLs

- Firebase Console: https://console.firebase.google.com/project/antigravity-vton-core
- Firestore: https://console.firebase.google.com/project/antigravity-vton-core/firestore
- Storage: https://console.firebase.google.com/project/antigravity-vton-core/storage
- Authentication: https://console.firebase.google.com/project/antigravity-vton-core/authentication
- Functions: https://console.firebase.google.com/project/antigravity-vton-core/functions

---

🎉 **Şu an durumu:** Firestore hazır, Storage ve Auth manuel aktifleştirilmesi bekleniyor!
