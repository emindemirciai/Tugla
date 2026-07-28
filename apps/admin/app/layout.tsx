import type { Metadata } from 'next';
import { AdminSessionProvider } from '../lib/session';
import './admin.css';

export const metadata: Metadata = {
  title: `Control Center | ${process.env.APP_NAME ?? 'Pulse'}`,
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <AdminSessionProvider>{children}</AdminSessionProvider>
      </body>
    </html>
  );
}
