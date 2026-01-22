import { useState } from 'react';
import { useUpdatePropertyValue } from '@/api/hooks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PropertyWithDetails } from '@/types';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

interface UpdateValueDialogProps {
  property: PropertyWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateValueDialog({ property, open, onOpenChange }: UpdateValueDialogProps) {
  const [newValue, setNewValue] = useState('');
  const updateValue = useUpdatePropertyValue();

  // Reset form when dialog opens - using onOpenChange callback pattern
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && property) {
      setNewValue(property.currentValue.toString());
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!property) return;

    const value = parseFloat(newValue);
    if (isNaN(value) || value <= 0) return;

    try {
      await updateValue.mutateAsync({
        id: property.id,
        data: { value },
      });
      onOpenChange(false);
    } catch {
      // Error handling is done by the mutation hook
    }
  };

  const isValid = newValue && parseFloat(newValue) > 0;
  const hasChanged = property && parseFloat(newValue) !== property.currentValue;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Update Property Value</DialogTitle>
            <DialogDescription>
              {property && (
                <>
                  Update the current valuation for <strong>{property.name}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {property && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">Current Value</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(property.currentValue)}
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="newValue">New Value (EUR)</Label>
              <Input
                id="newValue"
                type="number"
                step="any"
                min="0"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter new value"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || !hasChanged || updateValue.isPending}
            >
              {updateValue.isPending ? 'Updating...' : 'Update Value'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
