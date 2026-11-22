import React, { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { mockExercises } from '../data/mockData';
import { exerciseMotions } from '../data/exerciseMotions';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { WorkspaceHeading } from '../components/layout/WorkspaceHeading';
import { GymFit3DAnatomyViewer } from '../components/anatomy3d/GymFit3DAnatomyViewer';
import {
  RotateCcw,
  Target,
  Sparkles
} from 'lucide-react';

const movementOptions = mockExercises.filter((exercise) => exerciseMotions[exercise.id]);

export const WorkoutPlanBuilder = () => {
  const { state } = useLocation();
  const [params, setParams] = useSearchParams();
  const exerciseId = Number(params.get('exercise'));
  const activeExercise = movementOptions.find((exercise) => exercise.id === exerciseId);

  // Currently clicked / selected body part
  const [selectedMuscle, setSelectedMuscle] = useState(null);
  const [lastClickedDetails, setLastClickedDetails] = useState(null);
  const [hoveredMuscle, setHoveredMuscle] = useState(null);

  // Clickable body part event handler
  const handlePartClick = (bodyPart, details = null) => {
    if (!details && selectedMuscle === bodyPart) {
      // Toggle off if already selected
      setSelectedMuscle(null);
      setLastClickedDetails(null);
    } else {
      setSelectedMuscle(bodyPart);
      setLastClickedDetails(details);
    }
  };

  const handleReset = () => {
    setSelectedMuscle(null);
    setLastClickedDetails(null);
  };

  return (
    <DashboardLayout>
      <div className="dashboard-stack">
        <WorkspaceHeading
          label="Training tools"
          title="3D muscle explorer"
          description="Drag the model to rotate it, or tap a muscle for a closer look."
          action={selectedMuscle && (
            <button type="button" className="action action-outline" onClick={handleReset}>
              <RotateCcw size={16} /> Clear selection
            </button>
          )}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Exercise preview
            <select
              className="panel-select"
              value={activeExercise?.id ?? ''}
              onChange={(event) => {
                const exercise = event.target.value;
                handleReset();
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  if (exercise) next.set('exercise', exercise);
                  else next.delete('exercise');
                  return next;
                }, { replace: true, state });
              }}
            >
              <option value="">Anatomy only</option>
              {movementOptions.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
              ))}
            </select>
          </label>
          {activeExercise && <p className="workspace-description mt-0">Play or scrub through an illustrated rep.</p>}
        </div>
        {/* Separate Clickable Buttons for Abs, Obliques, and Other Parts */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Dedicated Abs Button */}
          <button
            type="button"
            onClick={() => handlePartClick('Abs')}
            aria-pressed={selectedMuscle === 'Abs' || selectedMuscle === 'Box'}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-sm ${
              selectedMuscle === 'Abs' || selectedMuscle === 'Box'
                ? 'bg-red-500 text-white shadow-red-500/30 ring-2 ring-red-400 scale-[1.04]'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-red-400 hover:text-red-500'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                selectedMuscle === 'Abs' || selectedMuscle === 'Box' ? 'bg-white' : 'bg-red-500'
              }`}
            />
            <span>Abs (6-Pack)</span>
          </button>

          {/* Dedicated Obliques Button */}
          <button
            type="button"
            onClick={() => handlePartClick('Oblique')}
            aria-pressed={selectedMuscle === 'Oblique'}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-sm ${
              selectedMuscle === 'Oblique'
                ? 'bg-red-500 text-white shadow-red-500/30 ring-2 ring-red-400 scale-[1.04]'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-red-400 hover:text-red-500'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                selectedMuscle === 'Oblique' ? 'bg-white' : 'bg-red-500'
              }`}
            />
            <span>Obliques (Right & Left)</span>
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          {/* Other primary parts */}
          {['Chest', 'Shoulders', 'Biceps', 'Triceps', 'Back', 'Leg'].map((part) => {
            const active = selectedMuscle === part;
            return (
              <button
                key={`btn-part-${part}`}
                type="button"
                onClick={() => handlePartClick(part)}
                aria-pressed={active}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? 'bg-red-500 text-white shadow-sm ring-2 ring-red-400/50'
                    : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-400 hover:text-red-500'
                }`}
              >
                {part}
              </button>
            );
          })}
        </div>

        {/* Ready-made Human Structure Viewport (Full Width, Centered) */}
        <div className="w-full">
          <div className="w-full">
            <GymFit3DAnatomyViewer
              exerciseId={activeExercise?.id}
              selectedMuscles={selectedMuscle ? [selectedMuscle] : []}
              selectedMuscleDetails={lastClickedDetails}
              onToggleMuscle={handlePartClick}
              hoveredMuscle={hoveredMuscle}
              onHoverMuscle={setHoveredMuscle}
            />

            {/* Clicked Part Event Feedback Bar */}
            <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300">
                  Selected muscle
                </span>
                {selectedMuscle ? (
                  <span className="font-bold text-red-600 dark:text-red-400 px-2.5 py-0.5 rounded bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-900">
                    {lastClickedDetails?.displayName ?? (selectedMuscle === 'Abs' || selectedMuscle === 'Box'
                      ? 'Abs (Rectus Abdominis)'
                      : selectedMuscle === 'Oblique' ? 'Obliques' : selectedMuscle)}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Select a muscle on the model or above.</span>
                )}
              </div>

              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Drag to rotate · Two-finger pinch to zoom</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
