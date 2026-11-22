import React, { useState } from 'react';
import { IdCard, Timer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../common/Button';
import { homeWorkouts } from '../../data/homeWorkouts';
import { storedDetails } from '../../utils/workspaceApi';
import { dateTime, Field, Form, Grid, money, Panel, records, status, Table, WorkspaceLink } from './WorkspaceUI';

function MemberPass({ data }) {
  const pass = data.membership;
  const [copied, setCopied] = useState(false);
  return <Grid>
    <div className="work-pass">
      <IdCard size={34} aria-hidden="true" />
      <p>{data.gym || 'GymFit'}</p>
      <h2>Gym pass</h2>
      {pass?.pass_code ? <>
        <p>{pass.name} · Valid through {pass.valid_until} (UTC)</p>
        <div className="work-pass-qr">
          <QRCodeSVG value={pass.pass_code} size={148} marginSize={2} title="Gym pass QR code" />
        </div>
        <code>{pass.pass_code}</code>
        <Button variant="secondary" onClick={async () => {
          try { await navigator.clipboard.writeText(pass.pass_code); setCopied(true); }
          catch { setCopied(false); }
        }}>{copied ? 'Copied' : 'Copy pass code'}</Button>
        <p>Show the QR code or pass code at the front desk.</p>
      </> : <p>{pass?.valid_until ? `Your membership expired on ${pass.valid_until}.` : 'Your pass appears when your gym activates your membership.'}</p>}
    </div>
    <Panel title="Check-in history">
      <Table rows={records(data, 'checkins')} columns={[['Branch', 'branch'], ['Checked in', (row) => dateTime(row.checked_in_at)]]} empty="No check-ins recorded yet." />
    </Panel>
  </Grid>;
}

function MemberClasses({ data, busy, submit }) {
  return <Panel title="Class timetable" description="Book a spot with an active membership. If the class is full, you’ll join its waitlist.">
    <Table rows={records(data, 'classes')} empty="There are no classes on your timetable." columns={[
      ['Class', 'title'], ['Branch', 'branch'], ['Starts', (row) => dateTime(row.starts_at)],
      ['Spots taken', (row) => `${row.booked} / ${row.capacity}`],
      ['Your booking', (row) => row.cancelled ? 'Cancelled' : status(row.status)],
    ]} actions={(row) => !row.cancelled && new Date(row.starts_at).getTime() > Date.now() && (
      <Button size="sm" variant={row.status ? 'outline' : 'primary'} disabled={busy || (!row.status && !data.membership?.pass_code)}
        onClick={() => submit(row.status ? 'release' : 'book', { classId: row.id })}>
        {row.status === 'WAITLISTED' ? 'Leave waitlist' : row.status ? 'Cancel booking' : row.booked >= row.capacity ? 'Join waitlist' : 'Book class'}
      </Button>
    )} />
  </Panel>;
}

export function Plan({ plan }) {
  if (!plan) return <p className="work-empty">Your trainer hasn’t assigned a plan here yet.</p>;
  const workout = storedDetails(plan.workout);
  const nutrition = storedDetails(plan.nutrition);
  const targets = [['Calories', 'calories', 'kcal'], ['Protein', 'protein', 'g'], ['Carbs', 'carbs', 'g'], ['Fat', 'fat', 'g']]
    .filter(([, field]) => nutrition?.[field] != null);
  return <div className="work-plan">
    <h3>{plan.title}</h3>
    <p className="work-muted">Assigned {dateTime(plan.assigned_at)}</p>
    {targets.length > 0 && <dl className="work-nutrition" aria-label="Daily targets">
      {targets.map(([label, field, unit]) => <div key={field}><dt>{label}</dt><dd>{nutrition[field]} {unit}</dd></div>)}
    </dl>}
    {plan.details && <p className="work-plan-instructions">{plan.details}</p>}
    {workout && <>
      <p className="work-muted">{workout.goal} · {workout.durationWeeks} weeks</p>
      <Table rows={workout.routineExercises} empty="This plan has no prescribed movements." columns={[
        ['Movement', 'name'], ['Sets', 'sets'], ['Reps', 'reps'], ['Load', 'load'], ['Rest', 'rest'], ['RPE', 'rpe'],
      ]} />
    </>}
  </div>;
}

export function LogTable({ log, kind, empty }) {
  const detail = (row) => storedDetails(row.details) ?? {};
  const detailColumns = {
    SET: [['Reps', (row) => detail(row).reps], ['Load', (row) => `${detail(row).loadKg} kg`]],
    MEASUREMENT: [['Weight', (row) => `${detail(row).weightKg} kg`], ['Body fat', (row) => detail(row).bodyFatPct == null ? '—' : `${detail(row).bodyFatPct}%`]],
    MEAL: [['Notes', (row) => detail(row).notes || '—']],
    HOME: [['Duration', (row) => `${detail(row).minutes} min`]],
  };
  return <Table rows={log.filter((row) => row.kind === kind)} empty={empty} columns={[
    ...(kind === 'MEASUREMENT' ? [] : [['Entry', 'label']]),
    ...detailColumns[kind], ['Recorded', (row) => dateTime(row.recorded_at)],
  ]} />;
}

function WorkoutLog({ data, busy, submit }) {
  const plan = records(data, 'plans').find((entry) => entry.kind === 'WORKOUT');
  const movements = [...new Set(storedDetails(plan?.workout)?.routineExercises.map((exercise) => exercise.name) ?? [])];
  return <Grid>
    <Panel title="Assigned workout"><Plan plan={plan} /><WorkspaceLink to="/member/workout-plan">Explore movements in 3D</WorkspaceLink></Panel>
    <Panel title="Log a set">
      <Form action="set" label="Save set" busy={busy} submit={submit}>
        <Field name="label" label="Exercise" maxLength={120} list={movements.length ? 'assigned-workout-movements' : undefined} />
        {movements.length > 0 && <datalist id="assigned-workout-movements">
          {movements.map((name) => <option key={name} value={name} />)}
        </datalist>}
        <Field name="reps" label="Reps completed" type="number" min="1" max="999" />
        <Field name="loadKg" label="Load in kg" type="number" min="0" max="2000" step="0.01" defaultValue="0" />
      </Form>
    </Panel>
    <Panel title="Set history" full><LogTable log={records(data, 'log')} kind="SET" empty="No sets logged yet." /></Panel>
  </Grid>;
}

function HomeWorkouts({ data, busy, submit }) {
  return <>
    <WorkspaceLink to="/member/home-workout">Build a personalized home workout</WorkspaceLink>
    <div className="work-home">
      {homeWorkouts.map((workout) => (
        <article key={workout.id} className="work-panel">
          <p className="work-session-label"><Timer size={17} aria-hidden="true" />{workout.duration} min · {workout.level}</p>
          <h2>{workout.name}</h2>
          <p className="work-muted">{workout.description}</p>
          <ol>{workout.movements.map((movement) => <li key={movement}>{movement}</li>)}</ol>
          <Form action="home" label="Log completion" busy={busy} submit={submit} transform={(fields) => ({ ...fields, label: workout.name })}>
            <Field name="minutes" label="Minutes completed" type="number" min="1" max="300" defaultValue={workout.duration} />
          </Form>
        </article>
      ))}
    </div>
    <Panel title="Home workout history"><LogTable log={records(data, 'log')} kind="HOME" empty="No home workouts completed yet." /></Panel>
  </>;
}

function MemberDiet({ data, busy, submit }) {
  return <Grid>
    <Panel title="Assigned diet plan">
      <Plan plan={records(data, 'plans').find((entry) => entry.kind === 'DIET')} />
      <WorkspaceLink to="/member/diet-plan">Open the personal diet planner</WorkspaceLink>
      <WorkspaceLink to="/member/nutrition-diary">Open the nutrition diary</WorkspaceLink>
    </Panel>
    <Panel title="Log a meal">
      <Form action="meal" label="Save meal" busy={busy} submit={submit}>
        <Field name="label" label="Meal name" maxLength={120} />
        <Field name="notes" label="Portions or notes" type="textarea" optional maxLength={1000} />
      </Form>
    </Panel>
    <Panel title="Meal history" full><LogTable log={records(data, 'log')} kind="MEAL" empty="No meals logged yet." /></Panel>
  </Grid>;
}

export function ProgressTrend({ log }) {
  const entries = log.filter((row) => row.kind === 'MEASUREMENT').slice(0, 8).reverse();
  const weights = entries.map((row) => Number(storedDetails(row.details).weightKg));
  if (!weights.length) return <p className="work-empty">Weight trend appears after your first measurement.</p>;
  const min = Math.min(...weights);
  const spread = Math.max(...weights) - min;
  return <figure className="work-trend">
    <figcaption>Recent weight in kg</figcaption>
    <div className="work-trend-bars">
      {entries.map((row, index) => (
        <div key={row.id} title={dateTime(row.recorded_at)}>
          <span>{weights[index].toFixed(1)}</span>
          <div style={{ height: `${30 + (spread ? ((weights[index] - min) / spread) * 80 : 0)}px` }} />
        </div>
      ))}
    </div>
  </figure>;
}

function MemberProgress({ data, busy, submit }) {
  const log = records(data, 'log');
  return <Grid>
    <Panel title="Weight trend"><ProgressTrend log={log} /></Panel>
    <Panel title="Log a measurement">
      <Form action="measurement" label="Save measurement" busy={busy} submit={submit}>
        <Field name="weightKg" label="Weight in kg" type="number" min="1" max="1000" step="0.01" />
        <Field name="bodyFatPct" label="Body fat percentage" type="number" min="0" max="100" step="0.01" optional />
      </Form>
    </Panel>
    <Panel title="Measurement history" full><LogTable log={log} kind="MEASUREMENT" empty="No measurements logged yet." /></Panel>
  </Grid>;
}

export function JoinGym({ busy, submit }) {
  return <Panel title="Join a gym" description="Have an account already? Enter the invitation code your gym shared with you.">
    <Form action="accept-invitation" label="Accept invitation" busy={busy} submit={submit}>
      <Field name="code" label="Invitation code" minLength={64} maxLength={64} autoComplete="off" spellCheck={false} />
    </Form>
  </Panel>;
}

function MemberProfile({ data, busy, submit }) {
  const profile = data.profile ?? {};
  return <Grid>
    <Panel title="Your profile" description={data.email}>
      <Form action="profile" label="Save profile" busy={busy} submit={submit} keepValues>
        <Field name="displayName" label="Display name" defaultValue={profile.display_name} maxLength={120} />
        <Field name="phone" label="Phone" type="tel" optional defaultValue={profile.phone} maxLength={40} />
        <Field name="goal" label="Training goal" optional defaultValue={profile.goal} maxLength={250} />
      </Form>
    </Panel>
    {data.gymStatus === 'UNLINKED' && <JoinGym busy={busy} submit={submit} />}
  </Grid>;
}

export function Payments({ data, owner = false }) {
  return <Panel title={owner ? 'Payment ledger' : 'Billing history'} full>
    <Table rows={records(data, 'payments')} empty="No payments recorded yet." columns={[
      ...(owner ? [['Member', 'email']] : []), ['Amount', (row) => money(row.amount, row.currency)],
      ['Method', (row) => status(row.method)], ['Reference', 'reference'], ['Paid', (row) => dateTime(row.paid_at)],
    ]} />
  </Panel>;
}

export const memberSections = {
  pass: MemberPass, classes: MemberClasses, workouts: WorkoutLog, home: HomeWorkouts,
  diet: MemberDiet, progress: MemberProgress, profile: MemberProfile, billing: Payments,
};
