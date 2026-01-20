import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePortfolioSummary } from '@/api/hooks';
import { PieChart, TrendingUp } from 'lucide-react';

function formatCurrency(value: number | undefined, currency: string = 'EUR'): string {
  if (value === undefined) return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
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

export function Portfolio() {
  const { data: portfolio, isLoading, error } = usePortfolioSummary();

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground">Current holdings and values</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading portfolio: {String(error)}</p>
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
          <p className="text-muted-foreground">Current holdings and values</p>
        </div>
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground">Current holdings and values</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No portfolio data available.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate percentages for pie chart placeholder
  const holdingsWithPercentage = portfolio.holdings.map((holding) => ({
    ...holding,
    percentage: ((holding.current_value_eur || 0) / portfolio.total_value) * 100,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground">
          Current holdings as of {portfolio.date}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(portfolio.total_value, portfolio.currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {portfolio.holdings.length} assets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Allocation</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {holdingsWithPercentage.slice(0, 4).map((holding) => (
                <div key={holding.id} className="flex items-center justify-between text-sm">
                  <span>{holding.asset_symbol}</span>
                  <span className="text-muted-foreground">
                    {formatPercentage(holding.percentage)}
                  </span>
                </div>
              ))}
              {holdingsWithPercentage.length > 4 && (
                <p className="text-xs text-muted-foreground">
                  +{holdingsWithPercentage.length - 4} more assets
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Holdings Breakdown</CardTitle>
          <CardDescription>
            All assets in your portfolio
          </CardDescription>
        </CardHeader>
        <CardContent>
          {portfolio.holdings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No holdings found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdingsWithPercentage.map((holding) => (
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
                    <TableCell className="text-right">
                      {formatCurrency(holding.current_price_eur)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(holding.current_value_eur)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatPercentage(holding.percentage)}
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
