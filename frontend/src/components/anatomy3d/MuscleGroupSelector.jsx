import React from 'react';
import {
  Shield,
  Layers,
  Activity,
  Flame,
  Zap,
  Target,
  Sparkles
} from 'lucide-react';

/**
 * MuscleGroupSelector Component
 * Responsive navigation bar for all 7 major human muscle groups.
 *
 * @param {Array} groups - List of major muscle group names
 * @param {string|null} activeGroup - Currently active/explored muscle group
 * @param {function} onSelectGroup - Callback when group is selected
 */
export const MuscleGroupSelector = ({
  groups = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Abs / Core', 'Calves'],
  activeGroup = 'Chest',
  onSelectGroup = () => {}
}) => {
  const groupIcons = {
    Chest: Shield,
    Back: Layers,
    Shoulders: Zap,
    Arms: Target,
    Legs: Flame,
    'Abs / Core': Activity,
    Calves: Sparkles
  };

  return (
    <div className="w-full flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mb-5">
      {groups.map((grpName) => {
        const isActive = activeGroup === grpName;
        const IconComponent = groupIcons[grpName] || Activity;

        return (
          <button
            key={`grp-btn-${grpName}`}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelectGroup(grpName)}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-sm ${
              isActive
                ? 'bg-[color:var(--lime)] text-slate-950 ring-2 ring-[color:var(--focus)]'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-cyan-500 hover:text-cyan-700 dark:hover:text-cyan-300'
            }`}
          >
            <IconComponent
              className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-cyan-600 dark:text-cyan-400'}`}
            />
            <span>{grpName}</span>
          </button>
        );
      })}
    </div>
  );
};
