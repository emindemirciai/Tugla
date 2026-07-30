#!/usr/bin/env node
/**
 * Builds a single self-contained HTML preview of the product UI.
 *
 * The screens below are rendered inside isolated iframes using the *real*
 * compiled stylesheets from the Next.js production builds, so what you see is
 * the shipped design system rather than a hand-drawn mockup. The data shown is
 * clearly labelled sample data — the preview never calls the API.
 *
 * Usage: pnpm build:preview   (run after `pnpm build`)
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const readCss = async (app) => {
  const dir = join(root, 'apps', app, '.next', 'static', 'css');
  try {
    const files = await readdir(dir);
    const parts = await Promise.all(
      files
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFile(join(dir, file), 'utf8')),
    );
    return parts.join('\n');
  } catch {
    console.error(`! ${app} CSS bundle not found — run "pnpm build" first.`);
    return '';
  }
};

const webCss = await readCss('web');
const adminCss = await readCss('admin');
const appName = process.env.APP_NAME ?? 'Tuğla';

const screens = `[
  {
    id: 'landing',
    app: 'web',
    title: L('Açılış sayfası', 'Landing page'),
    note: L('Marka adı ve tüm metinler environment + sözlük üzerinden gelir.',
            'Brand name and all copy come from environment variables and the dictionary.'),
    height: 620,
    html: \`
      <main class="landing">
        <nav class="nav shell">
          <a class="brand" href="#"><span class="brand-mark"></span>\${APP}</a>
          <div class="nav-links">
            <a href="#">\${L('Giriş yap','Sign in')}</a><a href="#">\${L('Kayıt ol','Create account')}</a>
            <span class="lang-switch"><button class="\${TR}">TR</button><button class="\${EN}">EN</button></span>
          </div>
          <a class="button button-quiet" href="#">\${L('Oyna','Play')}</a>
        </nav>
        <section class="hero shell">
          <div class="hero-copy">
            <span class="eyebrow">\${L('MODERN TUĞLA KIRMA','MODERN BRICK BREAKER')}</span>
            <h1>\${L('Ritmi yakala. Fırtınayı çoğalt. Her çekirdeği kır.','Master the rebound. Multiply the storm. Break every core.')}</h1>
            <p>\${L('10 dünya, 500 bölüm, boss savaşları ve 500 topa kadar zincir reaksiyonlar. Her skor sunucuda yeniden oynatılarak doğrulanır.','10 worlds, 500 levels, boss fights and chain reactions up to 500 balls. Every score is verified by re-simulation on the server.')}</p>
            <div class="hero-actions">
              <a class="button button-primary" href="#">\${L('Hemen oyna','Play now')} ↗</a>
              <a class="button button-quiet" href="#">\${L('Hesap oluştur','Create account')}</a>
            </div>
            <div class="trust-row"><span>WEB</span><span>PWA</span><span>ANDROID</span><span>iOS</span></div>
          </div>
          <div class="hero-visual">
            <div class="orb orb-one"></div><div class="orb orb-two"></div>
            <div class="game-preview">
              <div class="preview-hud"><span>WORLD 01</span><strong>LEVEL 24</strong><span>♥ 5</span></div>
              <div class="preview-grid">\${blocks(35)}</div>
              <div class="preview-balls">\${balls(18)}</div>
              <div class="preview-paddle"></div>
            </div>
          </div>
        </section>
        <section class="stats shell">
          <article><strong>10</strong><h2>\${L('dünya','worlds')}</h2></article>
          <article><strong>500</strong><h2>\${L('bölüm','levels')}</h2></article>
          <article><strong>500</strong><h2>\${L('eşzamanlı top','simultaneous balls')}</h2></article>
          <article><strong>120 Hz</strong><h2>\${L('sabit fizik adımı','fixed physics step')}</h2></article>
        </section>
      </main>\`,
  },
  {
    id: 'auth',
    app: 'web',
    title: L('Giriş ekranı', 'Sign-in screen'),
    note: L('Misafir hesap yok: e-posta + parola, Google ve Apple sağlayıcı anahtarları girildiğinde görünür.',
            'No guest accounts: email + password, with Google/Apple appearing once provider keys are set.'),
    height: 520,
    html: \`
      <main class="auth-page">
        <div class="auth-card">
          <div class="auth-card-top">
            <a class="brand" href="#"><span class="brand-mark">◇</span>\${APP}</a>
            <span class="lang-switch compact"><button class="\${TR}">TR</button><button class="\${EN}">EN</button></span>
          </div>
          <h1>\${L('Tekrar hoş geldin','Welcome back')}</h1>
          <p class="auth-subtitle">\${L('Kaldığın dünyadan devam et; ilerlemen tüm cihazlarında seninle.','Pick up where you left off — your progress follows you on every device.')}</p>
          <form>
            <label class="auth-field"><span>\${L('E-posta','Email')}</span><input value="player@example.com"></label>
            <label class="auth-field"><span>\${L('Parola','Password')}</span><input type="password" value="••••••••••"></label>
            <button class="button button-primary auth-submit">\${L('Giriş yap','Sign in')}</button>
          </form>
          <div class="auth-footer">
            <a href="#">\${L('Parolanı mı unuttun?','Forgot your password?')}</a>
            <span>\${L('Hesabın yok mu?','No account yet?')} <a href="#">\${L('Kayıt ol','Create one')}</a></span>
            <small class="provider-note">\${L('Google / Apple ile giriş, sağlayıcı anahtarları yapılandırıldığında burada görünür.','Google / Apple sign-in appears here once provider keys are configured.')}</small>
          </div>
        </div>
      </main>\`,
  },
  {
    id: 'hub',
    app: 'web',
    title: L('Bölüm seçimi', 'Level hub'),
    note: L('Dünya şeridi ve bölüm ızgarası API’den gelir; mini boss ve dünya bossu rozetleri bölüm türünden türetilir.',
            'World strip and level grid come from the API; mini-boss and world-boss badges derive from level type.'),
    height: 620,
    html: \`
      <main class="hub-page">
        <header class="nav">
          <a class="brand" href="#"><span class="brand-mark">◇</span>\${APP}</a>
          <nav class="nav-links">
            <span class="lang-switch compact"><button class="\${TR}">TR</button><button class="\${EN}">EN</button></span>
            <a href="#">Ada Yılmaz</a><button class="button-quiet">\${L('Çıkış','Sign out')}</button>
          </nav>
        </header>
        \${tabs(0)}
        <section class="world-strip">
          \${['neon-grid','crystal-core','solar-forge','dark-matter','singularity'].map((theme,i)=>
            '<button class="world-chip world-'+theme+' '+(i===0?'active':'')+'"><span>'+L('DÜNYA','WORLD')+' 0'+(i+1)+'</span><strong>'+theme.replace('-',' ')+'</strong></button>').join('')}
        </section>
        <section class="level-grid">
          \${[1,2,3,4,5,6,7,8,9,10].map((n)=>{
            const boss = n===10;
            return '<button class="level-card '+(boss?'level-mini_boss':'')+'">'+
              '<span class="level-number">'+n+'</span>'+
              (boss?'<span class="level-badge">'+L('MİNİ BOSS','MINI BOSS')+'</span>':'')+
              '<span class="level-name">'+L('Neon Izgara ','Neon Grid ')+n+'</span>'+
              '<span class="level-meta">~'+(1+n%3)+' '+L('dk · zorluk','min · difficulty')+' '+(2+n)+'</span></button>';
          }).join('')}
        </section>
      </main>\`,
  },
  {
    id: 'game',
    app: 'web',
    title: L('Oyun ekranı (HUD)', 'In-game screen (HUD)'),
    note: L('Gerçek oyunda orta alan Three.js sahnesidir; burada HUD, ayar paneli ve sonuç katmanı gösteriliyor.',
            'In the real game the centre is a live Three.js scene; shown here are the HUD, settings panel and result overlay.'),
    height: 640,
    html: \`
      <main class="game-shell">
        <header class="game-topbar">
          <button class="icon-button">\${L('← Çıkış','← Exit')}</button>
          <div class="game-brand"><span>\${L('DÜNYA','WORLD')} 03 · SOLAR FORGE</span><strong>\${L('Erimiş Çekirdek','Molten Core')}</strong></div>
          <div class="game-controls"><button>⚙</button><button>\${L('DURAKLAT','PAUSE')}</button></div>
        </header>
        <div class="game-stage">
          <aside class="hud-panel">
            <span>\${L('SKOR','SCORE')}</span><strong>184,920</strong>
            <span>\${L('KOMBO','COMBO')}</span><strong class="accent">×7</strong>
            <span>OVERCHARGE</span><strong class="overcharge">×1.35</strong>
          </aside>
          <div class="canvas-frame">
            <div class="game-canvas" style="background:radial-gradient(circle at 50% 30%,rgba(45,217,255,.18),transparent 60%),#040d18"></div>
            <div class="game-overlay">
              <span>\${L('BÖLÜM TAMAMLANDI','LEVEL COMPLETE')}</span>
              <h1>184,920 \${L('puan','points')}</h1>
              <ul class="reward-list">
                <li>+240 \${L('kredi','credits')}</li><li>+12 \${L('kristal','crystals')}</li><li>+310 XP</li>
                <li class="accent">\${L('Kişisel rekor!','Personal best!')}</li>
              </ul>
              <button class="button button-primary">\${L('Bölüm listesine dön','Back to level list')}</button>
            </div>
          </div>
          <aside class="hud-panel hud-panel-right">
            <span>\${L('CAN','LIVES')}</span><strong>♥♥♥♥♥</strong>
            <span>\${L('AKTİF TOP','ACTIVE BALLS')}</span><strong class="accent">327</strong>
            <span>\${L('KALAN BLOK','BLOCKS LEFT')}</span><strong>0</strong>
          </aside>
        </div>
        <footer class="game-footer">
          <span>\${L('SÜRÜKLE / FARE / ← →','DRAG / MOUSE / ← →')}</span>
          <span>\${L('SABİT 120 HZ FİZİK','FIXED 120 HZ PHYSICS')}</span>
          <span>\${L('MAKS 500 TOP','MAX 500 BALLS')}</span>
        </footer>
      </main>\`,
  },
  {
    id: 'progress',
    app: 'web',
    title: L('İlerleme: görevler, başarımlar, cüzdan', 'Progress: tasks, achievements, wallet'),
    note: L('Ödüller yalnızca sunucu doğrulaması sonrası talep edilebilir; cüzdan defteri her hareketi gösterir.',
            'Rewards are claimable only after server verification; the wallet ledger lists every movement.'),
    height: 620,
    html: \`
      <main class="hub-page">
        \${tabs(1)}
        <h1 class="hub-title">\${L('İlerleme','Progress')}</h1>
        <div class="segmented"><button class="active">\${L('Görevler','Tasks')}</button><button>\${L('Başarımlar','Achievements')}</button><button>\${L('Cüzdan','Wallet')}</button></div>
        <ul class="card-list">
          \${[[L('120 blok kır','Break 120 blocks'),'DAILY',96,120,'+150 CREDITS'],
             [L('3 bölüm tamamla','Finish 3 levels'),'DAILY',3,3,'+200 CREDITS'],
             [L('Haftalık 25.000 puan','25,000 points this week'),'WEEKLY',18400,25000,'+40 CRYSTALS']].map((t)=>
            '<li class="card"><div class="card-head"><strong>'+t[0]+'</strong><span class="tag">'+t[1]+'</span></div>'+
            '<div class="progress-bar"><i style="width:'+Math.min(100,(t[2]/t[3])*100)+'%"></i></div>'+
            '<div class="card-foot"><span class="muted">'+t[2]+'/'+t[3]+' · '+t[4]+'</span>'+
            (t[2]>=t[3]?'<button class="button">'+L('Ödülü al','Claim reward')+'</button>':'<span class="tag">'+L('Devam ediyor','In progress')+'</span>')+
            '</div></li>').join('')}
        </ul>
        <h2 class="hub-section">\${L('Bakiyeler','Balances')}</h2>
        <div class="balance-row">
          <div class="balance-chip"><strong>4,820</strong><span>CREDITS</span></div>
          <div class="balance-chip"><strong>236</strong><span>CRYSTALS</span></div>
        </div>
      </main>\`,
  },
  {
    id: 'leagues',
    app: 'web',
    title: L('Haftalık lig', 'Weekly league'),
    note: L('30 kişilik gruplar ISO hafta anahtarıyla açılır, kapanış zamanlanmış görevle yapılır.',
            'Groups of 30 open per ISO week and settle through a scheduled job.'),
    height: 560,
    html: \`
      <main class="hub-page">
        \${tabs(2)}
        <h1 class="hub-title">\${L('Haftalık lig','Weekly league')}</h1>
        <div class="balance-row">
          <div class="balance-chip"><strong>GOLD</strong><span>\${L('Kademe','Tier')}</span></div>
          <div class="balance-chip"><strong>#7</strong><span>\${L('Grup','Group')}</span></div>
          <div class="balance-chip"><strong>02.08.2026</strong><span>\${L('Bitiş','Ends')}</span></div>
        </div>
        <table class="hub-table">
          <thead><tr><th>\${L('Sıra','Rank')}</th><th>\${L('Oyuncu','Player')}</th><th>\${L('Skor','Score')}</th></tr></thead>
          <tbody>
            \${[['1','Mira Kaya','412,880',''],['2','J. Novak','388,140',''],['3','Ada Yılmaz','355,020','self-row'],['4','K. Adeyemi','341,700',''],['5','L. Rossi','299,410','']].map((r)=>
              '<tr class="'+r[3]+'"><td>'+r[0]+'</td><td>'+r[1]+(r[3]?' <span class="tag tag-ok">'+L('sen','you')+'</span>':'')+'</td><td>'+r[2]+'</td></tr>').join('')}
          </tbody>
        </table>
      </main>\`,
  },
  {
    id: 'shop',
    app: 'web',
    title: L('Mağaza', 'Shop'),
    note: L('Gerçek para ürünleri, ödeme sağlayıcısı yapılandırılana kadar API tarafından gizlenir — sahte satın alma yoktur.',
            'Real-money items are hidden by the API until a payment provider is configured — there are no fake purchases.'),
    height: 560,
    html: \`
      <main class="hub-page">
        \${tabs(4)}
        <h1 class="hub-title">\${L('Mağaza','Shop')}</h1>
        <div class="balance-row"><div class="balance-chip"><strong>4,820</strong><span>CREDITS</span></div><div class="balance-chip"><strong>236</strong><span>CRYSTALS</span></div></div>
        <p class="loading-note">\${L('Gerçek para ürünleri, ödeme sağlayıcısı yapılandırılana kadar listelenmez.','Real-money items stay hidden until a payment provider is configured.')}</p>
        <ul class="card-list">
          \${[[L('Aurora izi','Aurora trail'),'EPIC','120 CRYSTALS',false],
             [L('Prizma platform','Prism paddle'),'RARE','900 CREDITS',false],
             [L('Nova patlaması','Nova burst'),'LEGENDARY','260 CRYSTALS',true]].map((i)=>
            '<li class="card"><div class="card-head"><strong>'+i[0]+'</strong><span class="tag rarity-'+String(i[1]).toLowerCase()+'">'+i[1]+'</span></div>'+
            '<div class="card-foot"><span class="accent">'+i[2]+'</span>'+
            (i[3]?'<span class="tag tag-ok">'+L('Envanterinde','In your inventory')+'</span>':'<button class="button">'+L('Satın al','Buy')+'</button>')+'</div></li>').join('')}
        </ul>
      </main>\`,
  },
  {
    id: 'admin',
    app: 'admin',
    title: L('Yönetim paneli — genel bakış', 'Admin panel — overview'),
    note: L('15 modülün tamamı gerçek uç noktalara bağlıdır; her yazma işlemi audit log’a düşer.',
            'All 15 modules are wired to real endpoints; every write lands in the audit log.'),
    height: 600,
    html: \`
      <div class="admin-shell">
        <aside class="admin-sidebar">
          <div class="admin-brand"><span class="brand-mark">◇</span><div><strong>\${APP}</strong><span>\${L('YÖNETİM','ADMIN')}</span></div></div>
          <nav>
            \${[[L('Genel bakış','Overview'),1],[L('Bölümler ve dünyalar','Levels & worlds'),0],[L('Kullanıcılar','Users'),0],[L('Moderasyon','Moderation'),0],[L('Destek talepleri','Support tickets'),0],[L('Görevler','Tasks'),0],[L('Başarımlar','Achievements'),0],[L('Mağaza ve ekonomi','Shop & economy'),0],[L('Ligler','Leagues'),0],[L('Sezonlar','Seasons'),0],[L('Duyurular','Announcements'),0],['Feature flags',0],[L('Analitik','Analytics'),0],['Audit log',0],[L('Sistem sağlığı','System health'),0]]
              .map((n)=>'<a class="'+(n[1]?'active':'')+'">'+n[0]+'</a>').join('')}
          </nav>
          <span class="lang-switch"><button class="\${TR}">TR</button><button class="\${EN}">EN</button></span>
          <footer><span>Ops Lead<small>SUPER_ADMIN</small></span><button>\${L('Çıkış','Sign out')}</button></footer>
        </aside>
        <main class="admin-main">
          <header class="admin-header"><h1>\${L('Genel bakış','Overview')}</h1><span class="admin-env">production</span></header>
          <div class="admin-content">
            <div class="stat-grid">
              \${[['12,480',L('Aktif kullanıcı','Active users')],['864',L('Bu hafta yeni kayıt','New sign-ups this week')],['3,271',L('Bugün oynayan','Played today')],['18,905',L('Son 24 saat oturum','Sessions (24h)')],['500',L('Yayında bölüm','Published levels')],['4',L('Açık moderasyon','Open reports')],['9',L('Açık destek talebi','Open tickets')],['11',L('Bu hafta şüpheli oturum','Flagged sessions this week')]]
                .map((c)=>'<div class="stat-card"><strong>'+c[0]+'</strong><span>'+c[1]+'</span></div>').join('')}
            </div>
          </div>
        </main>
      </div>\`,
  },
  {
    id: 'admin-users',
    app: 'admin',
    title: L('Yönetim paneli — kullanıcılar', 'Admin panel — users'),
    note: L('Ban, rol değişimi ve bakiye düzeltmeleri gerçek uç noktaları çağırır ve gerekçe ister.',
            'Bans, role changes and balance adjustments call real endpoints and require a reason.'),
    height: 480,
    html: \`
      <div class="admin-shell">
        <main class="admin-main">
          <header class="admin-header"><h1>\${L('Kullanıcı yönetimi','User management')}</h1><span class="admin-env">production</span></header>
          <div class="admin-content">
            <div class="admin-toolbar"><input placeholder="\${L('E-posta, kullanıcı adı veya isim ara','Search email, username or name')}"><button>\${L('Ara','Search')}</button></div>
            <div class="table-wrap"><table class="admin-table">
              <thead><tr><th>\${L('Kullanıcı','User')}</th><th>\${L('Rol','Role')}</th><th>\${L('Durum','Status')}</th><th>\${L('Risk','Risk')}</th><th>\${L('İşlemler','Actions')}</th></tr></thead>
              <tbody>
                \${[['Ada Yılmaz','ada','PLAYER','ACTIVE','4'],['Mira Kaya','mira','CONTENT_EDITOR','ACTIVE','0'],['J. Novak','jnovak','PLAYER','SUSPENDED','82']].map((u)=>
                  '<tr><td><strong>'+u[0]+'</strong><div class="admin-sub">@'+u[1]+' · '+u[1]+'@example.com</div></td><td>'+u[2]+'</td>'+
                  '<td><span class="tag tag-'+String(u[3]).toLowerCase()+'">'+u[3]+'</span></td><td>'+u[4]+'</td>'+
                  '<td><div class="admin-actions"><button>'+(u[3]==='SUSPENDED'?L('Banı kaldır','Unban'):L('Banla','Ban'))+'</button><button>'+L('Kredi ver','Grant credits')+'</button></div></td></tr>').join('')}
              </tbody>
            </table></div>
          </div>
        </main>
      </div>\`,
  },
  {
    id: 'seo',
    app: 'web',
    title: L('SEO / GEO / AEO çıktıları', 'SEO / GEO / AEO artefacts'),
    note: L('Bu dosyalar canlı sunucudan üretilir; buradaki alan adı örnektir ve WEB_URL değişkeninden gelir.',
            'These files are generated by the live server; the domain here is an example and comes from WEB_URL.'),
    height: 560,
    html: '<main class="hub-page"><h1 class="hub-title">' + L('Keşfedilebilirlik','Discoverability') + '</h1>' +
      '<ul class="card-list">' +
      '<li class="card"><div class="card-head"><strong>/robots.txt</strong><span class="tag tag-ok">' + L('canlı','live') + '</span></div>' +
      '<p class="muted" style="font-family:ui-monospace,monospace;font-size:.78rem;line-height:1.7">' +
      'User-Agent: *<br>Allow: /<br>Disallow: /account, /play, /progress, …<br><br>User-Agent: GPTBot, ClaudeBot, PerplexityBot, …<br>Allow: /<br><br>Sitemap: https://example.com/sitemap.xml</p></li>' +
      '<li class="card"><div class="card-head"><strong>/llms.txt</strong><span class="tag tag-ok">TR + EN</span></div>' +
      '<p class="muted">' + L('Yanıt motorları için kısa, doğrulanmış özet: temel bilgiler, sayfalar ve 6 sık sorulan soru. ?lang=en ile İngilizce sürüm.','A short, accurate summary for answer engines: key facts, pages and six FAQ entries. ?lang=en returns the English edition.') + '</p></li>' +
      '<li class="card"><div class="card-head"><strong>JSON-LD @graph</strong><span class="tag rarity-rare">schema.org</span></div>' +
      '<p class="muted">Organization · WebSite · VideoGame + SoftwareApplication · FAQPage (' + L('6 soru','6 questions') + ')</p></li>' +
      '<li class="card"><div class="card-head"><strong>hreflang</strong><span class="tag rarity-rare">tr / en / x-default</span></div>' +
      '<p class="muted">' + L('?lang=tr ve ?lang=en adresleri gerçekten o dilde açılır; sitemap her sayfa için iki dili birden bildirir.','?lang=tr and ?lang=en really open in that language; the sitemap declares both for every page.') + '</p></li>' +
      '<li class="card"><div class="card-head"><strong>/opengraph-image</strong><span class="tag rarity-epic">1200×630 PNG</span></div>' +
      '<p class="muted">' + L('Marka değerlerinden üretilir; yeniden adlandırmada yeni görsel gerekmez.','Generated from the brand values; a rename needs no new artwork.') + '</p></li>' +
      '</ul></main>',
  },
]`;

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${appName} — UI preview</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; background:#f6f3ff; color:#1b1533; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  header.page { padding:28px 20px 12px; max-width:1180px; margin:0 auto; display:flex; flex-wrap:wrap; gap:14px; align-items:center; justify-content:space-between; }
  header.page h1 { margin:0; font-size:1.5rem; }
  header.page p { margin:6px 0 0; color:#6a6390; max-width:720px; line-height:1.55; font-size:.92rem; }
  .switch { display:inline-flex; gap:6px; }
  .switch button { background:#ffffff; border:1px solid #cec2ef; color:#423a63; border-radius:9px; padding:8px 14px; cursor:pointer; font-size:.8rem; letter-spacing:.08em; }
  .switch button.active { background:#5b4be1; color:#ffffff; border-color:#5b4be1; }
  main.grid { max-width:1180px; margin:0 auto; padding:12px 20px 64px; display:flex; flex-direction:column; gap:26px; }
  section.screen { border:1px solid #e2daf6; border-radius:18px; overflow:hidden; background:#ffffff; box-shadow:0 10px 30px rgba(43,25,96,.08); }
  section.screen > h2 { margin:0; padding:14px 18px 4px; font-size:1rem; }
  section.screen > p { margin:0; padding:0 18px 12px; color:#6a6390; font-size:.85rem; line-height:1.5; }
  iframe { width:100%; border:0; display:block; background:#f6f3ff; }
  footer.page { max-width:1180px; margin:0 auto; padding:0 20px 60px; color:#6a6390; font-size:.8rem; line-height:1.6; }
</style>
</head>
<body>
<header class="page">
  <div>
    <h1>${appName} — <span data-i18n="title"></span></h1>
    <p data-i18n="intro"></p>
  </div>
  <div class="switch">
    <button id="btn-tr">TR</button><button id="btn-en">EN</button>
    <span style="width:14px"></span>
    <button id="btn-day">☀</button><button id="btn-night">☾</button>
  </div>
</header>
<main class="grid" id="grid"></main>
<footer class="page" data-i18n="footer"></footer>

<script>
const WEB_CSS = ${JSON.stringify(webCss)};
const ADMIN_CSS = ${JSON.stringify(adminCss)};
const APP = ${JSON.stringify(appName)};
let lang = (navigator.language || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en';
let theme = 'day';

const L = (tr, en) => (lang === 'tr' ? tr : en);
const blocks = (n) => Array.from({ length: n }, (_, i) => '<span class="preview-block tone-' + ((i + Math.floor(i / 7)) % 5) + '"></span>').join('');
const balls = (n) => Array.from({ length: n }, (_, i) => '<i style="--i:' + i + '"></i>').join('');
const tabs = (active) => {
  const items = [['▶', L('Oyna','Play')], ['◈', L('İlerleme','Progress')], ['♜', L('Ligler','Leagues')], ['♙', L('Arkadaşlar','Friends')], ['◇', L('Mağaza','Shop')], ['✉', L('Bildirimler','Inbox')], ['⟲', L('Tekrarlar','Replays')]];
  return '<div class="hub-tabs">' + items.map((it, i) => '<a class="' + (i === active ? 'active' : '') + '"><span>' + it[0] + '</span>' + it[1] + '</a>').join('') + '</div>';
};

function render() {
  const TR = lang === 'tr' ? 'active' : '';
  const EN = lang === 'en' ? 'active' : '';
  document.documentElement.lang = lang;
  document.getElementById('btn-tr').className = TR;
  document.getElementById('btn-en').className = EN;
  document.getElementById('btn-day').className = theme === 'day' ? 'active' : '';
  document.getElementById('btn-night').className = theme === 'night' ? 'active' : '';
  document.body.style.background = theme === 'night' ? '#14102b' : '#f6f3ff';
  document.body.style.color = theme === 'night' ? '#f2eeff' : '#1b1533';
  document.querySelector('[data-i18n="title"]').textContent = L('arayüz önizlemesi', 'UI preview');
  document.querySelector('[data-i18n="intro"]').textContent = L(
    'Bu dosya, üretim derlemesinden alınan gerçek CSS paketleriyle oluşturulmuş statik bir arayüz önizlemesidir. Ekranlardaki veriler örnektir; hiçbir API çağrısı yapılmaz.',
    'This file is a static UI preview built from the real CSS bundles of the production build. The data shown is sample data; no API calls are made.');
  document.querySelector('[data-i18n="footer"]').textContent = L(
    'Canlı sürümü çalıştırmak için: pnpm install → pnpm build:packages → pnpm db:migrate → pnpm db:seed → API ve web/admin uygulamalarını başlat. Ayrıntılar README dosyasında.',
    'To run the live version: pnpm install → pnpm build:packages → pnpm db:migrate → pnpm db:seed → start the API and the web/admin apps. Details are in the README.');

  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const list = eval(SCREENS);
  for (const screen of list) {
    const section = document.createElement('section');
    section.className = 'screen';
    section.innerHTML = '<h2>' + screen.title + '</h2><p>' + screen.note + '</p>';
    const frame = document.createElement('iframe');
    frame.style.height = screen.height + 'px';
    frame.title = screen.title;
    section.appendChild(frame);
    grid.appendChild(section);
    const doc = frame.contentDocument;
    doc.open();
    doc.write('<!doctype html><html lang="' + lang + '" data-theme="' + theme + '"><head><meta charset="utf-8"><style>' +
      (screen.app === 'admin' ? ADMIN_CSS : WEB_CSS) +
      'body{margin:0;overflow:hidden}</style></head><body>' + screen.html + '</body></html>');
    doc.close();
  }
}

const SCREENS = ${JSON.stringify(screens)};
document.getElementById('btn-tr').onclick = () => { lang = 'tr'; render(); };
document.getElementById('btn-en').onclick = () => { lang = 'en'; render(); };
document.getElementById('btn-day').onclick = () => { theme = 'day'; render(); };
document.getElementById('btn-night').onclick = () => { theme = 'night'; render(); };
render();
</script>
</body>
</html>`;

const outDir = process.env.PREVIEW_OUT ?? join(root, 'preview');
await mkdir(outDir, { recursive: true });
const target = join(outDir, 'ui-preview.html');
await writeFile(target, html, 'utf8');
console.log(`Preview written: ${target} (${(html.length / 1024).toFixed(0)} KB)`);
