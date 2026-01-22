import { X, Home } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { FormHolding } from '@/types';

interface HoldingRowProps {
  holding: FormHolding;
  onChange: (amount: string, priceOverride?: string) => void;
  onRemove: () => void;
  error?: string;
}

export function HoldingRow({ holding, onChange, onRemove, error }: HoldingRowProps) {
  const isRealEstate = holding.assetClass === 'REAL_ESTATE';

  return (
    <div className={`flex items-start gap-4 py-3 border-b last:border-b-0 ${isRealEstate ? 'bg-muted/30 -mx-2 px-2 rounded-lg' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isRealEstate && <Home className="h-4 w-4 text-muted-foreground" />}
          <span className="font-medium">{holding.assetSymbol}</span>
          <span className="text-sm text-muted-foreground truncate">
            {holding.assetName}
          </span>
          <Badge variant={isRealEstate ? 'default' : 'secondary'} className="text-xs">
            {holding.assetClass}
          </Badge>
        </div>
      </div>
      <div className="flex items-start gap-2">
        {isRealEstate ? (
          <>
            {/* For real estate, amount is always 1 (read-only) */}
            <div className="flex flex-col gap-1">
              <Input
                type="text"
                value="1"
                readOnly
                className="w-20 bg-muted cursor-not-allowed"
                title="Properties always have amount of 1"
              />
              <span className="text-xs text-muted-foreground">Fixed</span>
            </div>
            {/* Value field for real estate */}
            <div className="flex flex-col gap-1">
              <Input
                type="number"
                step="any"
                min="0"
                value={holding.priceOverride || ''}
                onChange={(e) => onChange('1', e.target.value)}
                placeholder="Value (EUR)"
                className={`w-32 ${error ? 'border-destructive' : ''}`}
              />
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : (
                <span className="text-xs text-muted-foreground">Property value</span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <Input
                type="number"
                step="any"
                min="0"
                value={holding.amount}
                onChange={(e) => onChange(e.target.value, holding.priceOverride)}
                placeholder="Amount"
                className={`w-32 ${error ? 'border-destructive' : ''}`}
              />
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Input
                type="number"
                step="any"
                min="0"
                value={holding.priceOverride || ''}
                onChange={(e) => onChange(holding.amount, e.target.value)}
                placeholder="Price (EUR)"
                className="w-28"
              />
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-9 w-9 text-muted-foreground hover:text-destructive"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Remove holding</span>
        </Button>
      </div>
    </div>
  );
}
