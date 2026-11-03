import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { GymFit3DAnatomyViewer } from '../components/anatomy3d/GymFit3DAnatomyViewer';
import {
  ArrowLeft,
  RotateCcw,
  Activity,
  Target,
  Sparkles,
  Layers
} from 'lucide-react';

export const WorkoutPlanBuilder = () => {
  // Currently clicked / selected body part
  const [selectedMuscle, setSelectedMuscle] = useState(null);
  const [lastClickedDetails, setLastClickedDetails] = useState(null);
  const [hoveredMuscle, setHoveredMuscle] = useState(null);

  // Clickable body part event handler
  const handlePartClick = (bodyPart, details = null) => {
    if (selectedMuscle === bodyPart) {
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
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <main className="flex-1 py-6 sm:py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col">
        {/* Navigation Breadcrumb / Header */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            to="/dashboard/member"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors group"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span>Back to Member Dashboard</span>
          </Link>

          {selectedMuscle && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Deselect ({selectedMuscle})</span>
            </button>
          )}
        </div>

        {/* Heading Section */}
        <div className="text-center max-w-2xl mx-auto mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold mb-2">
            <Activity className="w-3.5 h-3.5 text-red-500" />
            <span>Interactive 3D Human Structure</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            3D Human Anatomy Viewer
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Rotate in 360°, zoom in/out, or click any button / 3D muscle to highlight only that part in red.
          </p>
        </div>

        {/* Separate Clickable Buttons for Abs, Obliques, and Other Parts */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mb-6">
          {/* Dedicated Abs Button */}
          <button
            type="button"
            onClick={() => handlePartClick('Abs')}
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
        <div className="w-full flex-1 flex flex-col items-center">
          <div className="w-full max-w-5xl">
            <GymFit3DAnatomyViewer
              selectedMuscles={selectedMuscle ? [selectedMuscle] : []}
              onToggleMuscle={handlePartClick}
              hoveredMuscle={hoveredMuscle}
              onHoverMuscle={setHoveredMuscle}
            />

            {/* Clicked Part Event Feedback Bar */}
            <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300">
                  Clicked Body Part:
                </span>
                {selectedMuscle ? (
                  <span className="font-bold text-red-600 dark:text-red-400 px-2.5 py-0.5 rounded bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-900">
                    {selectedMuscle === 'Abs' || selectedMuscle === 'Box'
                      ? 'Abs (Rectus Abdominis / 6-Pack - Only Abs Selected)'
                      : selectedMuscle === 'Oblique'
                      ? 'Obliques (Right & Left External & Internal Obliques)'
                      : selectedMuscle}
                    {lastClickedDetails?.displayName && selectedMuscle !== 'Box' && selectedMuscle !== 'Abs' && selectedMuscle !== 'Oblique'
                      ? ` (${lastClickedDetails.displayName})`
                      : ''}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">None (click Abs, Obliques, or click any muscle on the 3D body)</span>
                )}
              </div>

              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>360° Free Rotation • Raycaster Event Detection Enabled</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
