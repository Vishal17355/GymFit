import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { DietOnboardingWizard } from '../components/diet/DietOnboardingWizard';
import { DietDashboard } from '../components/diet/DietDashboard';
import { NutritionSummary } from '../components/diet/NutritionSummary';
import { DietProgress } from '../components/diet/DietProgress';
import { DietPlanProgressReport } from '../components/diet/DietPlanProgressReport';
import { dietApi } from '../services/dietApi';
import { readLegacyDiet, toApiProfile, toFormProfile, localDateString } from '../utils/dietProfileAdapter';

const describeError = (error) => `${error.message}${Object.keys(error.fields || {}).length ? ` ${Object.entries(error.fields).map(([key, message]) => `${key}: ${message}`).join('; ')}` : ''}`;
export const DietPlannerPage = () => {
  const [context, setContext] = useState(null);
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [nutrition, setNutrition] = useState(null);
  const [foods, setFoods] = useState([]);
  const [history, setHistory] = useState([]);
  const [imports, setImports] = useState([]);
  const [legacy] = useState(readLegacyDiet);
  const [stage, setStage] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [startDate, setStartDate] = useState(localDateString());

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    setLoading(true); setError('');
    (async () => {
      try {
        const identity = await dietApi.context(signal);
        const [savedProfile, savedPlans, catalog, progress, archives] = await Promise.all([
          dietApi.profile(signal).catch((failure) => { if (failure.status === 404) return null; throw failure; }),
          dietApi.plans(signal), dietApi.catalog(signal), dietApi.progress(signal), dietApi.imports(signal)
        ]);
        if (signal.aborted) return;
        setContext(identity); setProfile(savedProfile); setPlans(savedPlans); setPlan(savedPlans[0] || null);
        setFoods(catalog.foods); setHistory(progress); setImports(archives); setStage(savedPlans.length ? 'plan' : 'profile');
      } catch (failure) { if (!signal.aborted) setError(describeError(failure)); }
      finally { if (!signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [reload]);

  const perform = async (operation) => {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); } catch (failure) { setError(describeError(failure)); } finally { setBusy(false); }
  };
  const saveProfile = (form) => perform(async () => {
    const saved = await dietApi.saveProfile(toApiProfile(form), Boolean(profile)); setProfile(saved);
    setNutrition(await dietApi.calculate(saved)); setStage('summary');
  });
  const generate = (days) => perform(async () => {
    const result = await dietApi.generate(startDate, days); setPlan(result); setStage('plan'); setPlans(await dietApi.plans());
  });
  const review = () => perform(async () => {
    if (!profile) { setStage('profile'); return; }
    setNutrition(await dietApi.calculate(profile)); setStage('summary');
  });
  const updatePlan = (updated) => { setPlan(updated); setPlans((previous) => previous.map((item) => item.id === updated.id ? updated : item)); };
  const importLegacy = () => perform(async () => {
    const importProfile = profile || (legacy?.profile && toApiProfile(legacy.profile, true));
    if (!importProfile) throw new Error('Complete your profile first; the old browser data will stay untouched.');
    await dietApi.importLegacy(importProfile, legacy.raw);
    setProfile(await dietApi.profile()); setImports(await dietApi.imports());
    setNotice('The backend confirmed the archive. Original browser data has been retained. Old meal totals are archived as unverified; review the profile and generate a new validated plan.');
    if (!plan) setStage('profile');
  });
  const downloadArchive = (id) => perform(async () => {
    const data = await dietApi.archive(id);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `gymfit-legacy-diet-${id}.json`; anchor.click(); URL.revokeObjectURL(url);
  });

  return <div className="space-y-4">
      <Link to="/dashboard/member/diet" className="work-link">View trainer-assigned diet</Link>
      {error && <div role="alert" className="p-4 rounded-xl border border-red-300 dark:border-red-900 text-red-600 dark:text-red-300 text-sm">{error}<button onClick={() => setReload((value) => value + 1)} disabled={busy} className="inline-flex ml-3 gap-1 underline text-xs"><RefreshCw className="w-3 h-3" />Reload saved data</button></div>}
      {notice && <p role="status" className="text-xs p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {loading ? <p role="status" className="py-10 text-center text-sm">Loading your saved diet data…</p> : context && <>
        {legacy && <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-xs space-y-2">
          <p>Older diet data was found in this browser. Import creates an idempotent backend archive and never deletes the original data.</p>
          <button disabled={busy} onClick={importLegacy} className="font-bold text-amber-600 dark:text-amber-400">{busy ? 'Working…' : imports.length ? 'Confirm browser-data archive' : 'Import old browser diet data'}</button>
          {imports.map((item) => <button key={item.id} disabled={busy} onClick={() => downloadArchive(item.id)} className="ml-3 underline">Download archive {item.id}</button>)}
        </section>}
        {plans.length > 0 && <div className="flex flex-wrap items-center gap-3 text-xs"><label className="font-bold">Saved plans <select aria-label="Saved plans" value={plan?.id || ''} disabled={busy} onChange={(event) => { setPlan(plans.find((item) => String(item.id) === event.target.value)); setStage('plan'); }} className="ml-2 rounded-xl p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">{plans.map((item) => <option key={item.id} value={item.id}>{item.days[0]?.date} • {item.days.length} day(s) • {item.targets.calories} kcal • #{item.id}</option>)}</select></label>{stage !== 'plan' && <button onClick={() => setStage('plan')} className="text-amber-600 dark:text-amber-400 font-bold">Return to plan</button>}</div>}
        {stage === 'profile' && <DietOnboardingWizard key={JSON.stringify(profile)} initialData={toFormProfile(profile) || legacy?.profile} onComplete={saveProfile} foods={foods} busy={busy} />}
        {stage === 'summary' && nutrition && <NutritionSummary nutrition={nutrition} busy={busy} onGenerate={generate} onEdit={() => setStage('profile')} startDate={startDate} setStartDate={setStartDate} />}
        {stage === 'plan' && plan && <>
          <DietDashboard key={plan.id} dietPlan={plan} profile={toFormProfile(profile)} foods={foods} reportingDate={context.reportingDate || localDateString()} onUpdateDietPlan={updatePlan} onEditProfile={() => setStage('profile')} onGenerateNew={review} />
          <DietPlanProgressReport planId={plan.id} planVersion={plan.version} weightHistory={history} />
        </>}
        {profile && <DietProgress history={history} onHistoryChange={setHistory} />}
      </>}
  </div>;
};
export default DietPlannerPage;
