import { useState, useMemo } from 'react';
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
  const total = allocations.store + allocations.auction + allocations.packs;
  const isValid = total <= totalStock;

  const percentages = useMemo(() => ({
    store: totalStock > 0 ? Math.round((allocations.store / totalStock) * 100) : 0,
    auction: totalStock > 0 ? Math.round((allocations.auction / totalStock) * 100) : 0,
    packs: totalStock > 0 ? Math.round((allocations.packs / totalStock) * 100) : 0,
  }), [allocations, totalStock]);

  const handleChange = (channel: keyof AllocationSnapshot, value: number) => {
    const clamped = Math.max(0, Math.min(value, totalStock));
    onChange({ ...allocations, [channel]: clamped });
  };

  const inputClass = compact
    ? 'w-full px-2 py-1 bg-white border border-purple-100 rounded-lg text-xs font-bold text-purple-800 focus:outline-none focus:border-purple-400'
    : 'w-full px-3 py-2 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-400';

  const labelClass = compact
    ? 'text-[7px] font-bold text-purple-400 block mb-0.5'
    : 'text-[8px] font-bold text-purple-400 block mb-1';

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
            value={allocations.store}
            onChange={(e) => handleChange('store', Number(e.target.value))}
            disabled={disabled}
            className={cn(inputClass, disabled && 'opacity-60 cursor-not-allowed')}
          />
          {showPercentages && (
            <p className="text-[7px] text-purple-400 mt-0.5">{percentages.store}%</p>
          )}
        </div>

        {/* Auction */}
        <div>
          <label className={labelClass}>🏆 Auction</label>
          <input
            type="number"
            min="0"
            max={totalStock}
            value={allocations.auction}
            onChange={(e) => handleChange('auction', Number(e.target.value))}
            disabled={disabled}
            className={cn(inputClass, disabled && 'opacity-60 cursor-not-allowed')}
          />
          {showPercentages && (
            <p className="text-[7px] text-purple-400 mt-0.5">{percentages.auction}%</p>
          )}
        </div>

        {/* Packs */}
        <div>
          <label className={labelClass}>🎁 Packs</label>
          <input
            type="number"
            min="0"
            max={totalStock}
            value={allocations.packs}
            onChange={(e) => handleChange('packs', Number(e.target.value))}
            disabled={disabled}
            className={cn(inputClass, disabled && 'opacity-60 cursor-not-allowed')}
          />
          {showPercentages && (
            <p className="text-[7px] text-purple-400 mt-0.5">{percentages.packs}%</p>
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
