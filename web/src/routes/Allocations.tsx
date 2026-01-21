import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAllocationComparison } from '@/api/hooks';
import { AlertCircle, ArrowDown, ArrowUp, Check, RefreshCw, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AllocationBar } from '@/components/AllocationBar';

function formatCurrency(value: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(value);
}

function formatPercentage(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

function formatDifference(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatPercentage(value)}`;
}

export function Allocations() {
  const { data: allocationSummary, isLoading, error, refetch } = useAllocationComparison();

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Allocations</h1>
          <p className="text-muted-foreground">Compare current vs target allocations</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
              <h3 className="text-lg font-semibold">Failed to Load Allocations</h3>
              <p className="text-muted-foreground mt-2">
                {error instanceof Error ? error.message : String(error)}
              </p>
              <Button onClick={() => refetch()} className="mt-4">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Allocations</h1>
          <p className="text-muted-foreground">Compare current vs target allocations</p>
        </div>
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!allocationSummary || !allocationSummary.has_targets) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Allocations</h1>
          <p className="text-muted-foreground">Compare current vs target allocations</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Target className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No Allocation Targets Set</h3>
              <p className="text-muted-foreground mt-2">
                Set allocation targets via the CLI to see comparisons here.
              </p>
              <code className="mt-4 rounded bg-muted px-3 py-2 text-sm">
                npm run dev allocation set
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { allocations, total_value, currency, date, targets_sum_valid } = allocationSummary;

  // Count allocations within tolerance
  const balancedCount = allocations.filter((a) => a.is_within_tolerance).length;
  const allBalanced = balancedCount === allocations.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Allocations</h1>
        <p className="text-muted-foreground">
          Current vs target allocations as of {date}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(total_value, currency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Balance Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {allBalanced ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-lg font-semibold text-green-600">Balanced</span>
                </>
              ) : (
                <>
                  <Target className="h-5 w-5 text-yellow-500" />
                  <span className="text-lg font-semibold text-yellow-600">
                    {balancedCount}/{allocations.length} in range
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Targets Valid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {targets_sum_valid ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-lg font-semibold">Sum = 100%</span>
                </>
              ) : (
                <Badge variant="destructive">Targets don't sum to 100%</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Allocation Comparison</CardTitle>
          <CardDescription>
            Comparison of current weights vs target weights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Drift</TableHead>
                <TableHead className="hidden lg:table-cell">Visualization</TableHead>
                <TableHead className="hidden md:table-cell text-right">Adjustment</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.map((allocation) => {
                const isOverweight = allocation.difference_percentage > 0;
                const isUnderweight = allocation.difference_percentage < 0;

                return (
                  <TableRow key={`${allocation.target_type}-${allocation.target_key}`}>
                    <TableCell>
                      <div className="font-medium">{allocation.display_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {allocation.target_type === 'ASSET' ? allocation.target_key : 'Asset Class'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>{formatPercentage(allocation.current_percentage)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(allocation.current_value, currency)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercentage(allocation.target_percentage)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className={cn(
                          'flex items-center justify-end gap-1',
                          isOverweight && 'text-orange-600',
                          isUnderweight && 'text-blue-600'
                        )}
                      >
                        {isOverweight && <ArrowUp className="h-3 w-3" />}
                        {isUnderweight && <ArrowDown className="h-3 w-3" />}
                        {formatDifference(allocation.difference_percentage)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <AllocationBar
                        current={allocation.current_percentage}
                        target={allocation.target_percentage}
                      />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      <span
                        className={cn(
                          'text-sm',
                          isOverweight && 'text-orange-600',
                          isUnderweight && 'text-blue-600'
                        )}
                      >
                        {isOverweight && `Sell ${formatCurrency(allocation.difference_value, currency)}`}
                        {isUnderweight && `Buy ${formatCurrency(Math.abs(allocation.difference_value), currency)}`}
                        {!isOverweight && !isUnderweight && 'Hold'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {allocation.is_within_tolerance ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <Check className="mr-1 h-3 w-3" />
                          OK
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                          Rebalance
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rebalancing Suggestions</CardTitle>
          <CardDescription>
            Summary of recommended actions to reach target allocation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allocations
              .filter((a) => !a.is_within_tolerance)
              .map((allocation) => {
                const isOverweight = allocation.difference_percentage > 0;
                return (
                  <div
                    key={`suggestion-${allocation.target_key}`}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      {isOverweight ? (
                        <ArrowDown className="h-5 w-5 text-orange-500" />
                      ) : (
                        <ArrowUp className="h-5 w-5 text-blue-500" />
                      )}
                      <div>
                        <p className="font-medium">{allocation.display_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {isOverweight ? 'Overweight' : 'Underweight'} by{' '}
                          {formatPercentage(Math.abs(allocation.difference_percentage))}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          'font-semibold',
                          isOverweight ? 'text-orange-600' : 'text-blue-600'
                        )}
                      >
                        {isOverweight ? 'Sell' : 'Buy'}{' '}
                        {formatCurrency(Math.abs(allocation.difference_value), currency)}
                      </p>
                    </div>
                  </div>
                );
              })}
            {allocations.filter((a) => !a.is_within_tolerance).length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Check className="mb-4 h-12 w-12 text-green-500" />
                <h3 className="text-lg font-semibold text-green-700">Portfolio is Balanced</h3>
                <p className="text-muted-foreground mt-2">
                  All allocations are within their tolerance ranges.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
