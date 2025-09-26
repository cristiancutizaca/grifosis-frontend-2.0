import React from "react";

type KPICardProps = {
  title: string;
  value: string;
  icon: React.ReactNode;
  gradient: string;
  trend?: string;
};

export default function KPICard({ title, value, icon, gradient, trend }: KPICardProps) {
  const isPositive = trend ? trend.startsWith("+") : true;

  return (
    <div className="group relative bg-slate-800/80 backdrop-blur-sm rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-700/60 hover:shadow-xl hover:border-slate-600/80 transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between mb-3">
        <div
          className={`p-2 sm:p-3 bg-gradient-to-br ${gradient} rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300`}
        >
          <div className="text-white">{icon}</div>
        </div>
        {trend && (
          <div
            className={`text-xs font-medium px-2 py-1 rounded-lg border ${
              isPositive
                ? "text-emerald-400 bg-emerald-500/20 border-emerald-500/30"
                : "text-red-400 bg-red-500/20 border-red-500/30"
            }`}
          >
            {trend}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-xs sm:text-sm font-medium text-slate-400 mb-1">{title}</h3>
        <p className="text-xl sm:text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
