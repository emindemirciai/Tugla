import Link from 'next/link';

const features = [
  { number: '500', label: 'tasarlanmış bölüm', detail: '10 enerji dünyasında dengeli ilerleme.' },
  {
    number: '500×',
    label: 'aktif top kapasitesi',
    detail: 'Cihaza uyarlanan instanced rendering.',
  },
  { number: '∞', label: 'topluluk bölümü', detail: 'Tasarla, doğrula ve arkadaşlarınla paylaş.' },
];

export default function HomePage() {
  return (
    <main className="landing">
      <nav className="nav shell">
        <Link className="brand" href="/" aria-label="Pulse ana sayfa">
          <span className="brand-mark" />
          PULSE
        </Link>
        <div className="nav-links">
          <a href="#worlds">Dünyalar</a>
          <a href="#systems">Sistemler</a>
          <Link href="/support">Destek</Link>
        </div>
        <Link className="button button-quiet" href="/play">
          Oyuna gir
        </Link>
      </nav>

      <section className="hero shell">
        <div className="hero-copy">
          <span className="eyebrow">2.5D ARCADE · TEK ELLE OYNANIŞ</span>
          <h1>
            Yansımayı yönet.
            <br />
            <span>Fırtınayı çoğalt.</span>
          </h1>
          <p>
            Tek topla başla. Enerji kapsüllerini yakala, yüzlerce topu serbest bırak ve bozulmuş
            çekirdekleri parçala.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/play">
              Ücretsiz oyna <span aria-hidden>↗</span>
            </Link>
            <a className="button button-quiet" href="#systems">
              Nasıl çalışır
            </a>
          </div>
          <div className="trust-row">
            <span>WEB</span>
            <span>PWA</span>
            <span>ANDROID</span>
            <span>iOS</span>
            <span>PAY-TO-WIN YOK</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Pulse oyun alanı önizlemesi">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="game-preview">
            <div className="preview-hud">
              <span>WORLD 01</span>
              <strong>LEVEL 24</strong>
              <span>♥ 5</span>
            </div>
            <div className="preview-grid">
              {Array.from({ length: 35 }, (_, index) => (
                <span
                  className={`preview-block tone-${(index + Math.floor(index / 7)) % 5}`}
                  key={index}
                />
              ))}
            </div>
            <div className="preview-balls">
              {Array.from({ length: 18 }, (_, index) => (
                <i key={index} style={{ '--i': index } as React.CSSProperties} />
              ))}
            </div>
            <div className="preview-paddle" />
          </div>
        </div>
      </section>

      <section className="stats shell" id="systems">
        {features.map((feature) => (
          <article key={feature.label}>
            <strong>{feature.number}</strong>
            <h2>{feature.label}</h2>
            <p>{feature.detail}</p>
          </article>
        ))}
      </section>

      <section className="world-section shell" id="worlds">
        <div>
          <span className="eyebrow">HER 50 BÖLÜMDE YENİ BİR ÇEKİRDEK</span>
          <h2>On dünya. Tek ritim.</h2>
        </div>
        <div className="world-cards">
          {['Neon Grid', 'Crystal Core', 'Solar Forge', 'Dark Matter'].map((world, index) => (
            <article key={world} className={`world-card world-${index + 1}`}>
              <span>0{index + 1}</span>
              <h3>{world}</h3>
              <p>{index === 3 ? 'WORLD BOSS' : '50 LEVELS'}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer shell">
        <div className="brand">
          <span className="brand-mark" />
          PULSE
        </div>
        <p>© {new Date().getFullYear()} Pulse. Kod adı; marka ayarından değiştirilebilir.</p>
        <div>
          <Link href="/privacy">Gizlilik</Link>
          <Link href="/terms">Koşullar</Link>
        </div>
      </footer>
    </main>
  );
}
