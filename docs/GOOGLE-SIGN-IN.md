# Google ile giriş / Google sign-in

## Neden bir şey yapman gerekiyor

Kodun tamamı hazır ve yerinde duruyor. Eksik olan tek şey **Google'ın sana vereceği istemci
kimliği (client ID)**: Google, hangi sitenin kendi hesaplarıyla giriş isteyebileceğini bilmek ister.
Bu kimlik verilene kadar uygulama bunu dürüstçe söyler — giriş ekranındaki Google düğmesi görünür,
tıklandığında "bu kurulumda henüz yapılandırılmadı" der ve kimseyi boş bir ekranda bırakmaz.

## Adım adım (yaklaşık 10 dakika)

### 1. Google Cloud projesi

1. <https://console.cloud.google.com/> adresine Google hesabınla gir.
2. Üstteki proje seçicisinden **New Project** → ad: `Tugla` → **Create**.
3. Proje oluşunca sağ üstten o projeye geçtiğinden emin ol.

### 2. OAuth izin ekranı (consent screen)

1. Sol menü → **APIs & Services** → **OAuth consent screen**.
2. **External** seç → **Create**. (Yalnızca kendi kuruluşun değil, herkes giriş yapacak.)
3. Doldurulması zorunlu alanlar:
   - **App name:** `Tuğla.fun`
   - **User support email:** kendi e-posta adresin
   - **App logo:** isteğe bağlı; `https://tugla.fun/brand/logo-512.png` kullanılabilir
   - **Application home page:** `https://tugla.fun`
   - **Privacy policy link:** `https://tugla.fun/privacy`
   - **Terms of service link:** `https://tugla.fun/terms`
   - **Authorized domains:** `tugla.fun`
   - **Developer contact information:** kendi e-posta adresin
4. **Scopes** adımında hiçbir şey ekleme. Varsayılan `openid`, `email` ve `profile` yeterlidir;
   oyunun başka hiçbir Google verisine ihtiyacı yok ve istemediğin bir izin, ileride Google'ın
   doğrulama istemesine yol açar.
5. **Publishing status** bölümünde **Publish app** de. Test modunda kalırsa yalnızca elle eklediğin
   test kullanıcıları giriş yapabilir. Yalnızca `openid/email/profile` istendiği için Google'ın
   ayrıca doğrulama (verification) süreci gerekmez.

### 3. İstemci kimliği (client ID)

1. Sol menü → **APIs & Services** → **Credentials**.
2. **Create Credentials** → **OAuth client ID**.
3. **Application type:** `Web application`.
4. **Name:** `Tugla web`.
5. **Authorized JavaScript origins** — tam olarak şunlar (sonda eğik çizgi yok):
   - `https://tugla.fun`
   - `http://localhost:3000` (yerel geliştirme için; istemezsen ekleme)
6. **Authorized redirect URIs:** **boş bırak**. Bu kurulum Google'ın kimlik betiğini (Google Identity
   Services) kullanır; tarayıcı bir kimlik jetonu alır ve doğrudan bizim API'mize gönderir, Google
   bizim adresimize geri yönlendirme yapmaz.
7. **Create** → ekranda `...apps.googleusercontent.com` ile biten bir kimlik çıkar. **Kopyala.**

> **Client secret'a ihtiyacın yok.** Bu akışta gizli anahtar kullanılmaz; Google'ın verdiği secret'ı
> hiçbir yere yazma.

### 4. Dokploy'a gir

Dokploy → **Tugla** → **Environment** → aşağıdaki satırı ekle (tek satır, tırnaksız):

```env
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
```

Tek değişken yeterlidir: compose dosyası aynı değeri hem API'ye çalışma zamanı ortamı olarak, hem web
imajına derleme argümanı (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`) olarak geçirir.

Ardından **Deploy**. Web imajının yeniden derlenmesi şarttır: public değişkenler derleme sırasında
gömülür, çalışma zamanında okunmaz.

### 5. Doğrula

1. `https://tugla.fun` → giriş kartında **Google ile devam et** düğmesi Google'ın kendi düğmesine
   dönüşmüş olmalı (dört renkli G, "Google ile devam et" metni).
2. Tıkla → hesap seçme penceresi açılır → seç → oyuncu hub'ına düşmelisin.
3. `https://api.tugla.fun/api/config` çıktısında `"googleAuth": true` görünür.
4. Yönetim panelinde **Kullanıcılar** listesinde yeni hesap görünür; e-posta doğrulanmış gelir,
   çünkü Google adresi zaten doğrulamıştır.

## Nasıl çalışıyor (ve neden güvenli)

Tarayıcı Google'dan imzalı bir kimlik jetonu alır ve bize gönderir. Sunucu bu jetonu **Google'ın
açık anahtarlarıyla** doğrular; ayrıca **audience** alanının bizim istemci kimliğimiz olduğunu ve
**issuer** alanının Google olduğunu kontrol eder. Bu ikinci kontrol önemlidir: başka bir site için
üretilmiş geçerli bir Google jetonu burada kabul edilmez. Doğrulanmayan hiçbir jeton hesap açmaz —
smoke testinde bu davranış ayrıca kontrol edilir.

Aynı e-posta ile daha önce parolayla açılmış bir hesap varsa, Google kimliği o hesaba **bağlanır**;
ikinci bir hesap oluşmaz.

## Sorun giderme

| Belirti                                            | Sebep ve çözüm                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Düğme Google'ın düğmesine dönüşmüyor               | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` derlemeye girmemiş. Dokploy'da `GOOGLE_CLIENT_ID` tanımlı mı? Web imajı yeniden derlendi mi?                                                          |
| `origin_mismatch` hatası                           | **Authorized JavaScript origins** listesinde `https://tugla.fun` yok ya da sonunda eğik çizgi var                                                                                    |
| Pencere açılıp hemen kapanıyor, hiçbir şey olmuyor | Tarayıcı açılır pencereyi engellemiş olabilir; ayrıca bu depoda `Cross-Origin-Opener-Policy` bilinçli olarak `same-origin-allow-popups`'tır — daha katı bir değer bu iletişimi keser |
| API "Google sign-in is not configured" diyor       | API konteynerinde `GOOGLE_CLIENT_ID` yok; Dokploy değişkenini ekleyip yeniden dağıt                                                                                                  |
| "Access blocked: this app is not verified"         | İzin ekranı hâlâ **Testing** modunda; **Publish app** de                                                                                                                             |

---

## English

Everything in the code is ready; the only missing piece is the **client ID** Google issues, which
tells Google which site may ask for its accounts. Until it exists the button is visible and says so
when clicked, rather than failing silently.

Create a Google Cloud project, configure the OAuth consent screen as **External** with `tugla.fun` as
an authorised domain and links to `/privacy` and `/terms`, keep the default `openid`, `email` and
`profile` scopes only — asking for more triggers Google's verification review — and **publish** the
app so it is not limited to test users. Then create an **OAuth client ID** of type _Web application_
with `https://tugla.fun` as an authorised JavaScript origin and **no** redirect URIs: this flow uses
Google Identity Services, so the browser receives an ID token and posts it to our API directly. The
client secret is not used; do not store it anywhere.

Put `GOOGLE_CLIENT_ID=...` into Dokploy's environment and redeploy — the web image must rebuild,
because public variables are baked at build time. Verify at `/api/config` (`"googleAuth": true`) and
by signing in.

The server verifies each token against Google's public keys and checks both the issuer and the
audience, so a valid Google token minted for a different site is rejected. If an account already
exists for that email, the Google identity is linked to it instead of creating a second one.
