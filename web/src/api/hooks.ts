import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  CreateSnapshotRequest,
  AddHoldingRequest,
  UpdateHoldingRequest,
  AddLiabilityBalanceRequest,
  UpdateLiabilityBalanceRequest,
  CreatePropertyRequest,
  UpdatePropertyValueRequest,
} from '@/types';

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

// Asset search hook with debounce-friendly query
export function useAssetSearch(query: string) {
  return useQuery({
    queryKey: ['assets', 'search', query],
    queryFn: () => api.searchAssets(query),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Mutation hooks
export function useCreateSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSnapshotRequest) => api.createSnapshot(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

export function useDeleteSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (date: string) => api.deleteSnapshot(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

export function useAddHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: AddHoldingRequest }) =>
      api.addHolding(date, data),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['snapshot', date] });
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

export function useUpdateHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      date,
      assetId,
      data,
    }: {
      date: string;
      assetId: number;
      data: UpdateHoldingRequest;
    }) => api.updateHolding(date, assetId, data),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['snapshot', date] });
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

export function useDeleteHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ date, assetId }: { date: string; assetId: number }) =>
      api.deleteHolding(date, assetId),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['snapshot', date] });
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

// Liability hooks
export function useLiabilities() {
  return useQuery({
    queryKey: ['liabilities'],
    queryFn: api.getLiabilities,
  });
}

export function usePreviousSnapshotData() {
  return useQuery({
    queryKey: ['snapshots', 'previous'],
    queryFn: api.getPreviousSnapshotData,
  });
}

export function useAddLiabilityBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: AddLiabilityBalanceRequest }) =>
      api.addLiabilityBalance(date, data),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['snapshot', date] });
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

export function useUpdateLiabilityBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      date,
      liabilityId,
      data,
    }: {
      date: string;
      liabilityId: number;
      data: UpdateLiabilityBalanceRequest;
    }) => api.updateLiabilityBalance(date, liabilityId, data),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['snapshot', date] });
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

export function useDeleteLiabilityBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ date, liabilityId }: { date: string; liabilityId: number }) =>
      api.deleteLiabilityBalance(date, liabilityId),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['snapshot', date] });
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

// Property hooks
export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: api.getProperties,
  });
}

export function useProperty(id: number) {
  return useQuery({
    queryKey: ['properties', id],
    queryFn: () => api.getProperty(id),
    enabled: !!id,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePropertyRequest) => api.createProperty(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useUpdatePropertyValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePropertyValueRequest }) =>
      api.updatePropertyValue(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
    },
  });
}
