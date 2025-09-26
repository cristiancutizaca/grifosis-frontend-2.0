import React from 'react';

interface InventoryIndicatorProps {
  fuel: string;
  percentage: number;
  color?: string;
  className?: string;
}


const InventoryIndicator: React.FC<InventoryIndicatorProps> = ({
  fuel,
  percentage,
  color = 'bg-blue-500',
  className = ''
}) => {
  const getColorClass = () => {
    if (percentage > 70) return 'bg-green-500';
    if (percentage > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-lg p-4 ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-slate-300 font-medium">{fuel}</span>
        <span className="text-white font-bold">{percentage}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div
          className={`${getColorClass()} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default InventoryIndicator;

