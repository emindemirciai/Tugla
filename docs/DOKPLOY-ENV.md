# Dokploy ortam değişkenleri

Dağıtımın çalışması için Dokploy → **Environment** alanında bulunması gereken en
küçük küme budur. Eksik olan her biri artık dağıtımı **adıyla birlikte**
reddeder; eskiden imajlar derleniyor, sonra konteynerler sessizce ayağa
kalkmıyordu.

## Zorunlu

```env
ROOT_DOMAIN=tugla.fun

POSTGRES_USER=tugla
POSTGRES_DB=tugla
POSTGRES_PASSWORD=<rastgele>

JWT_ACCESS_SECRET=<64 karakter>
JWT_REFRESH_SECRET=<64 karakter>
SESSION_ENCRYPTION_KEY=<64 karakter>

MINIO_ROOT_USER=tugla
MINIO_ROOT_PASSWORD=<rastgele>
```

Değerleri üretmek için:

```bash
node -e "const c=require('crypto');const k=()=>c.randomBytes(24).toString('base64url');
console.log('JWT_ACCESS_SECRET='+k()+k());
console.log('JWT_REFRESH_SECRET='+k()+k());
console.log('SESSION_ENCRYPTION_KEY='+k()+k());
console.log('POSTGRES_PASSWORD='+c.randomBytes(18).toString('hex'));
console.log('MINIO_ROOT_PASSWORD='+c.randomBytes(18).toString('hex'));"
```

> **Parolalarda `@ : / ? #` kullanmayın.** `DATABASE_URL` bu değeri bir URL
> içine gömer; bu karakterler adresi böler. Yukarıdaki komut hex ürettiği için
> bu sorun yaşanmaz.

## İsteğe bağlı ama önerilen

```env
SEED_ON_DEPLOY=true          # ilk dağıtımda 500 bölümü yazar
INTERNAL_API_KEY=<rastgele>  # servisler arası çağrılar
SMTP_HOST=...                # e-posta doğrulama; yoksa kodlar log'a yazılır
GOOGLE_CLIENT_ID=...         # Google ile giriş
NEXT_PUBLIC_ANALYZE_URL=https://analiz.tugla.fun
```

## Bir değişken eksikse ne olur

Compose dağıtımı başlatmadan durur ve sebebini yazar:

```
required variable POSTGRES_PASSWORD is missing a value:
POSTGRES_PASSWORD is required — set it in the Dokploy environment
```

Bu, imajları derleyip sonra ayağa kalkmayan konteynerlerle uğraşmaktan iyidir:
hata dağıtımın en başında ve eksik değişkenin adıyla çıkar.
