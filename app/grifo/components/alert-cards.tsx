import React from "react";

type AlertCardProps = {
  title: string;
  icon: React.ReactNode;
  items: any[];
  renderItem: (item: any) => React.ReactNode;
  emptyMessage: string;
};

export default function AlertCard({
  title,
  icon,
  items,
  renderItem,
  emptyMessage,
}: AlertCardProps) {
  return (
    <div className="border border-slate-600/60 rounded-xl p-3 bg-slate-700/50">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-slate-400">{icon}</div>
        <span className="text-sm font-medium text-slate-200">{title}</span>
        {items.length > 0 && (
          <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full ml-auto">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-xs text-slate-500 py-2">{emptyMessage}</div>
      ) : (
        <div className="space-y-1.5 max-h-24 overflow-y-auto">
          {items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="text-xs">
              {renderItem(item)}
            </div>
          ))}
          {items.length > 3 && (
            <div className="text-xs text-slate-500 text-center pt-1 border-t border-slate-600">
              +{items.length - 3} más
            </div>
          )}
        </div>
      )}
    </div>
  );
}
