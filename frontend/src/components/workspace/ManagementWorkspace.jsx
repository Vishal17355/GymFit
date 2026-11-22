import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../common/Button';
import { workspaceRequest } from '../../utils/workspaceApi';
import { workspacePath } from '../../data/workspaceNavigation';
import { LogTable, Payments, Plan, ProgressTrend } from './MemberWorkspace';
import { active, dateTime, Field, Form, Grid, money, options, Panel, PaymentFields, records, status, Table, TermsFields, WorkspaceLink } from './WorkspaceUI';

const memberOptions = (data) => options(records(data, 'members'), 'email');
const trainerOptions = (data) => options(records(data, 'staff').filter((item) => item.role === 'TRAINER'), 'email');
const branchOptions = (data) => options(records(data, 'branches'));
const activeTiers = (data) => options(records(data, 'tiers').filter((item) => item.active));

function InviteFields({ role, data }) {
  return <>
    <Field name="email" label={role === 'MEMBER' ? 'Member email' : 'Trainer email'} type="email" maxLength={254} />
    <Field name="branchId" label="Branch" values={branchOptions(data)} optional />
  </>;
}

function OwnerMembers({ data, busy, submit }) {
  const membershipOperation = useRef(null);
  const tiers = records(data, 'tiers').filter((tier) => tier.active);
  const [tierId, setTierId] = useState('');
  const selectedTier = tiers.find((tier) => String(tier.id) === tierId);
  async function saveMembership(action, fields) {
    const fieldsKey = JSON.stringify(fields);
    if (membershipOperation.current?.fieldsKey !== fieldsKey) {
      membershipOperation.current = { id: crypto.randomUUID(), fieldsKey };
    }
    const saved = await submit(action, { ...fields, operationId: membershipOperation.current.id });
    if (saved) {
      membershipOperation.current = null;
      setTierId('');
    }
    return saved;
  }
  return <Grid>
    <Panel title="Members" full>
      <Table rows={records(data, 'members')} empty="No members yet. Invite a member to get started." columns={[
        ['Member', 'name'], ['Email', 'email'], ['Branch', 'branch'], ['Trainer', 'trainer'],
        ['Membership', 'membership'], ['Valid through (UTC)', 'valid_until'],
      ]} />
    </Panel>
    <Panel title="Invite a member" description="Share the invitation code so the member can join your gym.">
      <Form action="invite" label="Create member invitation" busy={busy} submit={submit} transform={(fields) => ({ ...fields, role: 'MEMBER' })}>
        <InviteFields role="MEMBER" data={data} />
      </Form>
    </Panel>
    <Panel title="Activate or renew membership" description="Record the receipt or transaction reference for paid tiers. Renewals extend the current term.">
      <Form action="membership" label="Save membership" busy={busy} submit={saveMembership} disabled={!memberOptions(data).length || !tiers.length}>
        <Field name="memberId" label="Member" values={memberOptions(data)} />
        <Field name="tierId" label="Membership tier" values={tiers.map((tier) => [
          tier.id, `${tier.name} · ${money(tier.price, tier.currency)} · ${tier.term_days} days`,
        ])} onChange={(event) => setTierId(event.target.value)} />
        {selectedTier && Number(selectedTier.price) > 0 && <PaymentFields />}
      </Form>
      <WorkspaceLink to={workspacePath('GYM_OWNER', 'pricing')}>Manage membership pricing</WorkspaceLink>
    </Panel>
    <Panel title="Assign a trainer" description="The assigned trainer can view this member’s training history and send plans.">
      <Form action="client-trainer" label="Save trainer assignment" busy={busy} submit={submit} disabled={!memberOptions(data).length}>
        <Field name="memberId" label="Member" values={memberOptions(data)} />
        <Field name="trainerId" label="Trainer" values={trainerOptions(data)} optional />
      </Form>
    </Panel>
  </Grid>;
}

