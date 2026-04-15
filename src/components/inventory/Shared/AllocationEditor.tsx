import { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { AllocationSnapshot } from '../../../types';

interface AllocationEditorProps {
  totalStock: number;
  allocations: AllocationSnapshot;
  onChange: (allocations: AllocationSnapshot) => void;
  disabled?: boolean;
  showPercentages?: boolean;
  compact?: boolean;
}

export default function AllocationEditor({
  totalStock,
  allocations,
  onChange,
  disabled = false,
  showPercentages = true,
  compact = false,
}: AllocationEditorProps) {
  // Guard against missing allocations
  const safeAllocs: AllocationSnapshot = {
    store: allocations?.store ?? 0,
    auction: allocations?.auction ?? 0,
    packs: allocations?.packs ?? 0,
  };
  const total = safeAllocs.store + safeAllocs.auction + safeAllocs.packs;
  const isValid = total <= totalStock;

  const percentages = useMemo(() => ({
    store: totalStock > 0 ? Math.round((safeAllocs.store / totalStock) * 100) : 0,
    auction: totalStock > 0 ? Math.round((safeAllocs.auction / totalStock) * 100) : 0,
    packs: totalStock > 0 ? Math.round((safeAllocs.packs / totalStock) * 100) : 0,
  }), [allocations, totalStock]);

  const handleChange = (channel: keyof AllocationSnapshot, value: number) => {
    const clamped = Math.max(0, Math.min(value, totalStock));
    onChange({ ...safeAllocs, [channel]: clamped });
  };

  const inputClass = compact
    ? 'w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-quirky focus:bg-white transition-colors'
    : 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-quirky focus:bg-white transition-colors';

  const labelClass = compact
    ? 'text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1'
    : 'text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1.5';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {/* Store */}
        <div>
          <label className={labelClass}>🏪 Store</label>
          <input
            type="number"
            min="0"
            max={totalStock}
            value={safeAllocs.store}
            onChange={(e) => handleChange('store', Number(e.target.value))}
            disabled={disabled}
            className={cn(inputClass, disabled && 'opacity-60 cursor-not-allowed')}
          />
          {showPercentages && (
            <p className="text-[9px] text-gray-400 mt-0.5 font-medium">{percentages.store}%</p>
          )}
        </div>

        {/* Auction */}
        <div>
          <label className={labelClass}>🏆 Auction</label>
          <input
            type="number"
            min="0"
            max={totalStock}
            value={safeAllocs.auction}
            onChange={(e) => handleChange('auction', Number(e.target.value))}
            disabled={disabled}
            className={cn(inputClass, disabled && 'opacity-60 cursor-not-allowed')}
          />
          {showPercentages && (
            <p className="text-[9px] text-gray-400 mt-0.5 font-medium">{percentages.auction}%</p>
          )}
        </div>

        {/* Packs */}
        <div>
          <label className={labelClass}>🎁 Packs</label>
          <input
            type="number"
            min="0"
            max={totalStock}
            value={safeAllocs.packs}
            onChange={(e) => handleChange('packs', Number(e.target.value))}
            disabled={disabled}
            className={cn(inputClass, disabled && 'opacity-60 cursor-not-allowed')}
          />
          {showPercentages && (
            <p className="text-[9px] text-gray-400 mt-0.5 font-medium">{percentages.packs}%</p>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      <div className={cn(
        'rounded-2xl border-2 p-3 flex items-center justify-between',
        isValid
          ? 'bg-green-50 border-green-200'
          : 'bg-red-50 border-red-200'
      )}>
        <span className={cn(
          'text-xs font-bold',
          isValid ? 'text-green-700' : 'text-red-700'
        )}>
          Allocated: {total} / {totalStock}
        </span>
        <span className={cn(
          'text-sm font-black',
          isValid ? 'text-green-600' : 'text-red-600'
        )}>
          {isValid ? '✓' : '✕'}
        </span>
      </div>

      {!isValid && (
        <p className="text-xs text-red-600 font-semibold">
          ⚠ Cannot allocate more than total stock ({totalStock} units)
        </p>
      )}
    </div>
  );
}
