import { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettings, useS } from '@/features/settings/store';
import { startPrayerStore, startScheduleSync } from '@/features/prayer/store';
import { EV, listen } from '@/lib/bridge';
import { Toaster } from '@/design/components';
import { TitleBar } from './shell/TitleBar';
import { NavRail } from './shell/NavRail';
import { AdhanPlayingPill, startAudioState } from './shell/AdhanPlayingPill';
import { startEffects } from './effects';
import { api } from '@/lib/bridge';
import Home from './routes/home/Home';

const Onboarding = lazy(() => import('./routes/onboarding/Onboarding'));
const Timetable = lazy(() => import('./routes/timetable/Timetable'));
const Quran = lazy(() => import('./routes/quran/Quran'));
const Adhkar = lazy(() => import('./routes/adhkar/Adhkar'));
const Qibla = lazy(() => import('./routes/qibla/Qibla'));
const Library = lazy(() => import('./routes/library/Library'));
const Settings = lazy(() => import('./routes/settings/Settings'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5 * 60_000 } },
});

let started = false;
async function startMain() {
  if (started) return;
  started = true;
  await startPrayerStore();
  startScheduleSync();
  startAudioState();
  startEffects();
}

function NavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    const un = listen<{ route: string }>(EV.navigate, (p) => navigate(p.route));
    return () => {
      void un.then((f) => f());
    };
  }, [navigate]);
  return null;
}

function Shell() {
  const onboarded = useS((s) => s.onboarding.done);
  const location = useLocation();
  if (!onboarded && !location.pathname.startsWith('/onboarding')) return <Navigate to="/onboarding" replace />;
  if (location.pathname.startsWith('/onboarding')) {
    return (
      <div className="flex h-full flex-col">
        <TitleBar minimal />
        <main className="min-h-0 flex-1">
          <Suspense fallback={null}>
            <Onboarding />
          </Suspense>
        </main>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col bg-bg">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <NavRail />
        <main id="main" className="khatam relative min-w-0 flex-1 overflow-y-auto" tabIndex={-1}>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/timetable" element={<Timetable />} />
              <Route path="/quran/*" element={<Quran />} />
              <Route path="/adhkar/*" element={<Adhkar />} />
              <Route path="/qibla" element={<Qibla />} />
              <Route path="/library/*" element={<Library />} />
              <Route path="/settings/:section?" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <AdhanPlayingPill />
    </div>
  );
}

export default function App() {
  const ready = useSettings((s) => s.ready);
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    void startMain().then(() => {
      setBooted(true);
      // first paint done: let Rust show the window (avoids a blank flash)
      requestAnimationFrame(() => void api.appReady().catch(() => {}));
    });
  }, []);
  if (!ready || !booted) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <NavigationBridge />
        <Shell />
        <Toaster />
      </HashRouter>
    </QueryClientProvider>
  );
}
