import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** Player-only screen: excluded from search and answer engines. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
