import type {
  Snapshot,
  SnapshotDetail,
  PortfolioSummary,
  AllocationSummary,
  Asset,
  Liability,
  PreviousSnapshotData,
  CreateSnapshotRequest,
  AddHoldingRequest,
  UpdateHoldingRequest,
  HoldingResponse,
  DeleteSnapshotResponse,
  DeleteHoldingResponse,
  AddLiabilityBalanceRequest,
  UpdateLiabilityBalanceRequest,
  LiabilityBalanceResponse,
  DeleteLiabilityBalanceResponse,
} from '@/types';

const API_BASE = '/api';

interface ApiResponse<T> {
  data: T;
  count?: number;
  message?: string;
}

interface ApiErrorResponse {
  error: string;
  code: string;
}

class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    let errorData: ApiErrorResponse;
    try {
      errorData = await response.json();
    } catch {
      throw new ApiError('Network error', 'NETWORK_ERROR', response.status);
    }
    throw new ApiError(errorData.error, errorData.code, response.status);
  }

  const result: ApiResponse<T> = await response.json();
  return result.data;
}

// API client interface
export const api = {
  // Snapshots - Queries
  getSnapshots: (): Promise<Snapshot[]> => fetchApi<Snapshot[]>('/snapshots'),

  getSnapshot: (date: string): Promise<SnapshotDetail> => fetchApi<SnapshotDetail>(`/snapshots/${date}`),

  // Snapshots - Mutations
  createSnapshot: (data: CreateSnapshotRequest): Promise<Snapshot> =>
    fetchApi<Snapshot>('/snapshots', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteSnapshot: (date: string): Promise<DeleteSnapshotResponse> =>
    fetchApi<DeleteSnapshotResponse>(`/snapshots/${date}`, {
      method: 'DELETE',
    }),

  // Holdings - Mutations
  addHolding: (date: string, data: AddHoldingRequest): Promise<HoldingResponse> =>
    fetchApi<HoldingResponse>(`/snapshots/${date}/holdings`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateHolding: (date: string, assetId: number, data: UpdateHoldingRequest): Promise<HoldingResponse> =>
    fetchApi<HoldingResponse>(`/snapshots/${date}/holdings/${assetId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteHolding: (date: string, assetId: number): Promise<DeleteHoldingResponse> =>
    fetchApi<DeleteHoldingResponse>(`/snapshots/${date}/holdings/${assetId}`, {
      method: 'DELETE',
    }),

  // Assets
  searchAssets: (query: string, limit: number = 10): Promise<Asset[]> =>
    fetchApi<Asset[]>(`/assets/search?q=${encodeURIComponent(query)}&limit=${limit}`),

  // Portfolio
  getPortfolioSummary: (): Promise<PortfolioSummary> => fetchApi<PortfolioSummary>('/portfolio/summary'),

  // Allocations
  getAllocationComparison: (): Promise<AllocationSummary> => fetchApi<AllocationSummary>('/allocations/compare'),

  // Health check
  getHealth: (): Promise<{ status: string }> => fetchApi<{ status: string }>('/health'),

  // Liabilities
  getLiabilities: (): Promise<Liability[]> => fetchApi<Liability[]>('/liabilities'),

  // Previous snapshot data for pre-population
  getPreviousSnapshotData: (): Promise<PreviousSnapshotData | null> =>
    fetchApi<PreviousSnapshotData | null>('/snapshots/previous'),

  // Liability balances - Mutations
  addLiabilityBalance: (date: string, data: AddLiabilityBalanceRequest): Promise<LiabilityBalanceResponse> =>
    fetchApi<LiabilityBalanceResponse>(`/snapshots/${date}/liabilities`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateLiabilityBalance: (
    date: string,
    liabilityId: number,
    data: UpdateLiabilityBalanceRequest
  ): Promise<LiabilityBalanceResponse> =>
    fetchApi<LiabilityBalanceResponse>(`/snapshots/${date}/liabilities/${liabilityId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteLiabilityBalance: (date: string, liabilityId: number): Promise<DeleteLiabilityBalanceResponse> =>
    fetchApi<DeleteLiabilityBalanceResponse>(`/snapshots/${date}/liabilities/${liabilityId}`, {
      method: 'DELETE',
    }),
};

export { ApiError };
