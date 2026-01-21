import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SnapshotForm } from '@/components/snapshot/SnapshotForm';
import { usePreviousSnapshotData } from '@/api/hooks';
import type { SnapshotFormData, FormHolding, FormLiabilityBalance } from '@/types';

function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function SnapshotNew() {
  const { data: previousData, isLoading } = usePreviousSnapshotData();

  // Transform previous snapshot data to form data for pre-population
  const initialData: SnapshotFormData | undefined = useMemo(() => {
    if (!previousData) return undefined;

    const holdings: FormHolding[] = previousData.holdings.map((h) => ({
      tempId: generateTempId(),
      assetId: h.asset_id,
      assetSymbol: h.asset_symbol,
      assetName: h.asset_name,
      assetClass: h.asset_class || 'CRYPTO',
      amount: String(h.amount),
      originalAmount: h.amount,
    }));

    const liabilityBalances: FormLiabilityBalance[] = previousData.liabilityBalances.map((lb) => ({
      tempId: generateTempId(),
      liabilityId: lb.liabilityId,
      liabilityName: lb.liabilityName,
      liabilityType: lb.liabilityType,
      originalAmount: lb.originalAmount,
      outstandingAmount: String(lb.outstandingAmount),
      originalOutstandingAmount: lb.outstandingAmount,
    }));

    return {
      date: '', // Will be set by the form
      notes: '',
      holdings,
      liabilityBalances,
    };
  }, [previousData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link to="/snapshots">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Snapshots
          </Link>
        </Button>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading previous snapshot data...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/snapshots">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Snapshots
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Snapshot</h1>
        <p className="text-muted-foreground">
          Create a point-in-time record of your portfolio
          {previousData && ` (pre-populated from ${previousData.date})`}
        </p>
      </div>

      <SnapshotForm
        mode="create"
        initialData={initialData}
        onSuccess={() => {
          // Navigation handled in form
        }}
      />
    </div>
  );
}
