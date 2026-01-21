import { useParams, Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SnapshotForm } from '@/components/snapshot/SnapshotForm';
import { useSnapshot } from '@/api/hooks';
import type { SnapshotFormData, FormHolding, FormLiabilityBalance } from '@/types';

function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function SnapshotEdit() {
  const { date } = useParams<{ date: string }>();
  const { data, isLoading, error } = useSnapshot(date || '');

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link to="/snapshots">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Snapshots
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading snapshot: {String(error)}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link to="/snapshots">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Snapshots
          </Link>
        </Button>
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-48 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link to="/snapshots">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Snapshots
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Snapshot not found for date: {date}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Transform snapshot data to form data
  const initialData: SnapshotFormData = {
    date: data.snapshot.date,
    notes: data.snapshot.notes || '',
    holdings: data.holdings.map((h): FormHolding => ({
      tempId: generateTempId(),
      assetId: h.asset_id,
      assetSymbol: h.asset_symbol,
      assetName: h.asset_name,
      assetClass: h.asset_class || 'CRYPTO',
      amount: String(h.amount),
      originalAmount: h.amount,
    })),
    liabilityBalances: data.liabilityBalances.map((lb): FormLiabilityBalance => ({
      tempId: generateTempId(),
      liabilityId: lb.liabilityId,
      liabilityName: lb.liabilityName,
      liabilityType: lb.liabilityType,
      originalAmount: lb.originalAmount,
      outstandingAmount: String(lb.outstandingAmount),
      originalOutstandingAmount: lb.outstandingAmount,
    })),
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link to={`/snapshots/${date}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Snapshot
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Snapshot</h1>
        <p className="text-muted-foreground">
          Modify the holdings for {date}
        </p>
      </div>

      <SnapshotForm
        mode="edit"
        initialData={initialData}
        snapshotDate={date}
        onSuccess={() => {
          // Navigation handled in form
        }}
      />
    </div>
  );
}
