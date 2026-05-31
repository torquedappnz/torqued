import React from 'react';
import { cn } from '../utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, className, ...props }) => {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1 transition-colors duration-300">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/30">
            {icon}
          </div>
        )}
        <input 
          className={cn(
            "w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:bg-card focus:border-torqued-red text-foreground transition-all placeholder:text-muted/30",
            icon && "pl-11",
            error && "border-torqued-red bg-torqued-red/5",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500 ml-1">{error}</p>}
    </div>
  );
};
