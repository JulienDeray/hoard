import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProperties } from '@/api/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Home, RefreshCw, Pencil } from 'lucide-react';
import { AddPropertyDialog } from '@/components/property/AddPropertyDialog';
import { UpdateValueDialog } from '@/components/property/UpdateValueDialog';
import type { PropertyWithDetails, PropertyType } from '@/types';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function formatPercentage(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  PRIMARY_RESIDENCE: 'Primary Residence',
  RENTAL: 'Rental',
  VACATION: 'Vacation',
  COMMERCIAL: 'Commercial',
  LAND: 'Land',
  OTHER: 'Other',
};

export function Properties() {
  const { data: properties, isLoading, error, refetch } = useProperties();
  const queryClient = useQueryClient();
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyWithDetails | null>(null);

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ['properties'] });
    refetch();
  };

  const handleUpdateValue = (property: PropertyWithDetails) => {
    setSelectedProperty(property);
    setUpdateDialogOpen(true);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
            <p className="text-muted-foreground">Manage your real estate portfolio</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-destructive">Error loading properties: {String(error)}</p>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
            <p className="text-muted-foreground">Manage your real estate portfolio</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const totalValue = properties?.reduce((sum, p) => sum + p.currentValue, 0) ?? 0;
  const totalMortgage = properties?.reduce((sum, p) => sum + (p.mortgageBalance ?? 0), 0) ?? 0;
  const totalEquity = totalValue - totalMortgage;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
          <p className="text-muted-foreground">Manage your real estate portfolio</p>
        </div>
        <AddPropertyDialog />
      </div>

      {/* Summary Cards */}
      {properties && properties.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Value</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Mortgages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalMortgage)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Equity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalEquity)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Property Cards */}
      {!properties || properties.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">No properties yet</p>
                <p className="text-muted-foreground">
                  Add your first property to start tracking your real estate portfolio.
                </p>
              </div>
              <AddPropertyDialog
                trigger={
                  <Button>
                    <Building2 className="mr-2 h-4 w-4" />
                    Add Your First Property
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Card key={property.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{property.name}</CardTitle>
                  </div>
                  <Badge variant="secondary">
                    {PROPERTY_TYPE_LABELS[property.propertyType]}
                  </Badge>
                </div>
                {property.city && (
                  <CardDescription>
                    {property.city}
                    {property.country && `, ${property.country}`}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-3">
                  {/* Value */}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Value</span>
                    <span className="font-semibold">{formatCurrency(property.currentValue)}</span>
                  </div>

                  {/* Mortgage */}
                  {property.mortgageBalance !== null && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Mortgage</span>
                      <span className="font-medium">{formatCurrency(property.mortgageBalance)}</span>
                    </div>
                  )}

                  {/* Equity */}
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-medium">Equity</span>
                    <span className="font-bold text-emerald-600">
                      {formatCurrency(property.equity)}
                    </span>
                  </div>

                  {/* LTV */}
                  {property.ltvPercentage !== null && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">LTV</span>
                      <span className="text-sm text-muted-foreground">
                        {formatPercentage(property.ltvPercentage)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
              <div className="border-t p-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleUpdateValue(property)}
                >
                  <Pencil className="mr-2 h-3 w-3" />
                  Update Value
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Update Value Dialog */}
      <UpdateValueDialog
        property={selectedProperty}
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
      />
    </div>
  );
}
