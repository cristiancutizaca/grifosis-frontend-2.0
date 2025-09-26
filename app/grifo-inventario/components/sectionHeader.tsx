import React from "react";

interface SectionHeaderProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onAddClick: () => void;
  addLabel?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  onAddClick,
  addLabel = "Agregar",
}) => {
  return (
    <div className="bg-slate-800 rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-0">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-white">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="w-full sm:w-auto">
        <button
          onClick={onAddClick}
          className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-2 px-4 sm:py-3 sm:px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:shadow-orange-500/30 min-w-0 sm:min-w-[180px] text-base sm:text-lg"
        >
          <span className="text-lg font-bold">+</span> {addLabel}
        </button>
      </div>
    </div>
  );
};

export default SectionHeader;
