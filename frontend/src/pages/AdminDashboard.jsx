import React, { useState } from 'react';
import { Building2, CircleDollarSign, ShieldCheck, UsersRound } from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { WorkspaceHeading } from '../components/layout/WorkspaceHeading';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { StatsCard } from '../components/common/StatsCard';
import { mockPlatformGyms, mockPlatformActivity } from '../data/mockData';

export const AdminDashboard = () => {
  const [status, setStatus] = useState('');
  const gyms = mockPlatformGyms.filter((gym) => !status || gym.status === status);
  const activeGyms = mockPlatformGyms.filter((gym) => gym.status === 'Active');
  const totalMembers = activeGyms.reduce((total, gym) => total + gym.members, 0);
  const revenue = activeGyms.reduce((total, gym) => total + gym.subscription, 0);

  return (
    <DashboardLayout>
      <div className="dashboard-stack">
        <WorkspaceHeading
          label="Administration"
          title="Platform overview"
          description="Gym organizations, subscriptions, and activity across the platform."
        />
        <div className="dashboard-metrics metrics-three">
          <StatsCard title="Active gyms" value={activeGyms.length} subtitle={`${mockPlatformGyms.length} registered organizations`} icon={Building2} />
          <StatsCard title="Members across active gyms" value={totalMembers.toLocaleString()} subtitle="Across all active organizations" icon={UsersRound} />
          <StatsCard title="Monthly platform revenue" value={`$${revenue.toLocaleString()}`} subtitle="Gym subscriptions" icon={CircleDollarSign} />
        </div>
        <div className="workspace-split workspace-split-wide">
          <Card>
            <CardHeader
              title="Gym organizations"
              subtitle={`${gyms.length} of ${mockPlatformGyms.length} sample gyms`}
              action={
                <select className="panel-select" aria-label="Filter gym organizations" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">All statuses</option>
                  <option>Active</option>
                  <option>Suspended</option>
                </select>
              }
            />
            <div className="table-scroll">
              <table className="dashboard-table">
                <thead><tr><th scope="col">Organization</th><th scope="col">Subscription</th><th scope="col">Members</th><th scope="col">Status</th></tr></thead>
                <tbody>
                  {gyms.map((gym) => (
                    <tr key={gym.slug}>
                      <th scope="row"><strong>{gym.name}</strong><small>{gym.slug}</small></th>
                      <td>{gym.plan}</td><td>{gym.members.toLocaleString()}</td>
                      <td><Badge variant={gym.status === 'Active' ? 'emerald' : 'amber'}>{gym.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <CardHeader title="Platform activity" />
            <CardBody className="detail-list">
              {mockPlatformActivity.map(({ event, gym, when }) => (
                <div className="schedule-item" key={event}>
                  <span className="tool-icon"><ShieldCheck size={18} /></span>
                  <div><strong>{event}</strong><small>{gym} · {when}</small></div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
