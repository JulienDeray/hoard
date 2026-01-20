import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/routes/Dashboard';
import { SnapshotList } from '@/routes/SnapshotList';
import { SnapshotDetail } from '@/routes/SnapshotDetail';
import { Portfolio } from '@/routes/Portfolio';
import { Allocations } from '@/routes/Allocations';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/snapshots" element={<SnapshotList />} />
            <Route path="/snapshots/:date" element={<SnapshotDetail />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/allocations" element={<Allocations />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
