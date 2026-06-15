import React from 'react';
import { cn } from '../utils';

interface LogoProps {
  className?: string;
  variant?: 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <div className={cn("flex items-center", className)}>
      <img
        src="/torqued-logo-flat.png"
        alt="Torqued"
        className="h-9 w-auto object-contain"
      />
    </div>
  );
};
