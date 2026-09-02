# Dokploy dağıtımı

Üretim compose dosyası **depo kökündedir**: [`compose.production.yml`](../../compose.production.yml).

Eskiden bu klasörde duruyordu ve iki kez dağıtımı düşürdü. Sebep, compose'un
göreli yolları **proje dizinine** göre çözmesi: bu dizin `--project-directory`
verilmişse odur, verilmemişse compose dosyasının bulunduğu klasördür. Dokploy her
iki biçimi de kullandı:

```
docker compose --project-directory <checkout>/code -f <dosya> ...
docker compose --env-file ... -f <dosya> ...              (proje dizini yok)
```

Dosya bu klasördeyken bu iki biçim **zıt** `context` değerleri gerektiriyordu
(`.` ve `../..`), yani hangi değeri yazarsak yazalım biçim değiştiğinde dağıtım
tek bir imaj derlemeden ölüyordu. Depo kökünde ikisi de aynı proje dizinini
verir; `context: .` her iki durumda da doğrudur.

**Dokploy ayarı:** Compose Path = `compose.production.yml`
