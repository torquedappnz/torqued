import React from 'react';
import { cn } from '../utils';

interface LogoProps {
  className?: string;
  variant?: 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({ className, variant = 'light' }) => {
  return (
    <div className={cn("flex items-center", className)}>
      <div className="bg-torqued-red px-4 py-1.5 skew-x-[-12deg] border border-white/20 shadow-[4px_4px_0px_0px_rgba(255,24,0,0.3)] flex items-center justify-center">
        <span className={cn(
          "font-display italic font-black text-2xl tracking-tighter text-white drop-shadow-sm",
          variant === 'dark' && "text-white"
        )}>
          TORQUED
        </span>
      </div>
    </div>
  );
};
