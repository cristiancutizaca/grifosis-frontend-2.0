import React from "react";

type SectionTitleProps = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
};

export default function SectionTitle({
  title,
  subtitle,
  icon,
}: SectionTitleProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {icon && <div className="text-slate-400">{icon}</div>}
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}
