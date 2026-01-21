import { cn } from '@/lib/utils';

interface AllocationBarProps {
  current: number; // percentage 0-100
  target: number; // percentage 0-100
  className?: string;
}

export function AllocationBar({ current, target, className }: AllocationBarProps) {
  const maxPercentage = Math.max(current, target, 1);
  const scale = 100 / maxPercentage;

  const currentWidth = current * scale;
  const targetWidth = target * scale;

  const difference = current - target;
  const isBalanced = Math.abs(difference) < 0.5;
  const isOverweight = difference > 0;

  const currentColor = isBalanced
    ? 'bg-green-500'
    : isOverweight
      ? 'bg-orange-500'
      : 'bg-blue-500';

  return (
    <div className={cn('w-full min-w-[120px] space-y-1', className)}>
      {/* Current allocation bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-12">Current</span>
        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', currentColor)}
            style={{ width: `${currentWidth}%` }}
          />
        </div>
      </div>

      {/* Target allocation bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-12">Target</span>
        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-slate-400 transition-all"
            style={{ width: `${targetWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}
