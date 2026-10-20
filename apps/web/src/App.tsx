import { Navigate, Route, Routes } from 'react-router';

import { Layout } from '@/components/Layout';
import { Loading, Notice } from '@/components/ui';
import { AdminsPage } from '@/features/admins/AdminsPage';
import { EateriesPage } from '@/features/eateries/EateriesPage';
import { HostelsPage } from '@/features/hostels/HostelsPage';
import { VendorsPage } from '@/features/vendors/VendorsPage';
import { SignInPage } from '@/pages/SignInPage';
import { useSession } from '@/lib/session';
import { configError } from '@/lib/supabase';

/** Nothing but the sign-in page renders until the session is an admin's. */
export function App() {
  const session = useSession();

  if (configError) {
    return (
      <main className="mx-auto max-w-xl p-space-xl">
        <Notice>{configError}</Notice>
      </main>
    );
  }
  if (session.status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Loading label="Checking your sign-in…" />
      </main>
    );
  }
  if (session.status !== 'admin') {
    return <SignInPage />;
  }
  return (
    <Layout>
      <Routes>
        <Route path="/vendors" element={<VendorsPage />} />
        <Route path="/hostels" element={<HostelsPage />} />
        <Route path="/eateries" element={<EateriesPage />} />
        <Route path="/admins" element={<AdminsPage />} />
        <Route path="*" element={<Navigate to="/vendors" replace />} />
      </Routes>
    </Layout>
  );
}
