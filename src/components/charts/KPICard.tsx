import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  color?: 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'yellow';
  size?: 'sm' | 'md' | 'lg';
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color = 'blue',
  size = 'md'
}) => {
  const colorClasses = {
    green: {
      value: 'text-green-400',
      icon: 'text-green-400',
      bg: 'bg-green-500/20',
      border: 'border-green-500/30'
    },
    blue: {
      value: 'text-blue-400',
      icon: 'text-blue-400',
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/30'
    },
    purple: {
      value: 'text-purple-400',
      icon: 'text-purple-400',
      bg: 'bg-purple-500/20',
      border: 'border-purple-500/30'
    },
    orange: {
      value: 'text-orange-400',
      icon: 'text-orange-400',
      bg: 'bg-orange-500/20',
      border: 'border-orange-500/30'
    },
    red: {
      value: 'text-red-400',
      icon: 'text-red-400',
      bg: 'bg-red-500/20',
      border: 'border-red-500/30'
    },
    yellow: {
      value: 'text-yellow-400',
      icon: 'text-yellow-400',
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-500/30'
    }
  };

  const sizeClasses = {
    sm: {
      container: 'p-3',
      title: 'text-xs',
      value: 'text-lg',
      icon: 'h-5 w-5',
      trend: 'text-xs'
    },
    md: {
      container: 'p-4',
      title: 'text-sm',
      value: 'text-2xl',
      icon: 'h-6 w-6',
      trend: 'text-xs'
    },
    lg: {
      container: 'p-6',
      title: 'text-base',
      value: 'text-3xl',
      icon: 'h-8 w-8',
      trend: 'text-sm'
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className={`h-4 w-4 text-green-400`} />;
      case 'down':
        return <TrendingDown className={`h-4 w-4 text-red-400`} />;
      case 'stable':
        return <Minus className={`h-4 w-4 text-slate-400`} />;
      default:
        return null;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-400';
      case 'down':
        return 'text-red-400';
      case 'stable':
        return 'text-slate-400';
      default:
        return 'text-slate-400';
    }
  };

  const currentColor = colorClasses[color];
  const currentSize = sizeClasses[size];

  return (
    <div className={`bg-slate-700 rounded-lg border border-slate-600 ${currentSize.container} hover:bg-slate-600/50 transition-colors`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`${currentSize.title} font-medium text-slate-400 mb-1`}>
            {title}
          </p>
          <p className={`${currentSize.value} font-bold ${currentColor.value} mb-1`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
        
        {icon && (
          <div className={`${currentColor.bg} ${currentColor.border} border rounded-lg p-2 ml-3`}>
            <div className={`${currentColor.icon} ${currentSize.icon}`}>
              {icon}
            </div>
          </div>
        )}
      </div>

      {(trend || trendValue) && (
        <div className="flex items-center mt-3 pt-3 border-t border-slate-600">
          {trend && getTrendIcon()}
          {trendValue && (
            <span className={`${currentSize.trend} ${getTrendColor()} ml-1 font-medium`}>
              {trendValue}
            </span>
          )}
          {trend && !trendValue && (
            <span className={`${currentSize.trend} ${getTrendColor()} ml-1`}>
              {trend === 'up' ? 'Tendencia positiva' : 
               trend === 'down' ? 'Tendencia negativa' : 
               'Sin cambios'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default KPICard;

