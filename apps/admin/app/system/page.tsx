'use client';

import { AdminShell } from '../../components/AdminShell';
import { StatusNote, useAdminData } from '../../components/primitives';

interface SystemHealth {
  database: { status: string; latencyMs: number; size: string };
  redis: { status: string; detail: { status: string; lastError: string | null } };
  storage: { provider: string; available: boolean };
  mail: { provider: string; enabled: boolean };
  providers: Record<string, boolean>;
  process: { uptimeSeconds: number; memoryMb: number; nodeVersion: string; environment: string };
}

export default function SystemPage() {
  const { data, loading, error, reload } = useAdminData<SystemHealth>('/admin/system/health');

  return (
    <AdminShell title="Sistem sağlığı">
      <div className="admin-toolbar">
        <button type="button" onClick={() => void reload()}>
          Yenile
        </button>
      </div>
      <StatusNote loading={loading} error={error} />
      {data && (
        <div className="stat-grid">
          <div className="stat-card">
            <strong className={data.database.status === 'up' ? 'ok' : 'bad'}>
              {data.database.status.toUpperCase()}
            </strong>
            <span>
              PostgreSQL · {data.database.latencyMs}ms · {data.database.size}
            </span>
          </div>
          <div className="stat-card">
            <strong className={data.redis.status === 'up' ? 'ok' : 'bad'}>
              {data.redis.status.toUpperCase()}
            </strong>
            <span>
              Redis {data.redis.detail.lastError ? `· ${data.redis.detail.lastError}` : ''}
            </span>
          </div>
          <div className="stat-card">
            <strong className={data.storage.available ? 'ok' : 'bad'}>
              {data.storage.provider}
            </strong>
            <span>Replay depolama</span>
          </div>
          <div className="stat-card">
            <strong className={data.mail.enabled ? 'ok' : 'bad'}>{data.mail.provider}</strong>
            <span>E-posta sağlayıcısı</span>
          </div>
          <div className="stat-card">
            <strong>{Math.floor(data.process.uptimeSeconds / 3600)}h</strong>
            <span>
              Uptime · {data.process.memoryMb}MB · Node {data.process.nodeVersion} ·{' '}
              {data.process.environment}
            </span>
          </div>
          {Object.entries(data.providers).map(([key, value]) => (
            <div key={key} className="stat-card">
              <strong className={value ? 'ok' : 'muted'}>{value ? 'HAZIR' : 'KAPALI'}</strong>
              <span>{key}</span>
            </div>
          ))}
        </div>
      )}
      <p className="admin-note">
        "KAPALI" sağlayıcılar, ilgili environment anahtarları girilmediği için devre dışıdır; kod
        tarafı hazırdır.
      </p>
    </AdminShell>
  );
}
