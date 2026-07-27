import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: `Control Center | ${process.env.APP_NAME ?? 'Tuğla'}`,
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
