# 🚀 VTON SaaS - Kurulum Rehberi

Bu rehber, VTON SaaS platformunuzun sıfırdan nasıl kurulacağını adım adım açıklar.

## 📋 Ön Hazırlık

### Gerekli Hesaplar

1. **Firebase** - https://console.firebase.google.com
   - Yeni bir proje oluşturun
   - Blaze (Pay as you go) planına yükseltin (Cloud Functions için gerekli)

2. **Stripe** - https://dashboard.stripe.com
   - Bir hesap oluşturun veya giriş yapın
   - Test modunda çalışmaya başlayabilirsiniz

3. **FAL.AI** - https://fal.ai
   - Hesap oluşturun
   - API key alın (Dashboard > Keys)

4. **Mixpanel** (Opsiyonel) - https://mixpanel.com
   - Ücretsiz hesap oluşturun
   - Proje oluşturun ve token alın

## 🔧 1. Adım: Yerel Kurulum

### 1.1. Projeyi İndirin
```bash
git clone <repo-url>
cd vton
npm install
```

### 1.2. Environment Variables Ayarlayın
```bash
cp .env.template .env.local
```

`.env.local` dosyasını açın ve aşağıdaki değerleri doldurun.

## 🔥 2. Adım: Firebase Konfigürasyonu

### 2.1. Firebase Projesi Oluşturun

1. https://console.firebase.google.com adresine gidin
2. "Add Project" tıklayın
3. Proje adı girin (örn: `vton-saas-prod`)
4. Google Analytics'i etkinleştirin (önerilir)
5. Projeyi oluşturun

### 2.2. Web App Ekleyin

1. Firebase Console'da Project Overview'a gidin
2. "Add app" > Web (</>) seçin
3. App nickname girin: `VTON Web App`
4. Firebase Hosting'i şimdilik atlayın
5. Verilen Firebase config'i kopyalayın

### 2.3. .env.local'e Firebase Bilgilerini Ekleyin

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:xxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 2.4. Authentication'ı Etkinleştirin

1. Firebase Console > Build > Authentication
2. "Get Started" tıklayın
3. Sign-in method sekmesinde:
   - **Email/Password**: Enable yapın
   - **Google**: Enable yapın (opsiyonel)

### 2.5. Firestore Database Oluşturun

1. Firebase Console > Build > Firestore Database
2. "Create database" tıklayın
3. **Production mode** seçin (güvenlik kurallarını sonra ekleyeceğiz)
4. Location seçin (Europe-west3 tavsiye edilir)

### 2.6. Firebase Storage Etkinleştirin

1. Firebase Console > Build > Storage
2. "Get started" tıklayın
3. Security rules başlangıç modunda oluşturun

### 2.7. Firebase Admin SDK Kurulumu

1. Firebase Console > Project Settings > Service Accounts
2. "Generate new private key" tıklayın
3. JSON dosyasını indirin
4. İçinden şu bilgileri `.env.local`'e ekleyin:

```env
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhki...\n-----END PRIVATE KEY-----\n"
```

**ÖNEMLİ:** `FIREBASE_PRIVATE_KEY` değerini tırnak içinde yazın ve `\n` karakterlerini koruyun.

### 2.8. Firebase CLI ile Deploy

```bash
# Firebase'e giriş yapın
firebase login

# Projenizi seçin
firebase use your-project-id

# Firestore rules'ı deploy edin
firebase deploy --only firestore:rules

# Cloud Functions'ları deploy edin (opsiyonel)
cd functions
npm install
npm run build
firebase deploy --only functions
```

## 💳 3. Adım: Stripe Konfigürasyonu

### 3.1. Stripe Dashboard'da Products Oluşturun

1. https://dashboard.stripe.com/products adresine gidin
2. "Add Product" tıklayın

#### Pro Plan:
- Name: `Pro Plan`
- Description: `100 virtual try-ons per month`
- Pricing: Recurring, Monthly, $29
- "Save product" tıklayın
- **Price ID'yi kopyalayın** (price_xxxxx)

#### Enterprise Plan:
- Name: `Enterprise Plan`
- Description: `Unlimited virtual try-ons`
- Pricing: Recurring, Monthly, $99
- "Save product" tıklayın
- **Price ID'yi kopyalayın**

### 3.2. .env.local'e Stripe Bilgilerini Ekleyin

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# Price IDs
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
```

### 3.3. Stripe CLI Kurulumu (Lokal Test İçin)

```bash
# Stripe CLI'yi yükleyin
# macOS
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_X.X.X_linux_x86_64.tar.gz
tar -xvf stripe_X.X.X_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin

