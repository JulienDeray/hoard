import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePortfolioSummary } from '@/api/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { Wallet, RefreshCw, TrendingUp, Coins, Home, Building2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 8,
  }).format(value);
}

function formatPercentage(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

function formatSnapshotDate(dateString: string): string {
  try {
    return format(parseISO(dateString), 'MMMM d, yyyy');
  } catch {
    return dateString;
  }
}

// Color palette for allocation bar
const ALLOCATION_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-indigo-500',
];

export function Portfolio() {
  const { data: portfolio, isLoading, error, refetch } = usePortfolioSummary();
  const queryClient = useQueryClient();

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    refetch();
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground">Your current holdings and net worth</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-destructive">Error loading portfolio: {String(error)}</p>
              <Button variant="outline" onClick={handleRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
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
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground">Your current holdings and net worth</p>
        </div>
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground">Your current holdings and net worth</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">No portfolio data yet</p>
                <p className="text-muted-foreground">
                  Add your first snapshot to see your holdings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground">Your current holdings and net worth</p>
      </div>

      {/* Featured Net Worth Card */}
      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Net Worth
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-5xl font-bold tracking-tight">
            {formatCurrency(portfolio.netWorthEur)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Based on snapshot from {formatSnapshotDate(portfolio.snapshotDate)}
          </p>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(portfolio.totalAssetsEur)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assets</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolio.assetCount}</div>
            <p className="text-xs text-muted-foreground">different holdings</p>
          </CardContent>
        </Card>
      </div>

      {/* Real Estate Section */}
      {portfolio.realEstateSummary && portfolio.realEstateSummary.propertyCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Real Estate
            </CardTitle>
            <CardDescription>Property values and equity breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Summary Stats */}
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(portfolio.realEstateSummary.totalPropertyValue)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium text-muted-foreground">Total Mortgages</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(portfolio.realEstateSummary.totalMortgageBalance)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium text-muted-foreground">Total Equity</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(portfolio.realEstateSummary.totalEquity)}
                </p>
              </div>
            </div>

            {/* Properties Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Mortgage</TableHead>
                  <TableHead className="text-right">Equity</TableHead>
                  <TableHead className="text-right">LTV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portfolio.realEstateSummary.properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{property.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {property.propertyType.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(property.currentValue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {property.mortgageBalance !== null
                        ? formatCurrency(property.mortgageBalance)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">
                      {formatCurrency(property.equity)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {property.ltvPercentage !== null
                        ? formatPercentage(property.ltvPercentage)
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Allocation Bar - Asset Class Distribution */}
      {portfolio.assetClassAllocation?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-4 w-full overflow-hidden rounded-full">
              {portfolio.assetClassAllocation.map((allocation, index) => (
                <div
                  key={allocation.assetClass}
                  className={`${ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} transition-all`}
                  style={{ width: `${allocation.allocationPct}%` }}
                  title={`${allocation.displayName}: ${formatPercentage(allocation.allocationPct)}`}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {portfolio.assetClassAllocation.map((allocation, index) => (
                <div key={allocation.assetClass} className="flex items-center gap-1.5 text-sm">
                  <div
                    className={`h-3 w-3 rounded-full ${ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}`}
                  />
                  <span className="font-medium">{allocation.displayName}</span>
                  <span className="text-muted-foreground">
                    {formatPercentage(allocation.allocationPct)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holdings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
          <CardDescription>All assets in your portfolio, sorted by allocation</CardDescription>
        </CardHeader>
        <CardContent>
          {portfolio.holdings.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No holdings found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Allocation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portfolio.holdings.map((holding) => (
                  <TableRow key={holding.assetId}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{holding.symbol}</span>
                        <span className="ml-2 text-muted-foreground">{holding.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(holding.amount)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(holding.valueEur)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatPercentage(holding.allocationPct)}
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
