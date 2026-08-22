'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Locale = 'tr' | 'en';

const STORAGE_KEY = 'tugla.locale';

/**
 * Turkish is the source dictionary; the English dictionary is typed against it
 * so a missing key is a compile error, never a silent fallback at runtime.
 */
const tr = {
  // common
  'common.appTagline': 'Izgarayı kır',
  'common.processing': 'İşleniyor…',
  'common.unexpectedError': 'Beklenmeyen bir hata oluştu',
  'common.close': 'Kapat',
  'common.back': 'Geri',
  'common.language': 'Dil',

  // auth
  'auth.login.title': 'Tekrar hoş geldin',
  'auth.login.subtitle': 'Kaldığın dünyadan devam et; ilerlemen tüm cihazlarında seninle.',
  'auth.login.submit': 'Giriş yap',
  'auth.login.forgot': 'Parolanı mı unuttun?',
  'auth.login.noAccount': 'Hesabın yok mu?',
  'auth.login.registerLink': 'Kayıt ol',
  'auth.login.providerNote':
    'Google / Apple ile giriş, sağlayıcı anahtarları yapılandırıldığında burada görünür.',
  'auth.register.title': 'Hesabını oluştur',
  'auth.register.subtitle': '500 bölüm, haftalık ligler ve bulut kayıt tek hesapla açılır.',
  'auth.register.submit': 'Kayıt ol',
  'auth.register.haveAccount': 'Zaten hesabın var mı?',
  'auth.register.loginLink': 'Giriş yap',
  'auth.field.email': 'E-posta',
  'auth.field.password': 'Parola',
  'auth.field.newPassword': 'Yeni parola',
  'auth.field.displayName': 'Görünen ad',
  'auth.field.passwordHint': 'En az 10 karakter; harf + rakam veya sembol.',
  'auth.field.terms': 'Kullanım şartlarını ve gizlilik politikasını kabul ediyorum.',
  'auth.field.marketing': 'Yeni içerik duyurularını e-postayla almak istiyorum.',
  'auth.forgot.title': 'Parolanı sıfırla',
  'auth.forgot.subtitle':
    'Hesabına bağlı e-posta adresini gir; sana tek kullanımlık bir bağlantı gönderelim.',
  'auth.forgot.submit': 'Sıfırlama bağlantısı gönder',
  'auth.forgot.backToLogin': 'Girişe dön',
  'auth.forgot.sentTitle': 'Bağlantı yolda',
  'auth.forgot.sentBody':
    'Bu e-posta kayıtlıysa, parola sıfırlama bağlantısı gönderildi. Bağlantı 1 saat geçerlidir.',
  'auth.reset.title': 'Yeni parola belirle',
  'auth.reset.subtitle': 'Parolan güncellendiğinde diğer tüm cihazlardaki oturumlar kapatılır.',
  'auth.reset.submit': 'Parolayı güncelle',
  'auth.reset.missingTitle': 'Bağlantı eksik',
  'auth.reset.missingBody': 'Bu sayfa yalnızca e-postadaki sıfırlama bağlantısıyla açılabilir.',
  'auth.reset.requestNew': 'Yeni bağlantı iste',
  'auth.verify.working': 'E-posta doğrulanıyor…',
  'auth.verify.doneTitle': 'E-posta doğrulandı ✓',
  'auth.verify.doneBody': 'Hesabın tam yetkili. İyi oyunlar!',
  'auth.verify.play': 'Oynamaya başla',
  'auth.verify.failedTitle': 'Bağlantı geçersiz',
  'auth.verify.failedBody':
    'Doğrulama bağlantısı süresi dolmuş veya daha önce kullanılmış olabilir. Hesap sayfandan yeni bir bağlantı isteyebilirsin.',
  'auth.verify.goAccount': 'Hesabıma git',

  // play hub
  'firstRun.title': 'Nasıl oynanır',
  'firstRun.controlTitle': 'Platformu sürükle',
  'firstRun.controlBody':
    'Parmağınla veya fareyle sürükle; ok tuşları da çalışır. İlk hareket topu fırlatır ve çarptığı nokta topun açısını belirler.',
  'firstRun.goalTitle': 'Blokları temizle',
  'firstRun.goalBody':
    'Bölümdeki blokları bitir. Üç hakkın var; top alta düşerse bir hak gider. Bonuslar topu çoğaltır, kalkan verir veya tabana ağ serer.',
  'firstRun.progressTitle': 'İlerlemeni topla',
  'firstRun.progressBody':
    'Her bölüm sonraki bölümü açar. Günlük görevler, haftalık lig ve günün bölümü ek ödül verir; skorların tüm cihazlarında saklanır.',
  'play.checkingSession': 'Oturum doğrulanıyor…',
  'play.account': 'Hesap',
  'play.signOut': 'Çıkış',
  'play.banner.verifySent': 'Doğrulama e-postası gönderildi. Gelen kutunu kontrol et.',
  'play.banner.unverified':
    'E-postan henüz doğrulanmadı. Hesabını korumak için gelen kutundaki bağlantıyı onayla.',
  'play.banner.offlineQueued': 'Senkron bekleyen {count} çevrim dışı oyun var.',
  'play.banner.offlineSynced': '{count} çevrim dışı oyun senkronize edildi (sırasız ilerleme).',
  'play.error.worlds': 'Dünyalar yüklenemedi. Bağlantını kontrol et.',
  'play.error.levels': 'Bölümler yüklenemedi.',
  'play.error.start': 'Bölüm başlatılamadı.',
  'play.world': 'DÜNYA',
  'play.levelsLoading': 'Bölümler yükleniyor…',
  'play.level.minutes': '~{minutes} dk · zorluk {difficulty}',
  'play.level.locked': 'Kilitli',
  'play.level.lockedHint': 'Önceki bölümü tamamla',
  'play.level.cleared': 'Tamamlandı',
  'play.level.dailyPlayed': 'Günün bölümü olarak oynandı; bu bölüm açık ama sonraki kilitli',
  'play.level.starting': 'Başlatılıyor…',
  'play.badge.miniBoss': 'MİNİ BOSS',
  'play.badge.worldBoss': 'DÜNYA BOSSU',
  'play.badge.daily': 'GÜNLÜK',
  'play.badge.community': 'TOPLULUK',
  'play.worldsAria': 'Dünyalar',
  'play.worldsPrev': 'Önceki dünyalar',
  'play.worldsNext': 'Sonraki dünyalar',
  'play.levelsAria': 'Bölümler',

  // in-game
  'game.exit': '← Çıkış',
  'game.world': 'DÜNYA',
  'game.pause': 'DURAKLAT',
  'game.resume': 'DEVAM',
  'game.settingsAria': 'Ayarlar',
  'game.hud.score': 'SKOR',
  'game.hud.combo': 'KOMBO',
  'game.hud.overcharge': 'OVERCHARGE',
  'game.hud.lives': 'CAN',
  'game.hud.balls': 'AKTİF TOP',
  'game.hud.blocks': 'KALAN BLOK',
  'game.hud.time': 'SÜRE',
  'game.instruction.title': 'PLATFORMU HAREKET ETTİR',
  'game.instruction.body': 'İlk hareketin topun çıkış açısını belirler.',
  'game.settings.title': 'Görüntü ayarları',
  'game.settings.quality': 'Grafik kalitesi',
  'game.settings.auto': 'Otomatik',
  'game.settings.low': 'Düşük',
  'game.settings.medium': 'Orta',
  'game.settings.high': 'Yüksek',
  'game.settings.trails': 'Top izi',
  'game.settings.reducedMotion': 'Azaltılmış hareket',
  'game.settings.sound': 'Ses',
  'game.settings.note': 'Kalite değişikliği sahneyi yeniden oluşturur.',
  'game.paused.tag': 'DURAKLATILDI',
  'game.paused.title': 'Ritmi dondurdun.',
  'game.paused.resume': 'Devam et',
  'game.over.completed': 'BÖLÜM TAMAMLANDI',
  'game.over.failed': 'ENERJİ TÜKENDİ',
  'game.over.points': '{score} puan',
  'game.over.verifying': 'Sonuç doğrulanıyor…',
  'game.over.submitFailed': 'Sonuç gönderilemedi',
  'game.over.rejected': 'Sunucu bu sonucu doğrulayamadı ({reasons}). Skor kaydedilmedi.',
  'game.over.rejectedUnknown': 'bilinmeyen sebep',
  'game.over.credits': '+{count} kredi',
  'game.over.crystals': '+{count} kristal',
  'game.over.xp': '+{count} XP',
  'game.over.personalBest': 'Kişisel rekor!',
  'game.over.achievement': 'Başarım açıldı: {name}',
  'game.over.backToLevels': 'Bölüm listesine dön',
  'game.footer.controls': 'SÜRÜKLE / FARE / ← →',
  'game.footer.physics': 'SABİT 120 HZ FİZİK',
  'game.footer.maxBalls': 'MAKS {count} TOP',
  'game.error.levelData': 'Bölüm verisi okunamadı.',

  // account
  'account.backToGame': '← Oyuna dön',
  'account.title': 'Hesap',
  'account.profile': 'Profil',
  'account.displayName': 'Görünen ad',
  'account.username': 'Kullanıcı adı',
  'account.avatar': 'Profil fotoğrafı',
  'account.avatarChoose': 'Fotoğraf yükle',
  'account.avatarRules':
    'PNG, JPEG veya WEBP · en fazla 2 MB · kare olacak şekilde ortadan kırpılır ve 256×256 boyutuna küçültülür.',
  'account.avatarBadType': 'Yalnızca PNG, JPEG veya WEBP yükleyebilirsin.',
  'account.avatarTooLarge': 'Dosya çok büyük. 10 MB altında bir görsel seç.',
  'account.avatarSaved': 'Profil fotoğrafın güncellendi.',
  'account.avatarRemoved': 'Profil fotoğrafın kaldırıldı.',
  'account.avatarOwn': 'Kendi seçtiğin fotoğraf kullanılıyor; Google ile her girişte değişmez.',
  'account.avatarProvider':
    'Şu an Google hesabındaki fotoğraf kullanılıyor. Buraya bir bağlantı yazarsan kendi seçimin geçerli olur.',
  'account.avatarReset': 'Google fotoğrafına dön',
  'account.displayNameHint': 'Diğer oyuncuların gördüğü ad. 7 günde bir değiştirilebilir.',
  'account.notVerified': 'Doğrulanmadı',
  'account.usernameHint':
    'Küçük harf, rakam, nokta, tire ve alt çizgi. Adını 7 günde bir değiştirebilirsin.',
  'account.saveProfile': 'Profili kaydet',
  'account.profileSaved': 'Profilin güncellendi.',
  'account.emailLocked': 'E-posta adresi buradan değiştirilemez; hesabın sahibi olan adres budur.',
  'account.email': 'E-posta',
  'account.verified': 'doğrulandı',
  'account.sendVerification': 'doğrulama bağlantısı gönder',
  'account.verificationSent': 'Doğrulama e-postası gönderildi.',
  'account.verificationUnavailable': 'E-posta servisi yapılandırılmadığı için gönderilemedi.',
  'account.password': 'Parola',
  'account.currentPassword': 'Mevcut parola',
  'account.newPassword': 'Yeni parola',
  'account.newPasswordHint':
    'En az 10 karakter. Kaydettiğinde diğer tüm cihazlardaki oturumlar kapanır.',
  'account.savePassword': 'Parolayı güncelle',
  'account.passwordChanged': 'Parolan güncellendi ve diğer cihazlardaki oturumlar kapatıldı.',
  'account.providers': 'Bağlı sağlayıcılar',
  'account.providersNone': 'Yalnızca e-posta + parola.',
  'account.providersNote':
    'Google/Apple bağlama, sağlayıcı anahtarları yapılandırıldığında giriş ekranında görünür.',
  'account.language': 'Dil tercihi',
  'account.languageNote': 'Arayüz ve e-postalar bu dilde gösterilir.',
  'account.sessions': 'Aktif oturumlar',
  'account.unknownDevice': 'Bilinmeyen cihaz',
  'account.thisDevice': 'bu cihaz',
  'account.revoke': 'Sonlandır',
  'account.data': 'Verilerin',
  'account.export': 'Tüm verilerimi indir (JSON)',
  'account.exportDone': 'Verilerin JSON olarak indirildi.',
  'account.exportFailed': 'Dışa aktarma başarısız oldu.',
  'account.delete': 'Hesabı sil',
  'account.deleteWarning':
    'Bu işlem geri alınamaz: kişisel verilerin anında temizlenir, skorların anonimleşir. Onaylamak için kullanıcı adını yaz:',
  'account.deleteConfirmAria': 'Silme onayı',
  'account.deleteButton': 'Hesabı kalıcı olarak sil',
  'account.deleteFailed': 'Hesap silme başarısız oldu.',

  // landing
  'landing.nav.signIn': 'Giriş yap',
  'landing.nav.register': 'Kayıt ol',
  'landing.hero.eyebrow': 'MODERN TUĞLA KIRMA',
  'landing.hero.title': 'Ritmi yakala. Fırtınayı çoğalt. Her çekirdeği kır.',
  'landing.hero.body':
    '10 dünya, 500 el yapımı bölüm, boss savaşları ve 500 topa kadar büyüyen zincir reaksiyonlar. Deterministik fizik sayesinde her skor sunucuda yeniden oynatılarak doğrulanır.',
  'landing.hero.cta': 'Hemen oyna',
  'landing.stats.worlds': 'dünya',
  'landing.stats.levels': 'bölüm',
  'landing.stats.balls': 'eşzamanlı top',
  'landing.stats.fps': 'sabit fizik adımı',
  'landing.feature1.title': 'Tek elle, dikey ritim',
  'landing.feature1.body':
    'Platformu sürükle, açıyı sen belirle. Dokunmatik, fare ve klavye aynı hassasiyetle çalışır.',
  'landing.feature2.title': 'Overcharge fırtınası',
  'landing.feature2.body':
    '500 top sınırına dayandığında fazla enerji Overcharge olarak hasara dönüşür; ekran gerçek anlamda parçalanır.',
  'landing.feature3.title': 'Doğrulanmış skorlar',
  'landing.feature3.body':
    'Her oyun girdileriyle kaydedilir ve sunucu aynı tohumla yeniden simüle eder. Liderlik tablolarına hile giremez.',
  'landing.feature4.title': 'Günün bölümü',
  'landing.feature4.body': 'Herkes aynı bölümü oynar; günlük tablo her gece sıfırlanır.',
  'landing.feature4.detail':
    'Bölüm, tarihten türetilen sabit bir seçimle belirlenir; kimse için farklı değildir ve destek ekibi aynı seçimi yeniden üretebilir.',
  'landing.feature5.title': 'Kendi bölümünü tasarla',
  'landing.feature5.body': 'Izgara editörüyle tasarla, test et, incelemeye gönder.',
  'landing.feature5.detail':
    'Yayınlanan bölümler beğeni alır ve bildirilebilir; üç farklı oyuncu bildirdiğinde bölüm otomatik olarak incelemeye döner.',
  'landing.feature6.title': 'Her cihazda aynı hesap',
  'landing.feature6.body': 'Bulut kayıt, çoklu cihaz ve sınırlı çevrim dışı oyun.',
  'landing.feature6.detail':
    'İlerlemen sunucuda tutulur; çevrim dışı oynanan bölümler bağlantı gelince sırasız ilerleme olarak eşitlenir ve tabloları etkilemez.',
  'landing.feature1.detail':
    'Platform parmağın altına ışın izlemeyle yansıtılır; dokunmatik, fare ve klavye aynı hassasiyetle çalışır.',
  'landing.feature2.detail':
    'Bonuslar tek top, top sürüsü, güvenlik ağı, kalkan, mıknatıs ve daha fazlası arasında değişir; 500 top sınırında fazla enerji Overcharge çarpanına döner.',
  'landing.feature3.detail':
    'İstemci girdileri kaydeder, sunucu aynı tohumla yeniden simüle eder. Uyuşmayan sonuç hiçbir tabloya yazılmaz.',
  'landing.footer.licence':
    'Kaynak kodu MIT lisanslıdır; marka adı, logo, görseller ve bölüm tasarımları kapsam dışıdır.',
  'landing.footer.version': 'Çalışan sürüm',
  'landing.footer.rights': 'Tüm hakları saklıdır.',
  'landing.footer.privacy': 'Gizlilik',
  'landing.footer.terms': 'Şartlar',
  'landing.footer.support': 'Destek',
  // player hub navigation
  'hub.play': 'Oyna',
  'hub.progress': 'İlerleme',
  'hub.leagues': 'Ligler',
  'hub.social': 'Arkadaşlar',
  'hub.shop': 'Mağaza',
  'hub.unread': '{count} okunmamış mesaj',
  'hub.inbox': 'Bildirimler',
  'hub.replays': 'Tekrarlar',
  'hub.account': 'Hesap',
  // progress
  'progress.title': 'İlerleme',
  'progress.tasks': 'Görevler',
  'progress.achievements': 'Başarımlar',
  'progress.wallet': 'Cüzdan',
  'progress.claim': 'Ödülü al',
  'progress.claimed': 'Alındı',
  'progress.claimSuccess': 'Ödül hesabına eklendi.',
  'progress.claimFailed': 'Ödül alınamadı.',
  'progress.noTasks': 'Şu an aktif görev yok. Yeni görevler her gün 00:00 UTC’de yenilenir.',
  'progress.noAchievements': 'Henüz başarım tanımlı değil.',
  'progress.balances': 'Bakiyeler',
  'progress.transactions': 'Son hareketler',
  'progress.reason': 'Kaynak',
  'progress.amount': 'Miktar',
  'progress.date': 'Tarih',
  'progress.noTransactions': 'Henüz hareket yok.',
  'progress.unlocked': 'Açıldı',
  'progress.inProgress': 'Devam ediyor',
  // leagues
  'leagues.title': 'Haftalık lig',
  'leagues.tier': 'Kademe',
  'leagues.group': 'Grup',
  'leagues.endsAt': 'Bitiş',
  'leagues.rank': 'Sıra',
  'leagues.player': 'Oyuncu',
  'leagues.score': 'Skor',
  'leagues.you': 'sen',
  'leagues.none':
    'Bu hafta henüz lige katılmadın. Bir bölüm tamamla, otomatik olarak 30 kişilik bir gruba yerleştirilirsin.',
  'leagues.global': 'Haftalık küresel tablo',
  'leagues.emptyBoard': 'Bu hafta henüz doğrulanmış skor yok.',
  // social
  'social.title': 'Arkadaşlar',
  'social.searchPlaceholder': 'Kullanıcı adı veya isim ara',
  'social.search': 'Ara',
  'social.follow': 'Takip et',
  'social.addFriend': 'Arkadaş ekle',
  'social.requestSent': 'Arkadaşlık isteği gönderildi.',
  'social.followed': 'Takip ediliyor.',
  'profile.title': 'Oyuncu profili',
  'profile.notFound': 'Bu oyuncu bulunamadı ya da profilini gizlemiş.',
  'profile.backToSocial': 'Arkadaşlara dön',
  'profile.joined': 'Katılım: {date}',
  'profile.playerLevel': 'Oyuncu seviyesi',
  'profile.levelsCleared': 'Tamamlanan bölüm',
  'profile.achievements': 'Başarım',
  'profile.bestWeekly': 'En iyi haftalık skor',
  'profile.addFriend': 'Arkadaş ekle',
  'profile.pending': 'İstek gönderildi',
  'profile.incoming': 'Sana istek gönderdi',
  'profile.message': 'Mesaj gönder',
  'profile.editOwn': 'Profilini düzenle',
  'profile.requestSent': 'Arkadaşlık isteği gönderildi.',
  'social.friends': 'Arkadaşların',
  'social.accept': 'Kabul et',
  'social.accepted': 'Arkadaşlık kabul edildi.',
  'social.message.open': 'Mesaj gönder',
  'social.message.cancel': 'Vazgeç',
  'social.message.label': '{name} kullanıcısına mesaj',
  'social.message.hint':
    'Mesajın alıcının gelen kutusuna düşer. Moderasyon içeriği görmez; yalnızca kime yazdığın kayda geçer.',
  'social.message.send': 'Gönder',
  'social.message.sent': 'Mesajın gönderildi.',
  'social.noFriends': 'Henüz arkadaşın yok. Yukarıdan oyuncu arayarak başlayabilirsin.',
  'social.noResults': 'Eşleşen oyuncu bulunamadı.',
  'social.actionFailed': 'İşlem tamamlanamadı.',
  // shop
  'shop.title': 'Mağaza',
  'shop.buy': 'Satın al',
  'shop.owned': 'Envanterinde',
  'shop.purchased': 'Satın alma tamamlandı.',
  'shop.purchaseFailed': 'Satın alma başarısız.',
  'shop.paymentsOff':
    'Gerçek para ürünleri, ödeme sağlayıcısı yapılandırılana kadar listelenmez. Oyun içi para ile satılan her şey burada.',
  'shop.empty': 'Mağazada şu an ürün yok.',
  'shop.balance': 'Bakiye',
  // inbox
  'inbox.title': 'Bildirimler',
  'inbox.announcements': 'Duyurular',
  'inbox.notifications': 'Bildirimlerin',
  'inbox.markRead': 'Okundu işaretle',
  'inbox.empty': 'Yeni bildirim yok.',
  'inbox.noAnnouncements': 'Şu an yayınlanmış duyuru yok.',
  'inbox.unread': '{count} okunmamış',
  // replays
  'replays.title': 'Tekrarlar',
  'replays.level': 'Bölüm',
  'replays.score': 'Skor',
  'replays.date': 'Tarih',
  'replays.watch': 'İzle',
  'replays.back': 'Tekrarlara dön',
  'replays.notFound': 'Bu tekrar bulunamadı ya da paylaşıma kapalı.',
  'replays.liveScore': 'OYNATILAN SKOR',
  'replays.recordedScore': 'KAYITLI SKOR',
  'replays.playbackFinished': 'Tekrar bitti.',
  'replays.playbackFailed': 'Bu tekrar oynatılamadı; kayıt bozuk olabilir.',
  'replays.share': 'Paylaş',
  'replays.unshare': 'Paylaşımı kaldır',
  'replays.shared': 'paylaşıldı',
  'replays.empty': 'Kaydedilmiş tekrar yok. Doğrulanan her oyun otomatik olarak kaydedilir.',
  'replays.verifiedNote':
    'Tekrarlar sunucunun skorunu doğrulamak için kullandığı girdi kayıtlarıdır; paylaştıklarını arkadaşların izleyebilir.',
  // community level creator
  'create.title': 'Bölüm tasarla',
  'create.hubTab': 'Tasarla',
  'create.intro':
    'Kendi bölümünü tasarla, dene ve incelemeye gönder. Onaylanan bölümler topluluk sekmesinde herkese açılır.',
  'create.new': '+ Yeni bölüm',
  'create.name': 'Bölüm adı',
  'create.theme': 'Tema',
  'create.grid': 'Izgara',
  'create.brush': 'Fırça',
  'create.erase': 'Sil',
  'create.blocks': '{count} blok',
  'create.required': 'Zorunlu hedef',
  'create.hitPoints': 'Dayanıklılık',
  'create.save': 'Taslağı kaydet',
  'create.saved': 'Taslak kaydedildi.',
  'create.test': 'Test et',
  'create.submit': 'İncelemeye gönder',
  'create.submitted': 'Bölüm incelemeye gönderildi.',
  'create.delete': 'Sil',
  'create.deleted': 'Bölüm silindi.',
  'create.cancel': 'Vazgeç',
  'create.empty': 'Henüz bölümün yok. Yukarıdan yeni bir tane oluştur.',
  'create.limit': '{used}/{limit} bölüm',
  'create.limitReached':
    'Bölüm sınırına ulaştın. Yeni bir tane için mevcut taslaklardan birini sil.',
  'create.needBlocks': 'En az 5 blok yerleştir.',
  'create.needName': 'En az 3 karakterlik bir ad gir.',
  'create.status.DRAFT': 'Taslak',
  'create.status.REVIEW': 'İncelemede',
  'create.status.PUBLISHED': 'Yayında',
  'create.status.REJECTED': 'Reddedildi',
  'create.status.ARCHIVED': 'Arşivlendi',
  'create.editLocked': 'İncelemedeki veya yayındaki bölümler düzenlenemez.',
  'create.failed': 'İşlem tamamlanamadı.',
  'create.sortTop': 'En beğenilen',
  'create.sortNew': 'En yeni',
  'create.community': 'Topluluk bölümleri',
  'create.communityEmpty': 'Henüz yayınlanmış topluluk bölümü yok.',
  'create.by': 'yapan',
  'create.play': 'Oyna',
  'create.edit': 'Düzenle',
  'daily.title': 'Günün bölümü',
  'daily.subtitle': 'Herkes aynı bölümü oynar. Günlük tablo her gece sıfırlanır.',
  'daily.play': 'Günün bölümünü oyna',
  'daily.myBest': 'Bugünkü skorun',
  'daily.notPlayed': 'Bugün henüz oynamadın',
  'daily.board': 'Bugünün tablosu',
  'daily.empty': 'Bugün henüz skor girilmedi. İlk sen ol.',
  'daily.rank': 'Sıra',
  'daily.player': 'Oyuncu',
  'daily.score': 'Skor',
  'daily.unavailable': 'Günün bölümü şu an hazırlanıyor.',
  'daily.noUnlock':
    'Günün bölümü yalnızca oynadığın bölümün kilidini açar; kampanyada sonraki bölümü açmaz.',
  'daily.replayTitle': 'Tekrar oynamak istediğine emin misin?',
  'daily.replayBody':
    'Bugün bu bölümü {score} puanla bitirdin. Yeniden oynarsan günlük tablodaki skorun yalnızca daha iyisini yaparsan güncellenir.',
  'daily.replayConfirm': 'Evet, tekrar oyna',
  'daily.replayCancel': 'Vazgeç',
  'daily.replayAck': 'Anladım: bu oyun sonraki bölümü açmaz.',
  'auth.or': 'veya',
  'auth.google.pending': 'Google hesabın doğrulanıyor…',
  'auth.google.continue': 'Google ile devam et',
  'landing.auth.welcomeBack': 'Tekrar hoş geldin, {name}.',
  'landing.auth.registerCta': 'Hesabın yok mu? Kayıt ol',
  'landing.auth.noAccount': 'Hesabın yok mu?',
  'landing.auth.guestPeek': 'Önce bölümlere göz at',
  'auth.google.unavailable':
    'Google girişi bu kurulumda henüz yapılandırılmadı. E-posta ve parolayla devam edebilirsin.',
  'auth.verify.codeTitle': 'E-postanı doğrula',
  'auth.verify.codeBody':
    '{email} adresine 6 haneli bir doğrulama kodu gönderdik. Kod 30 dakika geçerlidir.',
  'auth.verify.codeLabel': 'Doğrulama kodu',
  'auth.verify.codeSubmit': 'Kodu doğrula',
  'auth.verify.codeInvalid': 'Kod hatalı veya süresi dolmuş. Yeni kod isteyebilirsin.',
  'auth.verify.resend': 'Yeni kod gönder',
  'auth.verify.resent': 'Yeni kod gönderildi. Gelen kutunu kontrol et.',
  'auth.verify.resendUnavailable': 'E-posta servisi yapılandırılmadığı için gönderilemedi.',
  'auth.verify.emailMissing': 'Doğrulanacak e-posta adresi bulunamadı.',
  'auth.verify.later': 'Daha sonra doğrula',
  'create.like': 'Beğen',
  'create.dislike': 'Beğenme',
  'create.rated': 'Değerlendirmen kaydedildi.',
  'create.rateOwn': 'Kendi bölümünü değerlendiremezsin.',
  'create.report': 'Bildir',
  'create.reportReason': 'Bildirme sebebi',
  'create.reportSent': 'Bildirimin moderasyona iletildi.',
  'create.reportDuplicate': 'Bu bölümü zaten bildirmişsin.',
  'create.reason.ABUSE': 'Taciz / kötüye kullanım',
  'create.reason.SPAM': 'Spam',
  'create.reason.INAPPROPRIATE': 'Uygunsuz içerik',
  'create.reason.CHEATING': 'Hile / bozuk bölüm',
  'create.reason.OTHER': 'Diğer',
  'create.autoHidden': 'Yeterli bildirim toplandı; bölüm incelemeye alındı.',
  'create.mine': 'senin bölümün',
  'theme.label': 'Görünüm',
  'theme.toDay': 'Aydınlık moda geç',
  'theme.toNight': 'Karanlık moda geç',
  'theme.note': 'Gece modu, oyun sahnesiyle aynı menekşe tonlarını arayüze taşır.',
  'a11y.skip': 'İçeriğe geç',
  'notFound.title': 'Bu sayfa bulunamadı',
  'notFound.body':
    'Bağlantı eskimiş ya da yanlış yazılmış olabilir. Ana sayfadan devam edebilirsin.',
  'notFound.home': 'Ana sayfaya dön',
  'notFound.play': 'Oynamaya devam et',
  'error.title': 'Bir şeyler ters gitti',
  'error.body': 'Beklenmeyen bir hata oluştu. Tekrar deneyebilir ya da ana sayfaya dönebilirsin.',
  'error.retry': 'Tekrar dene',
} as const;

