import React from 'react';
import { cn } from '../utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className, hoverable, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-3xl shadow-xl overflow-hidden backdrop-blur-md transition-colors duration-300",
        hoverable && "transition-all hover:bg-white/10 dark:hover:bg-white/5 hover:border-torqued-red/30 cursor-pointer active:scale-[0.98]",
        className
      )}
    >
      {children}
    </div>
  );
};
