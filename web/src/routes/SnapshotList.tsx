import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router';
import { ChevronUp, ChevronDown, Plus, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSnapshots } from '@/api/hooks';
import type { Snapshot } from '@/types';

type SortKey = 'date' | 'netWorth';
type SortOrder = 'asc' | 'desc';

function formatCurrency(value: number | undefined, currency: string = 'EUR'): string {
  if (value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSortKey: SortKey;
  currentSortOrder: SortOrder;
  onSort: (key: SortKey) => void;
  className?: string;
}

function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  currentSortOrder,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentSortKey === sortKey;
  const Icon = currentSortOrder === 'asc' ? ChevronUp : ChevronDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        {isActive && <Icon className="h-4 w-4" />}
      </button>
    </TableHead>
  );
}

export function SnapshotList() {
  const navigate = useNavigate();
  const { data: snapshots, isLoading, error, refetch } = useSnapshots();
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const sortedSnapshots = useMemo(() => {
    if (!snapshots) return [];

    return [...snapshots].sort((a: Snapshot, b: Snapshot) => {
      let comparison = 0;

      if (sortKey === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortKey === 'netWorth') {
        const aValue = a.net_worth_eur ?? 0;
        const bValue = b.net_worth_eur ?? 0;
        comparison = aValue - bValue;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [snapshots, sortKey, sortOrder]);

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Snapshots</h1>
          <p className="text-muted-foreground">Portfolio snapshots over time</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <p className="text-destructive">Error loading snapshots: {String(error)}</p>
              <Button variant="outline" onClick={() => refetch()}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Snapshots</CardTitle>
            <CardDescription>
              Click on a row to view snapshot details
            </CardDescription>
          </div>
          <Button asChild>
            <Link to="/snapshots/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Snapshot
            </Link>
          </Button>
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
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <p className="text-muted-foreground">
                No snapshots found. Create your first portfolio snapshot.
              </p>
              <Button variant="outline" asChild>
                <Link to="/snapshots/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Snapshot
                </Link>
              </Button>
            </div>
          ) : (
            <TooltipProvider>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader
                        label="Date"
                        sortKey="date"
                        currentSortKey={sortKey}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Net Worth"
                        sortKey="netWorth"
                        currentSortKey={sortKey}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        className="text-right"
                      />
                      <TableHead className="text-right">Assets</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSnapshots.map((snapshot) => (
                      <TableRow
                        key={snapshot.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/snapshots/${snapshot.date}`)}
                      >
                        <TableCell className="font-medium">
                          {formatDate(snapshot.date)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(snapshot.net_worth_eur)}
                        </TableCell>
                        <TableCell className="text-right">
                          {snapshot.holdings_count ?? '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {snapshot.notes ? (
                            snapshot.notes.length > 30 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">
                                    {truncateText(snapshot.notes, 30)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{snapshot.notes}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              snapshot.notes
                            )
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