function OwnerStaff({ data, busy, submit }) {
  return <Grid>
    <Panel title="Staff directory" full>
      <Table rows={records(data, 'staff')} empty="No staff yet." columns={[
        ['Email', 'email'], ['Role', (row) => status(row.role)], ['Branch', 'branch'],
      ]} />
    </Panel>
    <Panel title="Invite a trainer">
      <Form action="invite" label="Create staff invitation" busy={busy} submit={submit} transform={(fields) => ({ ...fields, role: 'TRAINER' })}>
        <InviteFields role="TRAINER" data={data} />
      </Form>
    </Panel>
    <Panel title="Move trainer to a branch">
      <Form action="staff-branch" label="Save branch assignment" busy={busy} submit={submit} disabled={!trainerOptions(data).length || !branchOptions(data).length}>
        <Field name="trainerId" label="Trainer" values={trainerOptions(data)} />
        <Field name="branchId" label="Branch" values={branchOptions(data)} />
      </Form>
    </Panel>
  </Grid>;
}

function OwnerBranches({ data, busy, submit }) {
  const [selected, setSelected] = useState('');
  const branches = records(data, 'branches');
  const branch = branches.find((item) => String(item.id) === selected);
  return <Grid>
    <Panel title="Gym locations">
      <Table rows={branches} empty="Add your first branch to schedule classes and accept check-ins." columns={[
        ['Branch', 'name'], ['Address', 'address'],
      ]} actions={(row) => <Button size="sm" variant="outline" onClick={() => setSelected(String(row.id))}>Edit</Button>} />
    </Panel>
    <Panel title={branch ? `Edit ${branch.name}` : 'Add a branch'}>
      <Form key={selected} action="branch" label="Save branch" busy={busy} submit={submit}
        transform={(fields) => ({ ...fields, branchId: selected })}
        keepValues={Boolean(branch)}>
        <Field name="name" label="Branch name" defaultValue={branch?.name} maxLength={120} />
        <Field name="address" label="Street address" defaultValue={branch?.address} maxLength={250} />
      </Form>
      {branch && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected('')}>Add another branch</Button>}
    </Panel>
  </Grid>;
}

const soon = (row) => !row.cancelled && new Date(row.starts_at).getTime() > Date.now();
const scheduleColumns = [
  ['Class', 'title'], ['Branch', 'branch'], ['Starts', (row) => dateTime(row.starts_at)],
  ['Booked', (row) => `${row.booked} / ${row.capacity}`], ['Waitlisted', 'waiting'],
];

function OwnerSchedule({ data, busy, submit }) {
  return <Grid>
    <Panel title="Class schedule" full>
      <Table rows={records(data, 'classes')} empty="No classes scheduled yet." columns={[
        ...scheduleColumns, ['Trainer', 'trainer'], ['Status', (row) => row.cancelled ? 'Cancelled' : soon(row) ? 'Upcoming' : 'Started'],
      ]} actions={(row) => soon(row) && (
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => window.confirm(`Cancel ${row.title} on ${dateTime(row.starts_at)}?`) && submit('class-cancel', { classId: row.id })}>
          Cancel class
        </Button>
      )} />
    </Panel>
    <Panel title="Schedule a class" description="Choose a date and time in your current time zone.">
      <Form action="class" label="Schedule class" busy={busy} submit={submit} disabled={!trainerOptions(data).length || !branchOptions(data).length}
        transform={(fields) => ({ ...fields, startsAt: new Date(fields.startsAt).toISOString() })}>
        <Field name="title" label="Class title" maxLength={120} />
        <Field name="branchId" label="Branch" values={branchOptions(data)} />
        <Field name="trainerId" label="Trainer" values={trainerOptions(data)} />
        <Field name="startsAt" label="Starts" type="datetime-local" />
        <Field name="capacity" label="Capacity" type="number" min="1" max="1000" />
      </Form>
    </Panel>
  </Grid>;
}

