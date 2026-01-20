import type { Snapshot, SnapshotDetail, PortfolioSummary, AllocationSummary } from '@/types';
import {
  getSnapshots as mockGetSnapshots,
  getSnapshot as mockGetSnapshot,
  getPortfolioSummary as mockGetPortfolioSummary,
  getAllocationComparison as mockGetAllocationComparison,
} from './mocks';

// API client interface
// Currently using mock implementations
// Replace with real API calls when backend is ready

export const api = {
  getSnapshots: (): Promise<Snapshot[]> => mockGetSnapshots(),

  getSnapshot: (date: string): Promise<SnapshotDetail> => mockGetSnapshot(date),

  getPortfolioSummary: (): Promise<PortfolioSummary> => mockGetPortfolioSummary(),

  getAllocationComparison: (): Promise<AllocationSummary> => mockGetAllocationComparison(),
};
