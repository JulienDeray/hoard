import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { FormHolding } from '@/types';

interface HoldingRowProps {
  holding: FormHolding;
  onChange: (amount: string) => void;
  onRemove: () => void;
  error?: string;
}

export function HoldingRow({ holding, onChange, onRemove, error }: HoldingRowProps) {
  return (
    <div className="flex items-start gap-4 py-3 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{holding.assetSymbol}</span>
          <span className="text-sm text-muted-foreground truncate">
            {holding.assetName}
          </span>
          <Badge variant="secondary" className="text-xs">
            {holding.assetClass}
          </Badge>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1">
          <Input
            type="number"
            step="any"
            min="0"
            value={holding.amount}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Amount"
            className={`w-32 ${error ? 'border-destructive' : ''}`}
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
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
