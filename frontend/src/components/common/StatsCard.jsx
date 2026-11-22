import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardBody } from './Card';

export const StatsCard = ({ title, value, subtitle, change, isPositive = true, icon: Icon }) => {
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-xs font-semibold text-[color:var(--muted)]">{title}</span>
          {Icon && <span className="metric-icon"><Icon size={16} aria-hidden="true" /></span>}
        </div>
        <div className="metric-data mt-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <strong className="metric-value">{value}</strong>
            {change && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold ${isPositive ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                <TrendIcon size={13} aria-hidden="true" /> {change}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-xs text-[color:var(--muted)]">{subtitle}</p>}
        </div>
      </CardBody>
    </Card>
  );
};
