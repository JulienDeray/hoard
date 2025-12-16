export interface Snapshot {
  id: number;
  date: string; // ISO 8601 format (YYYY-MM-DD)
  created_at: string;
  notes?: string;
}

export interface CreateSnapshotInput {
  date: string;
  notes?: string;
}
