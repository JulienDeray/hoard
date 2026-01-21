import { Plus } from 'lucide-react';
import { LiabilitySearch } from './LiabilitySearch';
import { LiabilityBalanceRow } from './LiabilityBalanceRow';
import type { Liability, FormLiabilityBalance } from '@/types';

interface LiabilityBalancesListProps {
  liabilityBalances: FormLiabilityBalance[];
  onAdd: (liability: Liability) => void;
  onChange: (tempId: string, outstandingAmount: string) => void;
  onRemove: (tempId: string) => void;
  errors?: Record<string, string>;
}

export function LiabilityBalancesList({
  liabilityBalances,
  onAdd,
  onChange,
  onRemove,
  errors = {},
}: LiabilityBalancesListProps) {
  const excludeLiabilityIds = liabilityBalances.map((lb) => lb.liabilityId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <LiabilitySearch
            onSelect={onAdd}
            excludeLiabilityIds={excludeLiabilityIds}
            placeholder="Add a liability..."
          />
        </div>
      </div>

      {liabilityBalances.length === 0 ? (
        <div className="py-8 text-center border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">
            No liabilities yet. Select a liability above to track its balance.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {liabilityBalances.map((liabilityBalance) => (
            <LiabilityBalanceRow
              key={liabilityBalance.tempId}
              liabilityBalance={liabilityBalance}
              onChange={(outstandingAmount) =>
                onChange(liabilityBalance.tempId, outstandingAmount)
              }
              onRemove={() => onRemove(liabilityBalance.tempId)}
              error={errors[liabilityBalance.tempId]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
