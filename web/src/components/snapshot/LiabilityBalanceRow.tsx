import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { FormLiabilityBalance } from '@/types';

interface LiabilityBalanceRowProps {
  liabilityBalance: FormLiabilityBalance;
  onChange: (outstandingAmount: string) => void;
  onRemove: () => void;
  error?: string;
}

function formatCurrency(value: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(value);
}

export function LiabilityBalanceRow({
  liabilityBalance,
  onChange,
  onRemove,
  error,
}: LiabilityBalanceRowProps) {
  return (
    <div className="flex items-start gap-4 py-3 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{liabilityBalance.liabilityName}</span>
          <Badge variant="secondary" className="text-xs">
            {liabilityBalance.liabilityType}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Original: {formatCurrency(liabilityBalance.originalAmount)}
        </p>
      </div>
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1">
          <Input
            type="number"
            step="any"
            min="0"
            value={liabilityBalance.outstandingAmount}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Outstanding"
            className={`w-32 ${error ? 'border-destructive' : ''}`}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-9 w-9 text-muted-foreground hover:text-destructive"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Remove liability balance</span>
        </Button>
      </div>
    </div>
  );
}
