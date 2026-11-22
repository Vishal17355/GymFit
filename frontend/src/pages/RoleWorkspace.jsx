import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link, NavLink, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { WorkspaceHeading } from '../components/layout/WorkspaceHeading';
import { adminSections, ownerSections, trainerSections } from '../components/workspace/ManagementWorkspace';
import { JoinGym, memberSections } from '../components/workspace/MemberWorkspace';
import { dateTime, Panel, records, WorkspaceLink } from '../components/workspace/WorkspaceUI';
import { useAuth } from '../context/AuthContext';
import { memberFeatureLinks, roleWorkspaces, workspacePath } from '../data/workspaceNavigation';
import { changeWorkspace, workspaceRequest } from '../utils/workspaceApi';

const sectionsByRole = {
  MEMBER: memberSections, TRAINER: trainerSections, GYM_OWNER: ownerSections, PLATFORM_ADMIN: adminSections,
};

function summary(role, data) {
  switch (role) {
    case 'MEMBER': {
      const next = records(data, 'classes').find((row) => row.status === 'BOOKED' && !row.cancelled && Date.parse(row.starts_at) > Date.now());
      return [
        ['Membership', data.membership?.name || 'Awaiting activation', 'pass'],
        ['Next booking', next ? `${next.title} · ${dateTime(next.starts_at)}` : 'No upcoming booking', 'classes'],
        ['Assigned plans', records(data, 'plans').length, 'workouts'],
      ];
    }
    case 'TRAINER':
      return [
        ['Assigned clients', records(data, 'members').length, 'clients'],
        ['Saved drafts', records(data, 'drafts').length, 'plans'],
        ['Upcoming classes', records(data, 'classes').filter((row) => !row.cancelled && Date.parse(row.starts_at) > Date.now()).length, 'attendance'],
      ];
    case 'GYM_OWNER':
      return [
        ['Members', records(data, 'members').length, 'members'],
        ['Branches', records(data, 'branches').length, 'branches'],
        ['Recent check-ins', records(data, 'checkins').length, 'check-in'],
      ];
    case 'PLATFORM_ADMIN':
      return [
        ['Active gyms', records(data, 'gyms').filter((gym) => gym.active).length, 'gyms'],
        ['Active tiers', records(data, 'tiers').filter((tier) => tier.active).length, 'tiers'],
        ['Unacknowledged events', data.openAlerts, 'audit'],
      ];
  }
}

function WorkspaceOverview({ role, data, sections }) {
  return <>
    <div className="work-summary">
      {summary(role, data).map(([label, value, section]) => (
        <Link key={section} to={workspacePath(role, section)}>
          <span>{label}</span>
          <strong>{value}</strong>
          <ArrowUpRight size={20} aria-hidden="true" />
        </Link>
      ))}
    </div>
    <div className="work-directory">
      {role === 'MEMBER' && memberFeatureLinks.map(([label, path, Icon]) => (
        <WorkspaceLink key={path} to={path}><Icon size={18} aria-hidden="true" />{label}</WorkspaceLink>
      ))}
      {sections.map(([section, label, Icon]) => (
        <WorkspaceLink key={section} to={workspacePath(role, section)}><Icon size={18} aria-hidden="true" />{label}</WorkspaceLink>
      ))}
    </div>
  </>;
}

function InvitationNotice({ result }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  return <Panel title="Invitation ready" description={result.existingAccount
    ? `Share the code with ${result.email}. They can accept it after signing in.`
    : `Share the code with ${result.email}. They can use it at Create account.`}>
    <div className="work-invite">
      <code>{result.invitation}</code>
      <Button variant="outline" onClick={async () => {
        try {
          await navigator.clipboard.writeText(result.invitation);
          setCopied(true);
          setCopyFailed(false);
        } catch {
          setCopyFailed(true);
        }
      }}>{copied ? 'Copied' : 'Copy code'}</Button>
    </div>
    {copyFailed && <p role="status">Select the code to copy it manually.</p>}
    <p className="work-muted">The invitation expires in seven days.</p>
  </Panel>;
}

function WorkspaceContent({ role, section, request, search }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const pending = useRef(false);
  const config = roleWorkspaces[role];
  const Section = sectionsByRole[role][section];

  useEffect(() => {
    const abort = new AbortController();
    workspaceRequest(request, '', { signal: abort.signal })
      .then((result) => { if (!abort.signal.aborted) setData(result); })
      .catch((error) => { if (!abort.signal.aborted) setLoadError(error.message); });
    return () => abort.abort();
  }, [request, retry]);

  async function submit(action, fields) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setFeedback(null);
    let saved = false;
    try {
      const result = await changeWorkspace(request, action, fields);
      saved = true;
      setFeedback({ section, result });
      setData(await workspaceRequest(request));
    } catch (error) {
      if (saved) setLoadError('Your change was saved. Refresh the workspace to see the latest records.');
      else setFeedback({ section, error: error.message });
    } finally {
      pending.current = false;
      setBusy(false);
    }
    return saved;
  }

  const notice = feedback?.section === section ? feedback : null;
  return <>
    {notice?.result?.invitation ? <InvitationNotice key={notice.result.invitation} result={notice.result} /> : notice && (
      <p className={`work-notice${notice.error ? ' work-notice-error' : ''}`} role={notice.error ? 'alert' : 'status'}>
        {notice.error || notice.result.message || 'Saved.'}
      </p>
    )}
    {loadError && <div className="work-notice work-notice-error" role="alert">
      <span>{loadError}</span>
      <Button size="sm" variant="outline" onClick={() => { setLoadError(''); setRetry((value) => value + 1); }}>Refresh</Button>
    </div>}
    {!data ? (!loadError && <p className="work-empty" role="status">Loading workspace…</p>) : <>
      {data.gymStatus === 'SUSPENDED' && <p className="work-notice">This gym’s operations are suspended.</p>}
      {role === 'MEMBER' && data.gymStatus === 'UNLINKED' && section !== 'profile' && (
        <div className="work-notice"><span>Link your account to your gym to book classes and receive plans.</span>
          <WorkspaceLink to={workspacePath(role, 'profile')}>Enter an invitation code</WorkspaceLink>
        </div>
      )}
      {data.gymStatus === 'UNLINKED' && role !== 'MEMBER' ? <JoinGym busy={busy} submit={submit} /> :
        data.gymStatus === 'SUSPENDED' && role !== 'MEMBER' ? null :
          Section ? <Section key={`${section}:${search}`} {...{ data, busy, submit, request, search }} /> :
            <WorkspaceOverview role={role} data={data} sections={config.sections} />}
    </>}
  </>;
}

export function RoleWorkspace({ role }) {
  const { section } = useParams();
  const [search] = useSearchParams();
  const { request } = useAuth();
  const config = roleWorkspaces[role];
  const selected = config.sections.find(([key]) => key === section);
  if (section && !selected) return <Navigate to={workspacePath(role)} replace />;

  return <DashboardLayout>
    <div className="dashboard-stack work-desk">
      <WorkspaceHeading title={selected?.[1] || config.title} description={section ? undefined : config.description} />
      {section && <nav className="work-tabs" aria-label="Workspace sections">
        {config.sections.map(([key, label, Icon]) => (
          <NavLink key={key} to={workspacePath(role, key)} end>
            <Icon size={16} aria-hidden="true" />{label}
          </NavLink>
        ))}
      </nav>}
      <WorkspaceContent {...{ role, section, request, search }} />
    </div>
  </DashboardLayout>;
}
