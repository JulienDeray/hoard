import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSnapshots } from '@/api/hooks';

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

export function SnapshotList() {
  const navigate = useNavigate();
  const { data: snapshots, isLoading, error } = useSnapshots();

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Snapshots</h1>
          <p className="text-muted-foreground">Portfolio snapshots over time</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading snapshots: {String(error)}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Snapshots</h1>
        <p className="text-muted-foreground">Portfolio snapshots over time</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Snapshots</CardTitle>
          <CardDescription>
            Click on a row to view snapshot details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : !snapshots || snapshots.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No snapshots found. Add your first snapshot via the CLI.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Total Assets</TableHead>
                  <TableHead className="text-right">Net Worth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snapshot) => (
                  <TableRow
                    key={snapshot.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/snapshots/${snapshot.date}`)}
                  >
                    <TableCell className="font-medium">
                      {formatDate(snapshot.date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {snapshot.notes || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(snapshot.total_assets_eur)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(snapshot.net_worth_eur)}
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
