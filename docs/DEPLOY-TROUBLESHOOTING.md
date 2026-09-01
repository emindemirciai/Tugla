# Dağıtım sorun giderme / Deployment troubleshooting

## `lstat /etc/dokploy/compose/infrastructure: no such file or directory`

Dağıtım tek bir imaj derlemeden, şu satırla düşer:

```
resolve : lstat /etc/dokploy/compose/infrastructure: no such file or directory
Error: ❌ Docker command failed
```

**Sebep.** Dokploy compose'u şöyle çağırır:

```
docker compose --project-directory /etc/dokploy/compose/<app>/code \
  -f infrastructure/dokploy/compose.production.yml up -d --build
```

Compose v2, dosyadaki göreli yolları **compose dosyasının bulunduğu klasöre göre
değil, `--project-directory`'ye göre** çözer. Proje dizini zaten depo kökü
olduğu için `context: ../..` kökün **iki seviye üstüne** çıkar:

```
/etc/dokploy/compose/<app>/code  +  ../..  →  /etc/dokploy/compose
+ infrastructure/docker/Dockerfile.web     →  /etc/dokploy/compose/infrastructure/...
```

Hata mesajındaki dizin tam olarak budur; kimsenin yazmadığı bir yol olduğu için
mesaj da kafa karıştırıcıdır.

**Çözüm.** Her `build.context` değeri `.` olmalıdır — proje dizini zaten depo
köküdür. `pnpm check:docker` artık bunu dağıtımın çözdüğü şekilde çözerek
denetler; `../..` geri konulduğunda kontrol kırmızıya döner.

## `dependency failed to start: container ... api-1 is unhealthy`

İmajlar derlendi, konteyner başladı ama sağlık kontrolünü geçemedi. Sağlık ucu artık anlamlı:
veritabanına ulaşamıyorsa **503** döner, Redis yoksa "degraded" ama 200 döner. Yani bu hata iki
şeyden birini söyler.

### 0. Gerçek örnek: `MAIL_PROVIDER=stmp`

2026-08-09 dağıtımı tam olarak bu yüzden düştü — `smtp` yerine `stmp` yazılmıştı. API açılmayı
reddetti, `web` ve `admin` de ona bağlı olduğu için site komple gitti.

Bundan sonra bu sınıf hata siteyi düşürmez: yalnızca bir özelliği kapatan ayarlar (posta sağlayıcı,
depolama sağlayıcı, varsayılan dil, SEO/tohumlama anahtarları) geçersizse **uyarı yazılır ve güvenli
varsayılana düşülür**; servis çalışmaya devam eder. Log şöyle görünür:

```
[env] MAIL_PROVIDER: Invalid enum value. Expected 'smtp' | 'log' | 'disabled', received 'stmp'
      — did you mean 'smtp'? — falling back to the default.
```

Güvenliği veya çalışabilirliği etkileyen değerler (`DATABASE_URL`, JWT sırları, oturum anahtarı) hâlâ
ölümcüldür: yanlışsa servis açılmaz.

### 1. API süreci hiç ayağa kalkmadı (ortam doğrulaması)

En sık sebep **döndürülmüş bir sırrın şema kuralına uymaması**. API, geçersiz ortamla yarım
çalışmaz; açılışta durur ve hangi değişkenin neden reddedildiğini yazar:

```
Error: Invalid environment configuration:
  - JWT_ACCESS_SECRET: String must contain at least 32 character(s)
```

Uzunluk kuralları:

| Değişken                 | Kural                            |
| ------------------------ | -------------------------------- |
| `JWT_ACCESS_SECRET`      | en az 32 karakter                |
| `JWT_REFRESH_SECRET`     | en az 32 karakter                |
| `SESSION_ENCRYPTION_KEY` | en az 32 karakter                |
| `INTERNAL_API_KEY`       | en az 16 karakter (isteğe bağlı) |

Üretmek için: `openssl rand -hex 32`

### 2. Süreç ayakta ama veritabanına bağlanamıyor

**Parola döndürüldüyse en olası sebep budur.** PostgreSQL `POSTGRES_PASSWORD` değişkenini yalnızca
veri dizini **ilk kez oluşturulurken** uygular. Var olan bir birimde parolayı değiştirmek, ortam
değişkenini güncellemekle olmaz; veritabanının içinde değiştirilmelidir:

```bash
docker exec -it tugla-mha2ef-postgres-1 psql -U tugla -d tugla \
  -c "ALTER USER tugla WITH PASSWORD 'yeni-parola';"
```

Sonra `POSTGRES_PASSWORD` ve `DATABASE_URL` değerlerini aynı parolaya getirip yeniden dağıt.
Paroladaki `@ : / ? #` gibi karakterler `DATABASE_URL` içinde **yüzde kodlaması** ister; en kolayı
bu karakterleri hiç kullanmamaktır (`openssl rand -hex 24`).

Aynı tuzak MinIO için geçerli değildir: MinIO kök parolasını her açılışta ortamdan okur.

### Sitenin ayakta kalması

`web` ve `admin` artık API'nin _başlamasını_ bekler, _sağlıklı olmasını_ değil. API'de bir sorun
olduğunda oyun bozulur ama site tamamen 404 vermez — daha önce iki kez böyle oldu.

---

## English summary

`api-1 is unhealthy` means either the process never started (invalid environment — the log names the
variable and its rule; secrets need 32+ characters) or it started but cannot reach PostgreSQL. After
rotating a database password, remember that PostgreSQL only applies `POSTGRES_PASSWORD` when the
data directory is first created: change it inside the database with `ALTER USER`, then update
`POSTGRES_PASSWORD` and `DATABASE_URL`. Avoid `@ : / ? #` in generated passwords, or percent-encode
them in the URL. `web` and `admin` now wait for the API to start rather than to be healthy, so an API
problem degrades the game instead of taking the site off the internet.
