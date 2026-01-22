import { useState } from 'react';
import { useCreateProperty } from '@/api/hooks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import type { PropertyType, CreatePropertyRequest } from '@/types';

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'PRIMARY_RESIDENCE', label: 'Primary Residence' },
  { value: 'RENTAL', label: 'Rental Property' },
  { value: 'VACATION', label: 'Vacation Home' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'LAND', label: 'Land' },
  { value: 'OTHER', label: 'Other' },
];

interface AddPropertyDialogProps {
  trigger?: React.ReactNode;
}

export function AddPropertyDialog({ trigger }: AddPropertyDialogProps) {
  const [open, setOpen] = useState(false);
  const [showMortgage, setShowMortgage] = useState(false);
  const createProperty = useCreateProperty();

  // Form state
  const [name, setName] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('PRIMARY_RESIDENCE');
  const [currentValue, setCurrentValue] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');

  // Mortgage form state
  const [mortgageName, setMortgageName] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [outstandingAmount, setOutstandingAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');

  const resetForm = () => {
    setName('');
    setPropertyType('PRIMARY_RESIDENCE');
    setCurrentValue('');
    setCity('');
    setCountry('');
    setAddress('');
    setShowMortgage(false);
    setMortgageName('');
    setOriginalAmount('');
    setOutstandingAmount('');
    setInterestRate('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const value = parseFloat(currentValue);
    if (!name || isNaN(value) || value <= 0) return;

    const data: CreatePropertyRequest = {
      name,
      propertyType,
      currentValue: value,
      city: city || undefined,
      country: country || undefined,
      address: address || undefined,
    };

    if (showMortgage && mortgageName && originalAmount && outstandingAmount) {
      const origAmount = parseFloat(originalAmount);
      const outAmount = parseFloat(outstandingAmount);
      const rate = interestRate ? parseFloat(interestRate) : undefined;

      if (!isNaN(origAmount) && !isNaN(outAmount)) {
        data.mortgage = {
          name: mortgageName,
          originalAmount: origAmount,
          outstandingAmount: outAmount,
          interestRate: rate,
        };
      }
    }

    try {
      await createProperty.mutateAsync(data);
      resetForm();
      setOpen(false);
    } catch {
      // Error handling is done by the mutation hook
    }
  };

  const isValid = name && currentValue && parseFloat(currentValue) > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Property
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Property</DialogTitle>
            <DialogDescription>
              Add a new real estate property to track in your portfolio.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Property Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Main Apartment"
                required
              />
            </div>

            {/* Property Type */}
            <div className="grid gap-2">
              <Label htmlFor="propertyType">Property Type *</Label>
              <select
                id="propertyType"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {PROPERTY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Current Value */}
            <div className="grid gap-2">
              <Label htmlFor="currentValue">Current Value (EUR) *</Label>
              <Input
                id="currentValue"
                type="number"
                step="any"
                min="0"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="e.g., 250000"
                required
              />
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g., Paris"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g., France"
                />
              </div>
            </div>

            {/* Address */}
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 123 Rue de la Paix"
              />
            </div>

            {/* Mortgage Section */}
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between px-0 font-medium"
                onClick={() => setShowMortgage(!showMortgage)}
              >
                <span>Add Mortgage</span>
                {showMortgage ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {showMortgage && (
                <div className="mt-4 grid gap-4 rounded-lg border bg-muted/30 p-4">
                  <div className="grid gap-2">
                    <Label htmlFor="mortgageName">Mortgage Name</Label>
                    <Input
                      id="mortgageName"
                      value={mortgageName}
                      onChange={(e) => setMortgageName(e.target.value)}
                      placeholder="e.g., Home Loan"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-2">
                      <Label htmlFor="originalAmount">Original Amount</Label>
                      <Input
                        id="originalAmount"
                        type="number"
                        step="any"
                        min="0"
                        value={originalAmount}
                        onChange={(e) => setOriginalAmount(e.target.value)}
                        placeholder="e.g., 200000"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="outstandingAmount">Outstanding</Label>
                      <Input
                        id="outstandingAmount"
                        type="number"
                        step="any"
                        min="0"
                        value={outstandingAmount}
                        onChange={(e) => setOutstandingAmount(e.target.value)}
                        placeholder="e.g., 180000"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="interestRate">Interest Rate (%)</Label>
                    <Input
                      id="interestRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      placeholder="e.g., 2.5"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || createProperty.isPending}>
              {createProperty.isPending ? 'Adding...' : 'Add Property'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
