import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { format, parse, isValid } from 'date-fns';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DatePicker } from './DatePicker';
import { HoldingsList } from './HoldingsList';
import { LiabilityBalancesList } from './LiabilityBalancesList';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import {
  useCreateSnapshot,
  useAddHolding,
  useUpdateHolding,
  useDeleteHolding,
  useAddLiabilityBalance,
  useUpdateLiabilityBalance,
  useDeleteLiabilityBalance,
} from '@/api/hooks';
import { ApiError } from '@/api/client';
import type { Asset, Liability, FormHolding, FormLiabilityBalance, SnapshotFormData } from '@/types';

interface SnapshotFormProps {
  mode: 'create' | 'edit';
  initialData?: SnapshotFormData;
  snapshotDate?: string;
  onSuccess: () => void;
}

interface ValidationErrors {
  date?: string;
  holdings?: string;
  amounts?: Record<string, string>;
  liabilityAmounts?: Record<string, string>;
  general?: string;
}

function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function SnapshotForm({
  mode,
  initialData,
  snapshotDate,
  onSuccess,
}: SnapshotFormProps) {
  const navigate = useNavigate();

  // Form state
  const [date, setDate] = useState<Date | undefined>(() => {
    if (initialData?.date) {
      const parsed = parse(initialData.date, 'yyyy-MM-dd', new Date());
      return isValid(parsed) ? parsed : undefined;
    }
    return mode === 'create' ? new Date() : undefined;
  });
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [holdings, setHoldings] = useState<FormHolding[]>(
    initialData?.holdings || []
  );
  const [liabilityBalances, setLiabilityBalances] = useState<FormLiabilityBalance[]>(
    initialData?.liabilityBalances || []
  );

  // UI state
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Mutations
  const createSnapshot = useCreateSnapshot();
  const addHolding = useAddHolding();
  const updateHolding = useUpdateHolding();
  const deleteHolding = useDeleteHolding();
  const addLiabilityBalance = useAddLiabilityBalance();
  const updateLiabilityBalance = useUpdateLiabilityBalance();
  const deleteLiabilityBalance = useDeleteLiabilityBalance();

  // Track if form is dirty
  const isDirty = useMemo(() => {
    if (mode === 'create') {
      return holdings.length > 0 || liabilityBalances.length > 0 || notes !== '';
    }
    // Edit mode: compare with initial data
    if (!initialData) return false;
    if (notes !== initialData.notes) return true;
    if (holdings.length !== initialData.holdings.length) return true;
    if (liabilityBalances.length !== initialData.liabilityBalances.length) return true;

    const holdingsDirty = holdings.some((h) => {
      const original = initialData.holdings.find((oh) => oh.assetId === h.assetId);
      if (!original) return true;
      return h.amount !== String(original.originalAmount);
    });

    const liabilityBalancesDirty = liabilityBalances.some((lb) => {
      const original = initialData.liabilityBalances.find((olb) => olb.liabilityId === lb.liabilityId);
      if (!original) return true;
      return lb.outstandingAmount !== String(original.originalOutstandingAmount);
    });

    return holdingsDirty || liabilityBalancesDirty;
  }, [mode, holdings, liabilityBalances, notes, initialData]);

  useUnsavedChanges(isDirty);

  // Handlers
  const handleAddHolding = useCallback((asset: Asset) => {
    const newHolding: FormHolding = {
      tempId: generateTempId(),
      assetId: asset.id,
      assetSymbol: asset.symbol,
      assetName: asset.name,
      assetClass: asset.asset_class,
      amount: '',
    };
    setHoldings((prev) => [...prev, newHolding]);
    setErrors((prev) => ({ ...prev, holdings: undefined }));
  }, []);

  const handleChangeHolding = useCallback((tempId: string, amount: string, priceOverride?: string) => {
    setHoldings((prev) =>
      prev.map((h) => (h.tempId === tempId ? { ...h, amount, priceOverride } : h))
    );
    setErrors((prev) => ({
      ...prev,
      amounts: { ...prev.amounts, [tempId]: '' },
    }));
  }, []);

  const handleRemoveHolding = useCallback((tempId: string) => {
    setHoldings((prev) => prev.filter((h) => h.tempId !== tempId));
  }, []);

  // Liability balance handlers
  const handleAddLiabilityBalance = useCallback((liability: Liability) => {
    const newLiabilityBalance: FormLiabilityBalance = {
      tempId: generateTempId(),
      liabilityId: liability.id,
      liabilityName: liability.name,
      liabilityType: liability.liabilityType,
      originalAmount: liability.originalAmount,
      outstandingAmount: '',
    };
    setLiabilityBalances((prev) => [...prev, newLiabilityBalance]);
  }, []);

  const handleChangeLiabilityBalance = useCallback((tempId: string, outstandingAmount: string) => {
    setLiabilityBalances((prev) =>
      prev.map((lb) => (lb.tempId === tempId ? { ...lb, outstandingAmount } : lb))
    );
    setErrors((prev) => ({
      ...prev,
      liabilityAmounts: { ...prev.liabilityAmounts, [tempId]: '' },
    }));
  }, []);

  const handleRemoveLiabilityBalance = useCallback((tempId: string) => {
    setLiabilityBalances((prev) => prev.filter((lb) => lb.tempId !== tempId));
  }, []);

  // Validation
  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    // Date validation (create mode only)
    if (mode === 'create' && !date) {
      newErrors.date = 'Date is required';
    }

    // Holdings validation
    if (holdings.length === 0) {
      newErrors.holdings = 'At least one holding is required';
    }

    // Amount validation
    const amountErrors: Record<string, string> = {};
    holdings.forEach((h) => {
      const amount = parseFloat(h.amount);
      if (!h.amount || isNaN(amount)) {
        amountErrors[h.tempId] = 'Amount is required';
      } else if (amount <= 0) {
        amountErrors[h.tempId] = 'Amount must be greater than 0';
      }
    });

    if (Object.keys(amountErrors).length > 0) {
      newErrors.amounts = amountErrors;
    }

    // Liability amount validation
    const liabilityAmountErrors: Record<string, string> = {};
    liabilityBalances.forEach((lb) => {
      const amount = parseFloat(lb.outstandingAmount);
      if (!lb.outstandingAmount || isNaN(amount)) {
        liabilityAmountErrors[lb.tempId] = 'Amount is required';
      } else if (amount < 0) {
        liabilityAmountErrors[lb.tempId] = 'Amount must be 0 or greater';
      }
    });

    if (Object.keys(liabilityAmountErrors).length > 0) {
      newErrors.liabilityAmounts = liabilityAmountErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [mode, date, holdings, liabilityBalances]);

  // Save handlers
  const handleSaveCreate = async () => {
    if (!date) return;

    const dateStr = format(date, 'yyyy-MM-dd');

    try {
      // Create snapshot
      await createSnapshot.mutateAsync({ date: dateStr, notes: notes || undefined });

      // Add all holdings (with optional price override)
      for (const holding of holdings) {
        const priceOverride = holding.priceOverride
          ? parseFloat(holding.priceOverride)
          : undefined;
        await addHolding.mutateAsync({
          date: dateStr,
          data: {
            assetId: holding.assetId,
            amount: parseFloat(holding.amount),
            priceOverride: priceOverride && !isNaN(priceOverride) ? priceOverride : undefined,
          },
        });
      }

      // Add all liability balances
      for (const liabilityBalance of liabilityBalances) {
        await addLiabilityBalance.mutateAsync({
          date: dateStr,
          data: {
            liabilityId: liabilityBalance.liabilityId,
            outstandingAmount: parseFloat(liabilityBalance.outstandingAmount),
          },
        });
      }

      onSuccess();
      navigate(`/snapshots/${dateStr}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SNAPSHOT_ALREADY_EXISTS') {
        setErrors((prev) => ({
          ...prev,
          date: 'A snapshot already exists for this date',
        }));
      } else {
        setErrors((prev) => ({
          ...prev,
          general: error instanceof Error ? error.message : 'An error occurred',
        }));
      }
      throw error;
    }
  };

  const handleSaveEdit = async () => {
    if (!snapshotDate || !initialData) return;

    try {
      // Compute holdings diff
      const currentHoldingIds = new Set(holdings.map((h) => h.assetId));

      // Deleted holdings
      for (const initial of initialData.holdings) {
        if (!currentHoldingIds.has(initial.assetId)) {
          await deleteHolding.mutateAsync({
            date: snapshotDate,
            assetId: initial.assetId,
          });
        }
      }

      // New and modified holdings
      for (const holding of holdings) {
        const original = initialData.holdings.find((h) => h.assetId === holding.assetId);
        const amount = parseFloat(holding.amount);
        const priceOverride = holding.priceOverride
          ? parseFloat(holding.priceOverride)
          : undefined;

        if (!original) {
          // New holding (with optional price override)
          await addHolding.mutateAsync({
            date: snapshotDate,
            data: {
              assetId: holding.assetId,
              amount,
              priceOverride: priceOverride && !isNaN(priceOverride) ? priceOverride : undefined,
            },
          });
        } else if (original.originalAmount !== amount) {
          // Modified holding
          await updateHolding.mutateAsync({
            date: snapshotDate,
            assetId: holding.assetId,
            data: { amount },
          });
        }
      }

      // Compute liability balances diff
      const currentLiabilityIds = new Set(liabilityBalances.map((lb) => lb.liabilityId));

      // Deleted liability balances
      for (const initial of initialData.liabilityBalances) {
        if (!currentLiabilityIds.has(initial.liabilityId)) {
          await deleteLiabilityBalance.mutateAsync({
            date: snapshotDate,
            liabilityId: initial.liabilityId,
          });
        }
      }

      // New and modified liability balances
      for (const liabilityBalance of liabilityBalances) {
        const original = initialData.liabilityBalances.find(
          (lb) => lb.liabilityId === liabilityBalance.liabilityId
        );
        const outstandingAmount = parseFloat(liabilityBalance.outstandingAmount);

        if (!original) {
          // New liability balance
          await addLiabilityBalance.mutateAsync({
            date: snapshotDate,
            data: {
              liabilityId: liabilityBalance.liabilityId,
              outstandingAmount,
            },
          });
        } else if (original.originalOutstandingAmount !== outstandingAmount) {
          // Modified liability balance
          await updateLiabilityBalance.mutateAsync({
            date: snapshotDate,
            liabilityId: liabilityBalance.liabilityId,
            data: { outstandingAmount },
          });
        }
      }

      onSuccess();
      navigate(`/snapshots/${snapshotDate}`);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        general: error instanceof Error ? error.message : 'An error occurred',
      }));
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSaving(true);
    setErrors({});

    try {
      if (mode === 'create') {
        await handleSaveCreate();
      } else {
        await handleSaveEdit();
      }
    } catch {
      // Error already handled in save handlers
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      navigate(-1);
    }
  };

  const handleDiscard = () => {
    setShowDiscardDialog(false);
    navigate(-1);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.general && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">{errors.general}</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Snapshot Details</CardTitle>
            <CardDescription>
              {mode === 'create'
                ? 'Create a new portfolio snapshot'
                : 'Edit snapshot details'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              {mode === 'create' ? (
                <DatePicker
                  value={date}
                  onChange={setDate}
                  disabled={isSaving}
                  error={errors.date}
                />
              ) : (
                <p className="text-sm py-2">{snapshotDate}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this snapshot..."
                disabled={isSaving}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
            <CardDescription>
              Add the assets and amounts for this snapshot
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errors.holdings && (
              <p className="text-sm text-destructive mb-4">{errors.holdings}</p>
            )}
            <HoldingsList
              holdings={holdings}
              onAdd={handleAddHolding}
              onChange={handleChangeHolding}
              onRemove={handleRemoveHolding}
              errors={errors.amounts}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liabilities</CardTitle>
            <CardDescription>
              Track outstanding balances on loans, mortgages, and credit lines
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LiabilityBalancesList
              liabilityBalances={liabilityBalances}
              onAdd={handleAddLiabilityBalance}
              onChange={handleChangeLiabilityBalance}
              onRemove={handleRemoveLiabilityBalance}
              errors={errors.liabilityAmounts}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Create Snapshot' : 'Save Changes'}
          </Button>
        </div>
      </form>

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