# Giriş yapın
stripe login

# Webhook listener başlatın
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Komut çalıştığında size bir **webhook signing secret** verecek:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

Bunu `.env.local`'e ekleyin:
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 3.4. Production Webhook (Deploy Sonrası)

Deploy ettikten sonra:
1. Stripe Dashboard > Developers > Webhooks
2. "Add endpoint" tıklayın
3. Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Webhook signing secret'ı production `.env`'e ekleyin

## 🤖 4. Adım: FAL.AI Konfigürasyonu

1. https://fal.ai/dashboard/keys adresine gidin
2. "Create new key" tıklayın
3. API key'i kopyalayın
4. `.env.local`'e ekleyin:

```env
FAL_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## 📊 5. Adım: Mixpanel (Opsiyonel)

1. https://mixpanel.com adresine gidin
2. Yeni proje oluşturun
3. Project Settings > Project Token'ı kopyalayın
4. `.env.local`'e ekleyin:

```env
NEXT_PUBLIC_MIXPANEL_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## ▶️ 6. Adım: Uygulamayı Çalıştırın

### Development Mode

Terminal 1:
```bash
npm run dev
```

Terminal 2 (Stripe webhook):
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Tarayıcıda açın: http://localhost:3000

### İlk Kullanıcı Oluşturma

1. http://localhost:3000 adresine gidin
2. "Sign Up" tıklayın
3. Email ve şifre ile kayıt olun
4. Email doğrulaması yapın

## 🚀 7. Adım: Production Deploy

### Vercel'e Deploy

1. GitHub'a push yapın:
```bash
git add .
git commit -m "Production ready"
git push origin main
```

2. https://vercel.com adresine gidin
3. "Import Project" tıklayın
4. GitHub repo'nuzu seçin
5. Environment Variables ekleyin (`.env.local` içeriğini kopyalayın)
6. Deploy!

### Post-Deployment Checklist

- [ ] Vercel URL'i Firebase'e authorized domains'e ekleyin
- [ ] Stripe production webhook URL'i güncelleyin
- [ ] `.env` production değerlerini güncelleyin:
  ```env
  NEXT_PUBLIC_APP_URL=https://yourdomain.com
  NEXT_PUBLIC_SITE_URL=https://yourdomain.com
  NODE_ENV=production
  ```
- [ ] Stripe'ı test modundan live moda geçirin
- [ ] DNS ayarlarını yapın (custom domain için)

## ✅ 8. Adım: Test Edin

### Authentication Test
1. Sign up yapın
2. Logout / Login test edin
3. Password reset test edin
4. Google sign-in test edin (etkinleştirdiyseniz)

### Subscription Test
1. Login yapın
2. Pricing sayfasına gidin
3. Pro plan'a subscribe olun (test card: 4242 4242 4242 4242)
4. Stripe customer portal'ı test edin
5. Dashboard'da subscription durumunu kontrol edin

### VTON Test
1. Virtual try-on sayfasına gidin
2. Model resmi yükleyin
3. Giysi resmi yükleyin
4. Generate edin
5. Sonucu indirin

## 🐛 Troubleshooting

### Firebase Permission Denied
- Firestore rules'ı deploy ettiniz mi? `firebase deploy --only firestore:rules`
- Firebase console'da Authentication etkin mi?

### Stripe Webhook Çalışmıyor
- Webhook secret doğru mu?
- Stripe CLI çalışıyor mu?
- Console'da hata var mı?

### FAL.AI API Error
- API key doğru mu?
- FAL.AI hesabınızda krediniz var mı?
- Rate limit'e takıldınız mı?

### Build Hataları
```bash
# Node modules'ları temizleyin
rm -rf node_modules package-lock.json
npm install

# Next cache'i temizleyin
rm -rf .next

# Tekrar build edin
npm run build
```

## 📚 Ek Kaynaklar

- [FireSaaS Documentation](https://docs.firesaas.dev)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [FAL.AI Documentation](https://fal.ai/docs)
- [Next.js Documentation](https://nextjs.org/docs)

## 🆘 Yardım

Sorun mu yaşıyorsunuz?
- GitHub Issues: [Link]
- Discord: [Link]
- Email: support@yourdomain.com

---

🎉 Tebrikler! VTON SaaS platformunuz hazır!
