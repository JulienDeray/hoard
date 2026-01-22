import { useState, useEffect } from 'react';
import { Check, Loader2, Home } from 'lucide-react';
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
import { useAssetSearch } from '@/api/hooks';
import type { Asset } from '@/types';

interface AssetSearchProps {
  onSelect: (asset: Asset) => void;
  excludeAssetIds?: number[];
  placeholder?: string;
}

export function AssetSearch({
  onSelect,
  excludeAssetIds = [],
  placeholder = 'Search assets...',
}: AssetSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: assets, isLoading } = useAssetSearch(debouncedQuery);

  // Filter out excluded assets
  const filteredAssets = assets?.filter(
    (asset) => !excludeAssetIds.includes(asset.id)
  );

  const handleSelect = (asset: Asset) => {
    onSelect(asset);
    setOpen(false);
    setQuery('');
    setDebouncedQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start"
        >
          <span className="text-muted-foreground">{placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading && debouncedQuery.length >= 2 && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Searching...
                </span>
              </div>
            )}
            {!isLoading && debouncedQuery.length >= 2 && !filteredAssets?.length && (
              <CommandEmpty>No assets found.</CommandEmpty>
            )}
            {debouncedQuery.length < 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            )}
            {filteredAssets && filteredAssets.length > 0 && (
              <CommandGroup>
                {filteredAssets.map((asset) => {
                  const isRealEstate = asset.asset_class === 'REAL_ESTATE';
                  return (
                    <CommandItem
                      key={asset.id}
                      value={`${asset.symbol}-${asset.id}`}
                      onSelect={() => handleSelect(asset)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          excludeAssetIds.includes(asset.id)
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      {isRealEstate && (
                        <Home className="mr-2 h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{asset.symbol}</span>
                          {isRealEstate && (
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              Property
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {asset.name}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