function OwnerPayments({ data, busy, submit }) {
  return <Grid>
    <Panel title="Record a payment" description="Use this ledger for payments you’ve already collected.">
      <Form action="payment" label="Record payment" busy={busy} submit={submit} disabled={!memberOptions(data).length}>
        <Field name="memberId" label="Member" values={memberOptions(data)} />
        <Field name="amount" label="Amount paid" type="number" step="0.01" min="0.01" max="9999999999.99" />
        <Field name="currency" label="Currency code" placeholder="INR" maxLength={3} pattern="[A-Za-z]{3}" />
        <PaymentFields />
      </Form>
    </Panel>
    <Payments data={data} owner />
  </Grid>;
}

function FrontDesk({ data, busy, submit }) {
  return <Grid>
    <Panel title="Check in a member" description="Enter the member’s pass code or scan their QR code with a keyboard-input scanner.">
      <Form action="check-in" label="Check in" busy={busy} submit={submit} disabled={!branchOptions(data).length}>
        <Field name="branchId" label="Branch" values={branchOptions(data)} />
        <Field name="passCode" label="Pass code" minLength={36} maxLength={36} autoComplete="off" spellCheck={false} />
      </Form>
    </Panel>
    <Panel title="Recent check-ins">
      <Table rows={records(data, 'checkins')} empty="No check-ins recorded yet." columns={[
        ['Member', 'email'], ['Branch', 'branch'], ['Checked in', (row) => dateTime(row.checked_in_at)],
      ]} />
    </Panel>
  </Grid>;
}

function Pricing({ data, busy, submit, platform = false }) {
  const action = platform ? 'platform-tier' : 'membership-tier';
  const tierName = platform ? 'subscription' : 'membership';
  return <Grid>
    <Panel title={platform ? 'Subscription tiers' : 'Membership pricing'}>
      <Table rows={records(data, 'tiers')} empty={`No ${tierName} tiers yet.`} columns={[
        ['Tier', 'name'], [platform ? 'Monthly price' : 'Term price', (row) => money(row.price, row.currency)],
        ...(!platform ? [['Days', 'term_days']] : []),
        ['Status', (row) => active(row.active)],
      ]} actions={(row) => <Button size="sm" variant="outline" disabled={busy}
        onClick={() => submit(`${action}-status`, { tierId: row.id, active: !row.active })}>
        {row.active ? 'Disable' : 'Enable'}
      </Button>} />
    </Panel>
    <Panel title={`Set ${tierName} pricing`} description="Use an existing tier name to update its price. Existing receipts retain the amount originally paid.">
      <Form action={action} label="Save tier" busy={busy} submit={submit}><TermsFields platform={platform} /></Form>
    </Panel>
  </Grid>;
}

function TrainerClients({ data, request }) {
  const [memberId, setMemberId] = useState('');
  const [clientState, setClientState] = useState(null);
  const members = records(data, 'members');
  const client = members.find((member) => String(member.id) === memberId);
  useEffect(() => {
    if (!client) return;
    const abort = new AbortController();
    workspaceRequest(request, `/client?memberId=${memberId}`, { signal: abort.signal })
      .then((result) => { if (!abort.signal.aborted) setClientState({ memberId, result }); })
      .catch((error) => { if (!abort.signal.aborted) setClientState({ memberId, error: error.message }); });
    return () => abort.abort();
  }, [request, memberId, client?.id]);

  const state = clientState?.memberId === memberId ? clientState : null;
  const log = records(state?.result ?? {}, 'log');
  return <Grid>
    <Panel title="Your clients" description="Select a client to review their individual progress." full>
      <Table rows={members} empty="Your gym owner can assign members to your roster." columns={[
        ['Member', 'name'], ['Email', 'email'], ['Branch', 'branch'], ['Membership', 'membership'],
      ]} actions={(row) => <Button size="sm" variant="outline" aria-pressed={String(row.id) === memberId}
        onClick={() => { if (memberId !== String(row.id)) { setClientState(null); setMemberId(String(row.id)); } }}>View progress</Button>} />
    </Panel>
    {client && <>
      <Panel title={client.name} description={client.email} full>
        {!state ? <p role="status">Loading progress…</p> : state.error ? <p role="alert">{state.error}</p> :
          <ProgressTrend log={log} />}
        <WorkspaceLink to={`${workspacePath('TRAINER', 'plans')}?member=${memberId}`}>Assign a plan to this client</WorkspaceLink>
      </Panel>
      {state?.result && <>
        <Panel title="Measurements"><LogTable log={log} kind="MEASUREMENT" empty="No measurements recorded." /></Panel>
        <Panel title="Workout sets"><LogTable log={log} kind="SET" empty="No sets logged." /></Panel>
        <Panel title="Home sessions"><LogTable log={log} kind="HOME" empty="No home workouts logged." /></Panel>
        <Panel title="Meals"><LogTable log={log} kind="MEAL" empty="No meals logged." /></Panel>
        {records(state.result, 'plans').map((plan) => <Panel key={plan.id} title={plan.kind === 'DIET' ? 'Current diet plan' : 'Current workout plan'}>
          <Plan plan={plan} />
        </Panel>)}
      </>}
    </>}
  </Grid>;
}

