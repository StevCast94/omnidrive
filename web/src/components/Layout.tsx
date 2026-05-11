import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import PushBanner from './PushBanner';
import { useAuthStore } from '@/lib/store';

export default function Layout() {
  const { user } = useAuthStore();
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="pt-16">
        <Outlet />
      </main>
      {user && <PushBanner />}
    </div>
  );
}
