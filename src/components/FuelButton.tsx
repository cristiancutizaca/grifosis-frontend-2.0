import React from 'react';
import { Fuel } from 'lucide-react';

interface FuelButtonProps {
  type: 'Diesel' | 'Premium' | 'Regular';
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}


const FuelButton: React.FC<FuelButtonProps> = ({
  type,
  selected = false,
  onClick,
  className = ''
}) => {
  const getButtonColor = () => {
    if (selected) {
      return 'bg-orange-500 hover:bg-orange-600 text-white';
    }
    return 'bg-slate-700 hover:bg-slate-600 text-slate-300';
  };

  return (
    <button
      onClick={onClick}
      className={`${getButtonColor()} rounded-lg p-6 flex flex-col items-center justify-center 
        transition-all duration-200 border border-slate-600 hover:border-orange-500 
        min-h-[120px] ${className}`}
    >
      <Fuel size={32} className="mb-3" />
      <span className="text-xl font-semibold">{type}</span>
    </button>
  );
};

export default FuelButton;