function TrainerPlans({ data, busy, submit, search }) {
  const [kind, setKind] = useState('WORKOUT');
  const selectedMember = search.get('member') || '';
  const draft = search.get('draft') || '';
  const drafts = records(data, 'drafts');
  const selectedDraft = drafts.find((entry) => entry.id === draft);
  return <Grid>
    <Panel title="Assign a plan" description="Saving an assignment replaces this client’s current plan of the same type.">
      <Form action="assign-plan" label="Assign plan" keepValues busy={busy} submit={submit} disabled={!memberOptions(data).length}>
        <Field name="memberId" label="Client" values={memberOptions(data)} defaultValue={selectedMember} />
        <Field name="kind" label="Plan type" values={ [['WORKOUT', 'Workout'], ['DIET', 'Diet']] } defaultValue={kind}
          onChange={(event) => setKind(event.target.value)} />
        <Field name="title" label="Plan title" defaultValue={selectedDraft?.name} maxLength={120} />
        {kind === 'WORKOUT' && <Field name="draftKey" label="Attach a saved workout draft" values={options(drafts)} defaultValue={selectedDraft?.id} optional />}
        <Field name="details" label={kind === 'DIET' ? 'Meal schedule, portions and instructions' : 'Workout instructions'}
          type="textarea" maxLength={15000} optional={kind === 'WORKOUT'} />
        {kind === 'DIET' && <div className="work-grid">
          <Field name="calories" label="Calories per day (kcal)" type="number" min="1" max="10000" step="0.01" optional />
          <Field name="protein" label="Protein per day (g)" type="number" min="0" max="2000" step="0.01" optional />
          <Field name="carbs" label="Carbs per day (g)" type="number" min="0" max="2000" step="0.01" optional />
          <Field name="fat" label="Fat per day (g)" type="number" min="0" max="2000" step="0.01" optional />
        </div>}
      </Form>
      <WorkspaceLink to="/planner">Build a workout in the planner</WorkspaceLink>
    </Panel>
  </Grid>;
}

function TrainerAttendance({ data, busy, submit }) {
  const [selected, setSelected] = useState('');
  const classes = records(data, 'classes');
  const roster = records(data, 'roster').filter((row) => !selected || String(row.class_id) === selected);
  return <Grid>
    <Panel title="Your classes" full>
      <Table rows={classes} columns={scheduleColumns} empty="Your gym hasn’t scheduled any classes for you." />
    </Panel>
    <Panel title="Attendance" description="Once a class starts, mark booked members as attended or absent." full>
      <Field name="class" label="Filter by class" optional values={classes.map((row) => [row.id, `${row.title} · ${dateTime(row.starts_at)}`])}
        onChange={(event) => setSelected(event.target.value)} />
      <Table rows={roster} columns={[
        ['Member', 'member'], ['Class', 'title'], ['Starts', (row) => dateTime(row.starts_at)],
        ['Status', (row) => row.cancelled ? 'Cancelled' : status(row.status)],
      ]} empty="No reservations for these classes." actions={(row) =>
        !row.cancelled && !soon(row) && row.status !== 'WAITLISTED' && <>
          <Button size="sm" variant="outline" disabled={busy || row.status === 'ATTENDED'}
            onClick={() => submit('attendance', { reservationId: row.id, status: 'ATTENDED' })}>Attended</Button>
          <Button size="sm" variant="outline" disabled={busy || row.status === 'ABSENT'}
            onClick={() => submit('attendance', { reservationId: row.id, status: 'ABSENT' })}>Absent</Button>
        </>} />
    </Panel>
  </Grid>;
}

