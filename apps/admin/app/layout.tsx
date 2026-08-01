import type { Metadata } from 'next';
import { AdminSessionProvider } from '../lib/session';
import { themeBootstrapScript } from '../lib/theme';
import './admin.css';

export const metadata: Metadata = {
  title: `Control Center | ${process.env.APP_NAME ?? 'Tuğla.fun'}`,
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <AdminSessionProvider>{children}</AdminSessionProvider>
      </body>
    </html>
  );
}
