import { useQuery } from '@tanstack/react-query';
import { api } from './client';

export function useSnapshots() {
  return useQuery({
    queryKey: ['snapshots'],
    queryFn: api.getSnapshots,
  });
}

export function useSnapshot(date: string) {
  return useQuery({
    queryKey: ['snapshot', date],
    queryFn: () => api.getSnapshot(date),
    enabled: !!date,
  });
}

export function usePortfolioSummary() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: api.getPortfolioSummary,
  });
}

export function useAllocationComparison() {
  return useQuery({
    queryKey: ['allocations'],
    queryFn: api.getAllocationComparison,
  });
}
