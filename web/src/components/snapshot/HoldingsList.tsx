import { Plus } from 'lucide-react';
import { AssetSearch } from './AssetSearch';
import { HoldingRow } from './HoldingRow';
import type { Asset, FormHolding } from '@/types';

interface HoldingsListProps {
  holdings: FormHolding[];
  onAdd: (asset: Asset) => void;
  onChange: (tempId: string, amount: string, priceOverride?: string) => void;
  onRemove: (tempId: string) => void;
  errors?: Record<string, string>;
}

export function HoldingsList({
  holdings,
  onAdd,
  onChange,
  onRemove,
  errors = {},
}: HoldingsListProps) {
  const excludeAssetIds = holdings.map((h) => h.assetId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <AssetSearch
            onSelect={onAdd}
            excludeAssetIds={excludeAssetIds}
            placeholder="Add an asset..."
          />
        </div>
      </div>

      {holdings.length === 0 ? (
        <div className="py-8 text-center border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">
            No holdings yet. Search for an asset above to add your first holding.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {holdings.map((holding) => (
            <HoldingRow
              key={holding.tempId}
              holding={holding}
              onChange={(amount, priceOverride) => onChange(holding.tempId, amount, priceOverride)}
              onRemove={() => onRemove(holding.tempId)}
              error={errors[holding.tempId]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
