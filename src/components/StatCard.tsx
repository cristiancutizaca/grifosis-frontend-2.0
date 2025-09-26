import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  valueColor?: string;
  className?: string;
}


const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  valueColor = 'text-white',
  className = ''
}) => {
  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-slate-400 mb-1">{title}</h3>
          <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="ml-4">
            <Icon size={24} className="text-slate-400" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;