function PlatformGyms({ data, busy, submit }) {
  const gyms = records(data, 'gyms');
  const tiers = activeTiers(data);
  return <Grid>
    <Panel title="Gym directory" full>
      <Table rows={gyms} empty="No gyms onboarded yet." columns={[
        ['Gym', 'name'], ['Subscription', 'tier'], ['Status', (row) => row.active ? 'Active' : 'Suspended'],
      ]} actions={(row) => <Button variant="outline" size="sm" disabled={busy} onClick={() => {
        if (!row.active || window.confirm(`Suspend gym operations for ${row.name}?`)) {
          submit('gym-status', { gymId: row.id, active: !row.active });
        }
      }}>{row.active ? 'Suspend' : 'Reactivate'}</Button>} />
    </Panel>
    <Panel title="Onboard a gym" description="Create the gym and generate an invitation for its owner.">
      <Form action="gym-create" label="Onboard gym" busy={busy} submit={submit} disabled={!tiers.length}>
        <Field name="name" label="Gym name" maxLength={120} />
        <Field name="email" label="Gym owner email" type="email" maxLength={254} />
        <Field name="tierId" label="Subscription tier" values={tiers} />
      </Form>
      {!tiers.length && <WorkspaceLink to={workspacePath('PLATFORM_ADMIN', 'tiers')}>Create a subscription tier</WorkspaceLink>}
    </Panel>
    <Panel title="Invite a gym owner" description="Generate a new code for an existing gym if an earlier invitation expired.">
      <Form action="gym-owner-invite" label="Create owner invitation" busy={busy} submit={submit} disabled={!gyms.some((gym) => gym.active)}>
        <Field name="gymId" label="Gym" values={options(gyms.filter((gym) => gym.active))} />
        <Field name="email" label="Gym owner email" type="email" maxLength={254} />
      </Form>
    </Panel>
    <Panel title="Change gym subscription">
      <Form action="gym-tier" label="Update subscription" busy={busy} submit={submit} disabled={!gyms.length || !tiers.length}>
        <Field name="gymId" label="Gym" values={options(gyms)} />
        <Field name="tierId" label="Subscription tier" values={tiers} />
      </Form>
    </Panel>
  </Grid>;
}

function PlatformAudit({ data, busy, submit }) {
  const [unread, setUnread] = useState(true);
  const events = records(data, 'audit').filter((row) => !unread || !row.acknowledged_at);
  return <Panel title="Audit alerts">
    <label className="work-toggle"><input type="checkbox" checked={unread} onChange={(event) => setUnread(event.target.checked)} /> Unacknowledged only</label>
    <Table rows={events} empty={unread ? 'No unacknowledged events.' : 'No audit events yet.'} columns={[
      ['Event', 'event'], ['Subject', 'subject'], ['Gym', 'gym'], ['Actor', 'actor'],
      ['Recorded', (row) => dateTime(row.recorded_at)], ['Acknowledged by', 'acknowledged_by'],
    ]} actions={(row) => !row.acknowledged_at && <Button size="sm" variant="outline" disabled={busy}
      onClick={() => submit('audit-acknowledge', { eventId: row.id })}>Acknowledge</Button>} />
  </Panel>;
}

export const trainerSections = { clients: TrainerClients, plans: TrainerPlans, attendance: TrainerAttendance };
export const ownerSections = {
  members: OwnerMembers, staff: OwnerStaff, branches: OwnerBranches, pricing: Pricing,
  schedule: OwnerSchedule, payments: OwnerPayments, 'check-in': FrontDesk,
};
export const adminSections = {
  gyms: PlatformGyms, tiers: (props) => <Pricing {...props} platform />, audit: PlatformAudit,
};
