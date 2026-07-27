import type { Metadata } from 'next';
import { GameCanvas } from '../../components/GameCanvas';

export const metadata: Metadata = {
  title: 'Play',
  description: 'Play Tuğla in your browser.',
  robots: { index: false, follow: false },
};

export default function PlayPage() {
  return (
    <main className="play-page">
      <GameCanvas />
    </main>
  );
}
