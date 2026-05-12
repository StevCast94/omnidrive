// ===== web/src/components/Layout.tsx =====
import Navbar from './Navbar';
import PushBanner from './PushBanner';
import { useAuthStore } from '@/lib/store';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="pt-16">
        {children}
      </main>
      {user && <PushBanner />}
    </div>
  );
}
