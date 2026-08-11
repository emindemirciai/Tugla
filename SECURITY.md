# Güvenlik Politikası / Security Policy

## Desteklenen sürümler

Yalnızca `main` dalındaki en son sürüm desteklenir. Üretim <https://tugla.fun> adresinde çalışır.

## Güvenlik açığı bildirimi

Bir açık bulduysan **herkese açık issue açma**. Doğrudan e-posta gönder: `SUPPORT_EMAIL` ortam
değişkeninde tanımlı adres. İlk dönüş hedefi 72 saattir.

Bildirimde işimize yarayanlar: etkilenen adres veya uç, adım adım yeniden üretim, beklenen ve
gözlenen davranış, varsa kavram kanıtı. Kişisel veriye rastladıysan lütfen kopyalama, bize bildir.

**Kapsam dışı:** başkalarının hesaplarına erişmek, veri silmek veya değiştirmek, hizmet dışı bırakma
denemesi, yoğun otomatik tarama. İyi niyetli araştırmaya karşı yasal işlem başlatılmaz.

## Bu projede alınan önlemler

- **Skor bütünlüğü:** İstemci skoru doğrudan kabul edilmez; sunucu aynı tohumla oyunu yeniden simüle
  eder, uyuşmayan sonuç hiçbir tabloya yazılmaz.
- **Kimlik doğrulama:** Argon2id parola özeti, kısa ömürlü erişim jetonu, her kullanımda döndürülen
  httpOnly yenileme jetonu; tekrar kullanılan jetonda oturum ailesi iptal edilir.
- **Yetkilendirme:** Personel rolleri her istekte sunucuda yeniden kontrol edilir; arayüzde bir
  düğmeyi gizlemek güvenlik sayılmaz. Personelin her yazma işlemi audit log'a düşer.
- **Kötüye kullanım:** İstemci IP'si başına hız sınırı; moderasyon bildirimlerinde tekrar engeli;
  üç farklı bildirimde topluluk bölümü otomatik incelemeye alınır.
- **Konteyner sertleştirmesi:** Uygulama konteynerleri tüm Linux yeteneklerini düşürür ve ayrıcalık
  yükseltmeye izin vermez; web ve panel salt okunur dosya sistemiyle, `/tmp` küçük ve `noexec` bir
  tmpfs olarak çalışır.
- **Sırlar:** Depoda gizli anahtar tutulmaz. Üretimde geliştirme değerleriyle açılış reddedilir.

Geçmiş bir olay ve alınan aksiyonlar: [`docs/INCIDENT-2026-08-07.md`](docs/INCIDENT-2026-08-07.md).
Mimari güvenlik notları: [`docs/SECURITY.md`](docs/SECURITY.md).

---

## English

Only the latest commit on `main` is supported; production runs at <https://tugla.fun>.

**Reporting:** please do not open a public issue — email the address configured in `SUPPORT_EMAIL`.
We aim to acknowledge within 72 hours. Useful details: the affected URL or endpoint, reproduction
steps, expected versus observed behaviour, and a proof of concept. If you encounter personal data,
do not copy it; tell us instead. Out of scope: accessing other people's accounts, deleting or
altering data, denial of service, and heavy automated scanning. Good-faith research will not be met
with legal action.

**Already in place:** scores are re-simulated server-side and rejected on mismatch; Argon2id password
hashing with rotating, family-revoking refresh tokens; staff roles re-checked on every request with
every staff write recorded in an audit log; per-IP rate limiting, de-duplicated moderation reports,
and automatic review after three distinct reports; containers that drop all Linux capabilities and
forbid privilege escalation, with read-only web and admin images and a small `noexec` `/tmp`; and no
secret in the repository, with production refusing development-grade values.

Past incident and response: [`docs/INCIDENT-2026-08-07.md`](docs/INCIDENT-2026-08-07.md).
Architectural notes: [`docs/SECURITY.md`](docs/SECURITY.md).
