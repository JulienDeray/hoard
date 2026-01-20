import { useParams, Link } from 'react-router';
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
import { useSnapshot } from '@/api/hooks';
import { ArrowLeft } from 'lucide-react';

function formatCurrency(value: number | undefined, currency: string = 'EUR'): string {
  if (value === undefined) return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 8,
  }).format(value);
}

export function SnapshotDetail() {
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

  const { snapshot, holdings } = data;

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/snapshots">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Snapshots
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Snapshot: {formatDate(snapshot.date)}
        </h1>
        {snapshot.notes && (
          <p className="text-muted-foreground">{snapshot.notes}</p>
        )}
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
          {holdings.length === 0 ? (
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((holding) => (
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
