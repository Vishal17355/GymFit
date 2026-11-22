import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkspaceRole } from '../context/WorkspaceContext';
import { workspacePath } from '../data/workspaceNavigation';
import { loadWorkoutDraft, saveWorkoutDraft } from '../utils/workoutDrafts';
import { WorkspaceHeading } from '../components/layout/WorkspaceHeading';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { mockExercises, mockWorkouts } from '../data/mockData';
import {
  Plus,
  Trash2,
  Save,
  Search
} from 'lucide-react';

const defaultExercises = mockWorkouts[0].exercises;

function toPlannerExercise(exercise, index) {
  const movement = mockExercises.find(({ id }) => id === exercise.exerciseId);
  return {
    id: `re-${index}`,
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    muscle: movement?.muscleGroup.split(' ')[0] || 'General',
    sets: exercise.sets,
    reps: exercise.targetReps,
    load: exercise.targetLoad,
    rest: exercise.rest,
    rpe: exercise.targetRPE,
  };
}

export const WorkoutPlanner = () => {
  const { user, request } = useAuth();
  const workspace = useWorkspaceRole();
  const [params] = useSearchParams();
  const blueprint = mockWorkouts.find(({ id }) => id === params.get('split'));
  const storageKey = `gymfit_draft_${workspace}_${blueprint?.id || 'new'}`;
  const canAssign = workspace === 'TRAINER';

  return <PlannerDraft key={`${user.id}:${storageKey}`} {...{ request, blueprint, storageKey, canAssign }} />;
};

