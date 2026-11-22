import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { exerciseMotions } from '../data/exerciseMotions';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { WorkspaceHeading } from '../components/layout/WorkspaceHeading';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { mockExercises } from '../data/mockData';
import {
  Search,
  Info,
  Play,
  X,
  Layers,
  Sparkles
} from 'lucide-react';

export const ExerciseLibrary = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('ALL');
  const [activeModalExercise, setActiveModalExercise] = useState(null);

  const muscleGroups = ['ALL', 'Chest', 'Legs', 'Back', 'Shoulders'];

  const filteredExercises = mockExercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ex.muscleGroup.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMuscle = selectedMuscle === 'ALL' || ex.muscleGroup.toLowerCase().includes(selectedMuscle.toLowerCase());
    return matchesSearch && matchesMuscle;
  });

  return (
    <DashboardLayout>
      <div className="dashboard-stack">
        <WorkspaceHeading
          label="Training tools"
          title="Exercise library"
          description="Find movements by muscle group and review form and coaching cues."
          action={
            <label className="compact-search exercise-search">
              <Search size={17} />
              <input aria-label="Search exercises" placeholder="Search exercises" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            </label>
          }
        />

        {/* Muscle Filter Tabs */}
        <div className="flex items-center flex-wrap gap-2 text-sm">
          {muscleGroups.map((group) => (
            <button
              key={group}
              aria-pressed={selectedMuscle === group}
              onClick={() => setSelectedMuscle(group)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedMuscle === group
                  ? 'bg-[color:var(--role-color)] text-slate-950'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {group}
            </button>
          ))}
        </div>

        {/* Exercises Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExercises.map((ex) => (
            <Card key={ex.id} hover className="flex flex-col justify-between">
              <CardBody className="p-4">
                
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge variant={ex.difficulty === 'Beginner' ? 'emerald' : ex.difficulty === 'Intermediate' ? 'cyan' : 'purple'} size="sm">
                    {ex.difficulty}
                  </Badge>
                  <span className="text-[10px] font-mono text-slate-400">
                    {ex.equipment}
                  </span>
                </div>

                <h3 className="font-display text-2xl font-bold leading-none">
                  {ex.name}
                </h3>
                
                <p className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 mt-0.5">
                  {ex.muscleGroup}
                </p>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {ex.instructions}
                </p>

                <div className="mt-3 flex flex-wrap gap-1">
                  {ex.secondaryMuscles.map((m) => (
                    <span key={m} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">
                      {m}
                    </span>
                  ))}
                </div>

              </CardBody>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800/80">
                {exerciseMotions[ex.id] && (
                  <Link
                    className="action action-small action-outline"
                    to={`/anatomy?exercise=${ex.id}`}
                  >
                    <Play size={15} aria-hidden="true" /> Watch in 3D
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  icon={Info}
                  onClick={() => setActiveModalExercise(ex)}
                >
                  Form &amp; Coaching Cues
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {!filteredExercises.length && <p role="status" className="workspace-description">No exercises match your filters.</p>}

        {/* Modal for detailed cues */}
        {activeModalExercise && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl relative">
              
              <button
                onClick={() => setActiveModalExercise(null)}
                aria-label="Close exercise details"
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-2 mb-1.5">
                <Badge variant="cyan" size="sm">{activeModalExercise.difficulty}</Badge>
                <span className="text-xs text-slate-400">{activeModalExercise.equipment}</span>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {activeModalExercise.name}
              </h3>
              <p className="text-xs font-semibold text-cyan-500 mt-0.5">
                Target: {activeModalExercise.muscleGroup}
              </p>

              <div className="mt-4 space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <h5 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px] mb-1">
                    Movement Execution
                  </h5>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {activeModalExercise.instructions}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                  <h5 className="font-bold text-[10px] uppercase tracking-wider mb-1 text-emerald-500">
                    Coaching Cues
                  </h5>
                  <p className="leading-relaxed">
                    {activeModalExercise.tips}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button size="sm" onClick={() => setActiveModalExercise(null)}>
                  Close
                </Button>
              </div>

            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
