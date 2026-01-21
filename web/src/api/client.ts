import type { Snapshot, SnapshotDetail, PortfolioSummary, AllocationSummary } from '@/types';

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
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
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
  // Snapshots
  getSnapshots: (): Promise<Snapshot[]> => fetchApi<Snapshot[]>('/snapshots'),

  getSnapshot: (date: string): Promise<SnapshotDetail> => fetchApi<SnapshotDetail>(`/snapshots/${date}`),

  // Portfolio
  getPortfolioSummary: (): Promise<PortfolioSummary> => fetchApi<PortfolioSummary>('/portfolio/summary'),

  // Allocations
  getAllocationComparison: (): Promise<AllocationSummary> => fetchApi<AllocationSummary>('/allocations/compare'),

  // Health check
  getHealth: (): Promise<{ status: string }> => fetchApi<{ status: string }>('/health'),
};

export { ApiError };
