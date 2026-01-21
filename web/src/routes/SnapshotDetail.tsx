import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSnapshot, useDeleteSnapshot } from '@/api/hooks';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';

function formatCurrency(value: number | undefined, currency: string = 'EUR'): string {
  if (value === undefined) return '-';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 8,
  }).format(value);
}

function formatPercentage(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function SnapshotDetail() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useSnapshot(date || '');
  const deleteSnapshotMutation = useDeleteSnapshot();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!date) return;

    setDeleteError(null);
    try {
      await deleteSnapshotMutation.mutateAsync(date);
      navigate('/snapshots');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete snapshot');
    }
  };

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
            <Button variant="outline" onClick={() => refetch()} className="mt-4">
              Retry
            </Button>
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
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
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

  const { snapshot, holdings, liabilityBalances } = data;

  // Sort holdings by value descending
  const sortedHoldings = [...holdings].sort((a, b) => {
    const valueA = a.value_eur ?? 0;
    const valueB = b.value_eur ?? 0;
    return valueB - valueA;
  });

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/snapshots">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Snapshots
        </Link>
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Snapshot: {formatDate(snapshot.date)}
          </h1>
          {snapshot.notes && (
            <p className="text-muted-foreground">{snapshot.notes}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/snapshots/${snapshot.date}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Snapshot</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete snapshot from {formatDate(snapshot.date)}? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteError && (
                <p className="text-sm text-destructive">{deleteError}</p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleteSnapshotMutation.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteSnapshotMutation.isPending ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(snapshot.total_assets_eur)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Liabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(snapshot.total_liabilities_eur || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(snapshot.net_worth_eur)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
          <CardDescription>
            Assets held in this snapshot
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedHoldings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No holdings in this snapshot.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Value (EUR)</TableHead>
                  <TableHead className="text-right">Allocation</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedHoldings.map((holding) => {
                  const allocationPct = snapshot.total_assets_eur && holding.value_eur
                    ? (holding.value_eur / snapshot.total_assets_eur) * 100
                    : 0;

                  return (
                    <TableRow key={holding.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{holding.asset_symbol}</span>
                          <span className="ml-2 text-muted-foreground">
                            {holding.asset_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {holding.asset_class || 'CRYPTO'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(holding.amount)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(holding.value_eur)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercentage(allocationPct)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {holding.notes || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liabilities</CardTitle>
          <CardDescription>
            Loans, mortgages, and credit lines in this snapshot
          </CardDescription>
        </CardHeader>
        <CardContent>
          {liabilityBalances.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No liabilities tracked in this snapshot.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Original Amount</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Interest Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liabilityBalances.map((lb) => (
                  <TableRow key={lb.liabilityId}>
                    <TableCell className="font-medium">
                      {lb.liabilityName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {lb.liabilityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(lb.originalAmount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(lb.outstandingAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {lb.interestRate ? `${lb.interestRate}%` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
