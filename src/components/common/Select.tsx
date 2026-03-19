import React, { useState } from 'react';
import { Dropdown } from './Dropdown';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (val: string) => void;
  onHover?: (val: string | null) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Standard Multi-Step Select Component built on Dropdown atomic component
 */
export const Select: React.FC<SelectProps> = ({ 
  value, 
  options, 
  onChange, 
  onHover, 
  placeholder,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);

  const Trigger = (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg 
      bg-black/40 border transition-all duration-300 group
      ${isOpen ? 'border-[#0A84FF]/60 ring-2 ring-[#0A84FF]/20' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]'}
      ${className}`}>
      <span className={`text-[11px] font-bold tracking-tight truncate 
        ${selectedOption ? 'text-white/90' : 'text-white/30'}`}>
        {selectedOption ? selectedOption.label : placeholder || '请选择'}
      </span>
      <svg className={`w-3.5 h-3.5 text-white/30 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );

  return (
    <Dropdown 
      isOpen={isOpen} 
      onOpenChange={setIsOpen} 
      trigger={Trigger}
    >
      <div className="max-h-[220px] overflow-y-auto custom-scrollbar scroll-smooth min-w-[140px] px-1">
        {options.map((opt) => (
          <div 
            key={opt.value}
            onMouseEnter={() => !opt.disabled && onHover?.(opt.value)}
            onMouseLeave={() => !opt.disabled && onHover?.(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (!opt.disabled) {
                onChange(opt.value);
                setIsOpen(false);
              }
            }}
            className={`px-3 py-2 rounded-md text-[11px] font-bold mb-0.5 
              transition-all flex items-center justify-between gap-3
              ${opt.disabled ? 'opacity-20 cursor-not-allowed text-white/10 italic' : 
                opt.value === value 
                  ? 'bg-gradient-to-r from-[#0A84FF] to-[#0A84FF]/80 text-white shadow-[0_0_12px_rgba(10,132,255,0.4)]' 
                  : 'text-white/60 hover:bg-[#0A84FF]/15 hover:text-[#0A84FF] cursor-pointer active:scale-95'}`}
          >
            <span className="whitespace-nowrap">{opt.label}</span>
            {opt.value === value && (
              <svg className="w-3 h-3 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        ))}

        {options.length === 0 && (
          <div className="px-3 py-5 text-center text-[10px] text-white/20 uppercase tracking-widest font-black">
            Empty Dataset
          </div>
        )}
      </div>
    </Dropdown>
  );
};