export type TranslationKey = keyof typeof tr;

const en: Record<TranslationKey, string> = {
  'common.appTagline': 'Break the grid',
  'common.processing': 'Working…',
  'common.unexpectedError': 'Something unexpected went wrong',
  'common.close': 'Close',
  'common.back': 'Back',
  'common.language': 'Language',

  'auth.login.title': 'Welcome back',
  'auth.login.subtitle': 'Pick up where you left off; your progress follows you on every device.',
  'auth.login.submit': 'Sign in',
  'auth.login.forgot': 'Forgot your password?',
  'auth.login.noAccount': 'No account yet?',
  'auth.login.registerLink': 'Create one',
  'auth.login.providerNote':
    'Google / Apple sign-in appears here once provider keys are configured.',
  'auth.register.title': 'Create your account',
  'auth.register.subtitle': '500 levels, weekly leagues and cloud saves unlock with one account.',
  'auth.register.submit': 'Sign up',
  'auth.register.haveAccount': 'Already have an account?',
  'auth.register.loginLink': 'Sign in',
  'auth.field.email': 'Email',
  'auth.field.password': 'Password',
  'auth.field.newPassword': 'New password',
  'auth.field.displayName': 'Display name',
  'auth.field.passwordHint': 'At least 10 characters; letters plus a number or symbol.',
  'auth.field.terms': 'I accept the terms of service and privacy policy.',
  'auth.field.marketing': 'Email me about new content and events.',
  'auth.forgot.title': 'Reset your password',
  'auth.forgot.subtitle': "Enter your account email and we'll send a single-use reset link.",
  'auth.forgot.submit': 'Send reset link',
  'auth.forgot.backToLogin': 'Back to sign in',
  'auth.forgot.sentTitle': 'Link on the way',
  'auth.forgot.sentBody':
    'If that email is registered, a password reset link has been sent. It stays valid for 1 hour.',
  'auth.reset.title': 'Choose a new password',
  'auth.reset.subtitle': 'Updating your password signs you out on all other devices.',
  'auth.reset.submit': 'Update password',
  'auth.reset.missingTitle': 'Link missing',
  'auth.reset.missingBody': 'This page only opens from the reset link in your email.',
  'auth.reset.requestNew': 'Request a new link',
  'auth.verify.working': 'Verifying your email…',
  'auth.verify.doneTitle': 'Email verified ✓',
  'auth.verify.doneBody': 'Your account is fully unlocked. Have fun!',
  'auth.verify.play': 'Start playing',
  'auth.verify.failedTitle': 'Invalid link',
  'auth.verify.failedBody':
    'The verification link has expired or was already used. You can request a fresh one from your account page.',
  'auth.verify.goAccount': 'Go to my account',

  'firstRun.title': 'How to play',
  'firstRun.controlTitle': 'Drag the paddle',
  'firstRun.controlBody':
    'Drag with a finger or the mouse; arrow keys work too. The first move launches the ball, and where it hits the paddle sets its angle.',
  'firstRun.goalTitle': 'Clear the blocks',
  'firstRun.goalBody':
    'Finish the blocks in the level. You have three lives; a ball that falls past the paddle costs one. Bonuses multiply balls, add a shield or lay a net across the floor.',
  'firstRun.progressTitle': 'Collect your progress',
  'firstRun.progressBody':
    'Each level unlocks the next. Daily tasks, the weekly league and the daily challenge add rewards, and your scores follow you across devices.',
  'play.checkingSession': 'Checking your session…',
  'play.account': 'Account',
  'play.signOut': 'Sign out',
  'play.banner.verifySent': 'Verification email sent. Check your inbox.',
  'play.banner.unverified':
    'Your email is not verified yet. Confirm the link in your inbox to protect your account.',
  'play.banner.offlineQueued': '{count} offline runs waiting to sync.',
  'play.banner.offlineSynced': 'Synced {count} offline runs (unranked progress).',
  'play.error.worlds': 'Could not load worlds. Check your connection.',
  'play.error.levels': 'Could not load levels.',
  'play.error.start': 'Could not start the level.',
  'play.world': 'WORLD',
  'play.levelsLoading': 'Loading levels…',
  'play.level.minutes': '~{minutes} min · difficulty {difficulty}',
  'play.level.locked': 'Locked',
  'play.level.lockedHint': 'Finish the previous level',
  'play.level.cleared': 'Cleared',
  'play.level.dailyPlayed':
    'Played as the daily challenge: this level is open, the next one is not',
  'play.level.starting': 'Starting…',
  'play.badge.miniBoss': 'MINI BOSS',
  'play.badge.worldBoss': 'WORLD BOSS',
  'play.badge.daily': 'DAILY',
  'play.badge.community': 'COMMUNITY',
  'play.worldsAria': 'Worlds',
  'play.worldsPrev': 'Previous worlds',
  'play.worldsNext': 'Next worlds',
  'play.levelsAria': 'Levels',

  'game.exit': '← Exit',
  'game.world': 'WORLD',
  'game.pause': 'PAUSE',
  'game.resume': 'RESUME',
  'game.settingsAria': 'Settings',
  'game.hud.score': 'SCORE',
  'game.hud.combo': 'COMBO',
  'game.hud.overcharge': 'OVERCHARGE',
  'game.hud.lives': 'LIVES',
  'game.hud.balls': 'ACTIVE BALLS',
  'game.hud.blocks': 'BLOCKS LEFT',
  'game.hud.time': 'TIME',
  'game.instruction.title': 'MOVE THE PADDLE',
  'game.instruction.body': 'Your first move sets the launch angle.',
  'game.settings.title': 'Display settings',
  'game.settings.quality': 'Graphics quality',
  'game.settings.auto': 'Auto',
  'game.settings.low': 'Low',
  'game.settings.medium': 'Medium',
  'game.settings.high': 'High',
  'game.settings.trails': 'Ball trail',
  'game.settings.reducedMotion': 'Reduced motion',
  'game.settings.sound': 'Sound',
  'game.settings.note': 'Changing quality rebuilds the scene.',
  'game.paused.tag': 'PAUSED',
  'game.paused.title': 'You froze the rhythm.',
  'game.paused.resume': 'Resume',
  'game.over.completed': 'LEVEL COMPLETE',
  'game.over.failed': 'OUT OF ENERGY',
  'game.over.points': '{score} points',
  'game.over.verifying': 'Verifying result…',
  'game.over.submitFailed': 'Could not submit the result',
  'game.over.rejected':
    'The server could not verify this run ({reasons}). The score was not saved.',
  'game.over.rejectedUnknown': 'unknown reason',
  'game.over.credits': '+{count} credits',
  'game.over.crystals': '+{count} crystals',
  'game.over.xp': '+{count} XP',
  'game.over.personalBest': 'Personal best!',
  'game.over.achievement': 'Achievement unlocked: {name}',
  'game.over.backToLevels': 'Back to level list',
  'game.footer.controls': 'DRAG / MOUSE / ← →',
  'game.footer.physics': 'FIXED 120 HZ PHYSICS',
  'game.footer.maxBalls': 'MAX {count} BALLS',
  'game.error.levelData': 'Could not read the level data.',

  'account.backToGame': '← Back to game',
  'account.title': 'Account',
  'account.profile': 'Profile',
  'account.displayName': 'Display name',
  'account.username': 'Username',
  'account.avatar': 'Profile picture',
  'account.avatarChoose': 'Upload a picture',
  'account.avatarRules':
    'PNG, JPEG or WEBP · up to 2 MB · centre-cropped to a square and resized to 256×256.',
  'account.avatarBadType': 'Please choose a PNG, JPEG or WEBP file.',
  'account.avatarTooLarge': 'That file is too large. Choose an image under 10 MB.',
  'account.avatarSaved': 'Your profile picture was updated.',
  'account.avatarRemoved': 'Your profile picture was removed.',
  'account.avatarOwn': 'Your own picture is in use; signing in with Google will not replace it.',
  'account.avatarProvider':
    'Currently using the picture from your Google account. Enter a link here to use your own instead.',
  'account.avatarReset': 'Go back to the Google picture',
  'account.displayNameHint': 'The name other players see. Can be changed once every 7 days.',
  'account.notVerified': 'Not verified',
  'account.usernameHint':
    'Lowercase letters, numbers, dot, dash and underscore. You can change your name once every 7 days.',
  'account.saveProfile': 'Save profile',
  'account.profileSaved': 'Your profile was updated.',
  'account.emailLocked':
    'The email address cannot be changed here; it is the address that owns the account.',
  'account.email': 'Email',
  'account.verified': 'verified',
  'account.sendVerification': 'send verification link',
  'account.verificationSent': 'Verification email sent.',
  'account.verificationUnavailable': 'Could not send: the email service is not configured.',
  'account.password': 'Password',
  'account.currentPassword': 'Current password',
  'account.newPassword': 'New password',
  'account.newPasswordHint': 'At least 10 characters. Saving signs you out on every other device.',
  'account.savePassword': 'Update password',
  'account.passwordChanged': 'Your password was updated and other devices were signed out.',
  'account.providers': 'Linked providers',
  'account.providersNone': 'Email + password only.',
  'account.providersNote':
    'Google/Apple linking appears on the sign-in screen once provider keys are configured.',
  'account.language': 'Language preference',
  'account.languageNote': 'The interface and emails use this language.',
  'account.sessions': 'Active sessions',
  'account.unknownDevice': 'Unknown device',
  'account.thisDevice': 'this device',
  'account.revoke': 'Revoke',
  'account.data': 'Your data',
  'account.export': 'Download all my data (JSON)',
  'account.exportDone': 'Your data was downloaded as JSON.',
  'account.exportFailed': 'Export failed.',
  'account.delete': 'Delete account',
  'account.deleteWarning':
    'This cannot be undone: your personal data is wiped immediately and your scores become anonymous. Type your username to confirm:',
  'account.deleteConfirmAria': 'Deletion confirmation',
  'account.deleteButton': 'Delete account permanently',
  'account.deleteFailed': 'Account deletion failed.',

  'landing.nav.signIn': 'Sign in',
  'landing.nav.register': 'Sign up',
  'landing.hero.eyebrow': 'MODERN BRICK BREAKER',
  'landing.hero.title': 'Master the rebound. Multiply the storm. Break every core.',
  'landing.hero.body':
    '10 worlds, 500 handcrafted levels, boss fights and chain reactions that grow to 500 balls. Deterministic physics means every score is replayed and verified on the server.',
  'landing.hero.cta': 'Play now',
  'landing.stats.worlds': 'worlds',
  'landing.stats.levels': 'levels',
  'landing.stats.balls': 'simultaneous balls',
  'landing.stats.fps': 'fixed physics steps',
  'landing.feature1.title': 'One hand, portrait rhythm',
  'landing.feature1.body':
    'Drag the paddle and pick the angle yourself. Touch, mouse and keyboard share the same precision.',
  'landing.feature2.title': 'Overcharge storm',
  'landing.feature2.body':
    'When you hit the 500-ball cap, surplus energy converts to Overcharge damage; the screen genuinely shatters.',
  'landing.feature3.title': 'Verified scores',
  'landing.feature3.body':
    'Every run is recorded with its inputs and re-simulated server-side with the same seed. Cheats never reach the leaderboards.',
  'landing.feature4.title': 'Daily challenge',
  'landing.feature4.body': 'Everyone plays the same level; the board resets nightly.',
  'landing.feature4.detail':
    'The level is derived from the date, so it is identical for everyone and support can reproduce the same pick.',
  'landing.feature5.title': 'Build your own levels',
  'landing.feature5.body': 'Design on a grid, test it, submit it for review.',
  'landing.feature5.detail':
    'Published levels collect ratings and can be reported; three distinct reports send a level back to review automatically.',
  'landing.feature6.title': 'One account, every device',
  'landing.feature6.body': 'Cloud saves, multi-device and limited offline play.',
  'landing.feature6.detail':
    'Progress lives on the server; offline runs sync as unranked progress when you reconnect and never touch the leaderboards.',
  'landing.feature1.detail':
    'The paddle is ray-cast to sit under your finger; touch, mouse and keyboard share the same precision.',
  'landing.feature2.detail':
    'Bonuses rotate between a single ball, swarms, the safety net, shields, magnets and more; at the 500-ball cap the surplus becomes an Overcharge multiplier.',
  'landing.feature3.detail':
    'The client records inputs and the server re-simulates them with the same seed. A result that does not match never reaches a leaderboard.',
  'landing.footer.licence':
    'The source code is MIT licensed; the brand name, logo, artwork and level designs are not.',
  'landing.footer.version': 'Running version',
  'landing.footer.rights': 'All rights reserved.',
  'landing.footer.privacy': 'Privacy',
  'landing.footer.terms': 'Terms',
  'landing.footer.support': 'Support',
  'hub.play': 'Play',
  'hub.progress': 'Progress',
  'hub.leagues': 'Leagues',
  'hub.social': 'Friends',
  'hub.shop': 'Shop',
  'hub.unread': '{count} unread messages',
  'hub.inbox': 'Inbox',
  'hub.replays': 'Replays',
  'hub.account': 'Account',
  'progress.title': 'Progress',
  'progress.tasks': 'Tasks',
  'progress.achievements': 'Achievements',
  'progress.wallet': 'Wallet',
  'progress.claim': 'Claim reward',
  'progress.claimed': 'Claimed',
  'progress.claimSuccess': 'Reward added to your account.',
  'progress.claimFailed': 'Could not claim the reward.',
  'progress.noTasks': 'No active tasks right now. New tasks refresh daily at 00:00 UTC.',
  'progress.noAchievements': 'No achievements defined yet.',
  'progress.balances': 'Balances',
  'progress.transactions': 'Recent activity',
  'progress.reason': 'Source',
  'progress.amount': 'Amount',
  'progress.date': 'Date',
  'progress.noTransactions': 'No activity yet.',
  'progress.unlocked': 'Unlocked',
  'progress.inProgress': 'In progress',
  'leagues.title': 'Weekly league',
  'leagues.tier': 'Tier',
  'leagues.group': 'Group',
  'leagues.endsAt': 'Ends',
  'leagues.rank': 'Rank',
  'leagues.player': 'Player',
  'leagues.score': 'Score',
  'leagues.you': 'you',
  'leagues.none':
    'You have not joined a league this week yet. Finish a level and you will be placed into a group of 30 automatically.',
  'leagues.global': 'Weekly global board',
  'leagues.emptyBoard': 'No verified scores this week yet.',
  'social.title': 'Friends',
  'social.searchPlaceholder': 'Search username or name',
  'social.search': 'Search',
  'social.follow': 'Follow',
  'social.addFriend': 'Add friend',
  'social.requestSent': 'Friend request sent.',
  'social.followed': 'Now following.',
  'profile.title': 'Player profile',
  'profile.notFound': 'That player was not found, or their profile is hidden.',
  'profile.backToSocial': 'Back to friends',
  'profile.joined': 'Joined {date}',
  'profile.playerLevel': 'Player level',
  'profile.levelsCleared': 'Levels cleared',
  'profile.achievements': 'Achievements',
  'profile.bestWeekly': 'Best weekly score',
  'profile.addFriend': 'Add friend',
  'profile.pending': 'Request sent',
  'profile.incoming': 'Sent you a request',
  'profile.message': 'Send a message',
  'profile.editOwn': 'Edit your profile',
  'profile.requestSent': 'Friend request sent.',
  'social.friends': 'Your friends',
  'social.accept': 'Accept',
  'social.accepted': 'Friendship accepted.',
  'social.message.open': 'Send a message',
  'social.message.cancel': 'Cancel',
  'social.message.label': 'Message to {name}',
  'social.message.hint':
    'Your message lands in their inbox. Moderation never sees the content — only that you wrote to them.',
  'social.message.send': 'Send',
  'social.message.sent': 'Your message was sent.',
  'social.noFriends': 'No friends yet. Search for players above to get started.',
  'social.noResults': 'No matching players.',
  'social.actionFailed': 'Could not complete the action.',
  'shop.title': 'Shop',
  'shop.buy': 'Buy',
  'shop.owned': 'In your inventory',
  'shop.purchased': 'Purchase complete.',
  'shop.purchaseFailed': 'Purchase failed.',
  'shop.paymentsOff':
    'Real-money items stay hidden until a payment provider is configured. Everything sold for in-game currency is listed here.',
  'shop.empty': 'Nothing in the shop right now.',
  'shop.balance': 'Balance',
  'inbox.title': 'Inbox',
  'inbox.announcements': 'Announcements',
  'inbox.notifications': 'Your notifications',
  'inbox.markRead': 'Mark as read',
  'inbox.empty': 'No new notifications.',
  'inbox.noAnnouncements': 'No published announcements right now.',
  'inbox.unread': '{count} unread',
  'replays.title': 'Replays',
  'replays.level': 'Level',
  'replays.score': 'Score',
  'replays.date': 'Date',
  'replays.watch': 'Watch',
  'replays.back': 'Back to replays',
  'replays.notFound': 'That replay was not found, or it is not shared.',
  'replays.liveScore': 'SCORE AS PLAYED',
  'replays.recordedScore': 'RECORDED SCORE',
  'replays.playbackFinished': 'Replay finished.',
  'replays.playbackFailed': 'This replay could not be played; the recording may be damaged.',
  'replays.share': 'Share',
  'replays.unshare': 'Stop sharing',
  'replays.shared': 'shared',
  'replays.empty': 'No saved replays yet. Every verified run is stored automatically.',
  'replays.verifiedNote':
    'Replays are the input recordings the server uses to verify your score; friends can watch the ones you share.',
  'create.title': 'Design a level',
  'create.hubTab': 'Create',
  'create.intro':
    'Design your own level, test it and submit it for review. Approved levels appear in the community tab for everyone.',
  'create.new': '+ New level',
  'create.name': 'Level name',
  'create.theme': 'Theme',
  'create.grid': 'Grid',
  'create.brush': 'Brush',
  'create.erase': 'Erase',
  'create.blocks': '{count} blocks',
  'create.required': 'Required objective',
  'create.hitPoints': 'Hit points',
  'create.save': 'Save draft',
  'create.saved': 'Draft saved.',
  'create.test': 'Test play',
  'create.submit': 'Submit for review',
  'create.submitted': 'Level submitted for review.',
  'create.delete': 'Delete',
  'create.deleted': 'Level deleted.',
  'create.cancel': 'Cancel',
  'create.empty': 'No levels yet. Create one above.',
  'create.limit': '{used}/{limit} levels',
  'create.limitReached': 'You reached the level limit. Delete a draft to make room.',
  'create.needBlocks': 'Place at least 5 blocks.',
  'create.needName': 'Enter a name of at least 3 characters.',
  'create.status.DRAFT': 'Draft',
  'create.status.REVIEW': 'In review',
  'create.status.PUBLISHED': 'Published',
  'create.status.REJECTED': 'Rejected',
  'create.status.ARCHIVED': 'Archived',
  'create.editLocked': 'Levels in review or published cannot be edited.',
  'create.failed': 'Could not complete the action.',
  'create.sortTop': 'Most liked',
  'create.sortNew': 'Newest',
  'create.community': 'Community levels',
  'create.communityEmpty': 'No published community levels yet.',
  'create.by': 'by',
  'create.play': 'Play',
  'create.edit': 'Edit',
  'daily.title': 'Daily challenge',
  'daily.subtitle': 'Everyone plays the same level. The daily board resets every night.',
  'daily.play': 'Play the daily level',
  'daily.myBest': 'Your score today',
  'daily.notPlayed': 'You have not played today',
  'daily.board': "Today's board",
  'daily.empty': 'No scores yet today. Be the first.',
  'daily.rank': 'Rank',
  'daily.player': 'Player',
  'daily.score': 'Score',
  'daily.unavailable': 'The daily level is being prepared.',
  'daily.noUnlock':
    'The daily challenge unlocks only the level you played; it never opens the next one.',
  'daily.replayTitle': 'Play it again?',
  'daily.replayBody':
    'You finished today with {score} points. Replaying only updates your daily score if you beat it.',
  'daily.replayConfirm': 'Yes, play again',
  'daily.replayCancel': 'Cancel',
  'daily.replayAck': 'I understand this run will not unlock the next level.',
  'auth.or': 'or',
  'auth.google.pending': 'Verifying your Google account…',
  'auth.google.continue': 'Continue with Google',
  'landing.auth.welcomeBack': 'Welcome back, {name}.',
  'landing.auth.registerCta': "Don't have an account? Sign up",
  'landing.auth.noAccount': 'No account yet?',
  'landing.auth.guestPeek': 'Browse the levels first',
  'auth.google.unavailable':
    'Google sign-in is not configured on this deployment yet. Please continue with email and password.',
  'auth.verify.codeTitle': 'Verify your email',
  'auth.verify.codeBody':
    'We sent a 6-digit verification code to {email}. It stays valid for 30 minutes.',
  'auth.verify.codeLabel': 'Verification code',
  'auth.verify.codeSubmit': 'Verify code',
  'auth.verify.codeInvalid': 'That code is wrong or expired. You can request a new one.',
  'auth.verify.resend': 'Send a new code',
  'auth.verify.resent': 'A new code was sent. Check your inbox.',
  'auth.verify.resendUnavailable': 'Could not send because the email service is not configured.',
  'auth.verify.emailMissing': 'No email address to verify.',
  'auth.verify.later': 'Verify later',
  'create.like': 'Like',
  'create.dislike': 'Dislike',
  'create.rated': 'Your rating was saved.',
  'create.rateOwn': 'You cannot rate your own level.',
  'create.report': 'Report',
  'create.reportReason': 'Report reason',
  'create.reportSent': 'Your report was sent to moderation.',
  'create.reportDuplicate': 'You already reported this level.',
  'create.reason.ABUSE': 'Harassment / abuse',
  'create.reason.SPAM': 'Spam',
  'create.reason.INAPPROPRIATE': 'Inappropriate content',
  'create.reason.CHEATING': 'Cheating / broken level',
  'create.reason.OTHER': 'Other',
  'create.autoHidden': 'Enough reports were gathered; the level went back to review.',
  'create.mine': 'your level',
  'theme.label': 'Appearance',
  'theme.toDay': 'Switch to light mode',
  'theme.toNight': 'Switch to dark mode',
  'theme.note': 'Night mode brings the playfield violets into the rest of the interface.',
  'a11y.skip': 'Skip to content',
  'notFound.title': 'This page could not be found',
  'notFound.body': 'The link may be outdated or mistyped. You can continue from the home page.',
  'notFound.home': 'Back to home',
  'notFound.play': 'Continue playing',
  'error.title': 'Something went wrong',
  'error.body': 'An unexpected error occurred. You can try again or head back to the home page.',
  'error.retry': 'Try again',
};

export const dictionaries: Record<Locale, Record<TranslationKey, string>> = { tr, en };

/**
 * Resolution order: ?lang= (so hreflang URLs and shared links really work) →
 * stored choice → browser language.
 */
export const detectLocale = (): Locale => {
  if (typeof window === 'undefined') return 'tr';
  try {
    const requested = new URLSearchParams(window.location.search).get('lang');
    if (requested === 'tr' || requested === 'en') return requested;
  } catch {
    /* malformed URL */
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'tr' || stored === 'en') return stored;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
};

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale, options?: { persistRemote?: boolean }) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nState | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('tr');

  // Resolve after mount so server and client render the same initial markup.
  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let text: string = dictionaries[locale][key];
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
      }
      return text;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside LocaleProvider');
  return context;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  return (
    <div className={`lang-switch ${compact ? 'compact' : ''}`} role="group" aria-label="Language">
      {(['tr', 'en'] as const).map((option) => (
        <button
          key={option}
          type="button"
          className={locale === option ? 'active' : ''}
          onClick={() => setLocale(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
