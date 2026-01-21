import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useLiabilities } from '@/api/hooks';
import type { Liability } from '@/types';

interface LiabilitySearchProps {
  onSelect: (liability: Liability) => void;
  excludeLiabilityIds?: number[];
  placeholder?: string;
}

export function LiabilitySearch({
  onSelect,
  excludeLiabilityIds = [],
  placeholder = 'Select a liability...',
}: LiabilitySearchProps) {
  const [open, setOpen] = useState(false);
  const { data: liabilities, isLoading } = useLiabilities();

  // Filter out excluded liabilities
  const filteredLiabilities = liabilities?.filter(
    (liability) => !excludeLiabilityIds.includes(liability.id)
  );

  const handleSelect = (liability: Liability) => {
    onSelect(liability);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="text-muted-foreground">{placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search liabilities..." />
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading...
                </span>
              </div>
            )}
            {!isLoading && !filteredLiabilities?.length && (
              <CommandEmpty>No liabilities found.</CommandEmpty>
            )}
            {filteredLiabilities && filteredLiabilities.length > 0 && (
              <CommandGroup>
                {filteredLiabilities.map((liability) => (
                  <CommandItem
                    key={liability.id}
                    value={`${liability.name}-${liability.id}`}
                    onSelect={() => handleSelect(liability)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        excludeLiabilityIds.includes(liability.id)
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{liability.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {liability.liabilityType} - Original: {new Intl.NumberFormat('en-GB', {
                          style: 'currency',
                          currency: liability.currency,
                        }).format(liability.originalAmount)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
