import React, { useState, useEffect, useRef } from 'react';

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  dropdownClassName?: string;
}

/**
 * Low-level Dropdown Component (Physics-based)
 * Handles: Motion, Backdrop-blur, Click-outside, Shadow
 */
export const Dropdown: React.FC<DropdownProps> = ({ 
  trigger, 
  children, 
  isOpen, 
  onOpenChange,
  className = "",
  dropdownClassName = ""
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div 
        onClick={() => onOpenChange(!isOpen)}
        className="w-full cursor-pointer"
      >
        {trigger}
      </div>

      {isOpen && (
        <div 
          className={`absolute top-[calc(100%+6px)] left-0 right-0 z-[100] 
          bg-[rgba(32,32,35,0.92)] backdrop-blur-2xl border border-white/10 
          rounded-xl shadow-[0_15px_50px_rgba(0,0,0,0.6)] p-1.5 
          animate-in zoom-in-95 fade-in slide-in-from-top-2 duration-200 ${dropdownClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
};