function PlannerDraft({ request, blueprint, storageKey, canAssign }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(blueprint?.title ?? 'Push Hypertrophy Block');
  const [goal, setGoal] = useState(blueprint?.goal ?? 'Chest & Shoulder Volume Overload');
  const [durationWeeks, setDurationWeeks] = useState(6);
  const [targetType, setTargetType] = useState('TEMPLATE');
  const [selectedClientId, setSelectedClientId] = useState(0);
  const [saveStatus, setSaveStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const editVersion = useRef(0);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('ALL');
  const [routineExercises, setRoutineExercises] = useState(
    () => (blueprint?.exercises ?? defaultExercises).map(toPlannerExercise)
  );

  useEffect(() => {
    const controller = new AbortController();
    loadWorkoutDraft(request, storageKey, controller.signal).then((storedDraft) => {
      if (controller.signal.aborted) return;
      if (storedDraft) {
        setTitle(storedDraft.title);
        setGoal(storedDraft.goal);
        setDurationWeeks(storedDraft.durationWeeks);
        setTargetType(storedDraft.targetType);
        setSelectedClientId(storedDraft.selectedClientId);
        setRoutineExercises(storedDraft.routineExercises);
      }
      setLoaded(true);
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError(true);
    });
    return () => controller.abort();
  }, [request, storageKey, loadAttempt]);

  const markEdited = () => {
    editVersion.current += 1;
    setSaveStatus('');
  };

  const updateExerciseField = (id, field, value) => {
    setRoutineExercises(prev =>
      prev.map(item => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const addExercise = (ex) => {
    const newEntry = {
      id: crypto.randomUUID?.() ?? `re-added-${Date.now()}`,
      exerciseId: ex.id,
      name: ex.name,
      muscle: ex.muscleGroup.split(' ')[0],
      sets: 3,
      reps: '10',
      load: '40 kg',
      rest: '60s',
      rpe: '8'
    };
    setRoutineExercises(prev => [...prev, newEntry]);
    markEdited();
  };

  const removeExercise = (id) => {
    setRoutineExercises(prev => prev.filter(item => item.id !== id));
    markEdited();
  };

  const handleSave = async (assign = false) => {
    if (assign && (!title.trim() || !routineExercises.length)) {
      setSaveStatus('Add a routine name and at least one exercise to assign this draft.');
      return;
    }
    const snapshot = { title, goal, durationWeeks, targetType: assign ? 'CLIENT' : targetType, selectedClientId, routineExercises };
    const version = ++editVersion.current;
    setSaving(true);
    setSaveStatus('');

    let message;
    try {
      await saveWorkoutDraft(request, storageKey, snapshot);
      message = 'Draft saved.';
      if (assign && editVersion.current === version) {
        const search = new URLSearchParams({ draft: storageKey });
        if (selectedClientId > 0) search.set('member', selectedClientId);
        navigate(`${workspacePath('TRAINER', 'plans')}?${search}`);
      }
    } catch {
      message = 'Could not save this draft. Try again.';
    } finally {
      setSaving(false);
    }
    if (editVersion.current === version) setSaveStatus(message);
  };

  if (!loaded) {
    return (
      <DashboardLayout>
        <div className="dashboard-stack">
          <WorkspaceHeading title="Workout planner" />
          {loadError ? (
            <div>
              <p role="alert" className="mb-3">Could not load your workout draft.</p>
              <Button onClick={() => { setLoadError(false); setLoadAttempt((attempt) => attempt + 1); }}>Try again</Button>
            </div>
          ) : <p role="status">Loading your draft…</p>}
        </div>
      </DashboardLayout>
    );
  }

  const filteredCatalog = mockExercises.filter(ex => {
    const matchSearch = ex.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                        ex.muscleGroup.toLowerCase().includes(catalogSearch.toLowerCase());
    const matchMuscle = selectedMuscle === 'ALL' || ex.muscleGroup.toLowerCase().includes(selectedMuscle.toLowerCase());
    return matchSearch && matchMuscle;
  });

  const muscleFilters = ['ALL', 'Chest', 'Back', 'Legs', 'Shoulders'];

  return (
    <DashboardLayout>
      <div className="dashboard-stack" onChange={markEdited}>
        <WorkspaceHeading
          label={canAssign ? 'Programming' : 'Training tools'}
          title="Workout planner"
          description={canAssign ? 'Build a workout split or edit a template.' : 'Build a routine from the exercise library.'}
          action={
            <div className="flex flex-wrap items-center gap-3">
              {saveStatus && <span role="status" className="max-w-52 text-xs font-medium text-[color:var(--muted)]">{saveStatus}</span>}
              {canAssign && <Button variant="outline" disabled={saving} onClick={() => handleSave(true)}>Save and assign</Button>}
              <Button icon={Save} loading={saving} onClick={() => handleSave()}>Save draft</Button>
            </div>
          }
        />

        {/* Configuration Bar */}
        <Card className="p-4 bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
            <label className="md:col-span-4 grid gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Routine name
              <input
                type="text"
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </label>
            
            {/* Target Goal */}
            <div className="md:col-span-2 space-y-1">
              <label htmlFor="routine-goal" className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Primary Goal
              </label>
              <input
                type="text"
                id="routine-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Strength & Muscular Volume"
                className="w-full text-xs font-semibold px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Duration */}
            <div className="space-y-1">
              <label htmlFor="routine-duration" className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Duration (Weeks)
              </label>
              <input
                type="number"
                id="routine-duration"
                min="1"
                max="52"
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(Number(e.target.value))}
                className="w-full text-xs font-semibold px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

          </div>
        </Card>

        {/* Main Work Area: Sequence & Quick Add */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left: Sequence List */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Prescribed Sequence</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">({routineExercises.length})</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {routineExercises.map((item, idx) => (
                <div
                  key={item.id}
                  className="group p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  {/* Left: Index & Exercise Meta */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.name}
                        </h4>
                        <Badge variant="cyan" size="sm" className="shrink-0">{item.muscle}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Rest: {item.rest} &bull; RPE: {item.rpe}
                      </p>
                    </div>
                  </div>

                  {/* Right: Quick Prescription Fields */}
                  <div className="flex items-center gap-1 self-start sm:self-center">
                    
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono">
                      <div className="flex items-center gap-1 px-1.5">
                        <span className="text-slate-400">Sets:</span>
                        <input
                          type="text"
                          aria-label={`Sets for ${item.name}`}
                          value={item.sets}
                          onChange={(e) => updateExerciseField(item.id, 'sets', e.target.value)}
                          className="w-7 text-center font-bold bg-transparent text-slate-900 dark:text-white focus:outline-none"
                        />
                      </div>
                      <span className="text-slate-300 dark:text-slate-700">&times;</span>
                      <div className="flex items-center gap-1 px-1.5">
                        <span className="text-slate-400">Reps:</span>
                        <input
                          type="text"
                          aria-label={`Reps for ${item.name}`}
                          value={item.reps}
                          onChange={(e) => updateExerciseField(item.id, 'reps', e.target.value)}
                          className="w-11 text-center font-bold bg-transparent text-slate-900 dark:text-white focus:outline-none"
                        />
                      </div>
                      <span className="text-slate-300 dark:text-slate-700">@</span>
                      <div className="flex items-center gap-1 px-1.5">
                        <input
                          type="text"
                          aria-label={`Load for ${item.name}`}
                          value={item.load}
                          onChange={(e) => updateExerciseField(item.id, 'load', e.target.value)}
                          className="w-14 text-right font-bold text-cyan-600 dark:text-cyan-400 bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeExercise(item.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {routineExercises.length === 0 && (
                <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-400 text-xs">
                  No exercises added. Choose an exercise from the library.
                </div>
              )}
            </div>
          </div>

          {/* Right: Quick Catalog Picker */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Movement</h3>
              <span className="text-xs text-slate-400">Library</span>
            </div>

            <Card className="p-3.5 bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800">
              
              {/* Search & Pills */}
              <div className="space-y-2 mb-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    aria-label="Search workout exercises"
                    placeholder="Search exercises"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                  {muscleFilters.map(m => (
                    <button
                      key={m}
                      onClick={() => setSelectedMuscle(m)}
                      className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                        selectedMuscle === m
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable List */}
              <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                {filteredCatalog.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => addExercise(ex)}
                    className="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 hover:bg-cyan-500/10 hover:border-cyan-500/30 border border-transparent dark:border-slate-800/60 text-xs flex items-center justify-between transition-all group"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block group-hover:text-cyan-500 transition-colors">
                        {ex.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {ex.muscleGroup.split(' ')[0]} &bull; {ex.equipment}
                      </span>
                    </div>
                    <span className="p-1 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-500 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>

            </Card>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
};
