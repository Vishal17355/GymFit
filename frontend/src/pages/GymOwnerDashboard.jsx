import React, { useState } from 'react';
import { Activity, Building2, CircleDollarSign, TrendingUp, UsersRound } from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { WorkspaceHeading } from '../components/layout/WorkspaceHeading';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { StatsCard } from '../components/common/StatsCard';
import { Badge } from '../components/common/Badge';
import { mockOwnerStats as stats } from '../data/mockData';

export const GymOwnerDashboard = () => {
  const [location, setLocation] = useState('');
  const checkIns = stats.recentCheckIns.filter((entry) => !location || location.startsWith(entry.branch));
  const occupancy = Math.round(stats.liveOccupancy / stats.liveCapacityMax * 100);

  return (
    <DashboardLayout>
      <div className="dashboard-stack">
        <WorkspaceHeading
          label="Gym operations"
          title={stats.gymName}
          description={`Membership and check-in activity across ${stats.branches.length} locations.`}
        />
        <div className="dashboard-metrics">
          <StatsCard title="Monthly revenue" value={stats.monthlyRecurringRevenue} change={stats.mrrChange} subtitle="Recurring subscription revenue" icon={CircleDollarSign} />
          <StatsCard title="Active members" value={stats.activeMembers.toLocaleString()} change={stats.activeMembersChange} subtitle="Across all locations" icon={UsersRound} />
          <StatsCard title="Facility headcount" value={stats.liveOccupancy} subtitle={`Total capacity: ${stats.liveCapacityMax}`} icon={Activity} />
          <StatsCard title="Member retention" value={stats.memberRetentionRate} change={stats.retentionChange} subtitle="Monthly average" icon={TrendingUp} />
        </div>

        <div className="workspace-split workspace-split-wide">
          <Card>
            <CardHeader title="Branch breakdown" subtitle="Membership and monthly revenue" />
            <CardBody className="detail-list">
              {stats.branches.map((branch) => (
                <div className="detail-row tool-row" key={branch.name}>
                  <span className="tool-icon"><Building2 size={18} /></span>
                  <div>
                    <strong>{branch.name}</strong>
                    <small>{branch.activeCount} members · {branch.currentLive} checked in</small>
                  </div>
                  <strong>{branch.mrr}</strong>
                </div>
              ))}
            </CardBody>
          </Card>
          <section className="occupancy-panel" aria-labelledby="occupancy-title">
            <h2 className="eyebrow" id="occupancy-title">Capacity in use</h2>
            <strong>{occupancy}%</strong>
            <progress aria-label="Facility occupancy" value={stats.liveOccupancy} max={stats.liveCapacityMax} />
            <p>{stats.liveOccupancy} of {stats.liveCapacityMax} spaces occupied</p>
          </section>
        </div>

        <Card>
          <CardHeader
            title="Recent check-ins"
            action={
              <select className="panel-select" aria-label="Filter check-ins by location" value={location} onChange={(event) => setLocation(event.target.value)}>
                <option value="">All locations</option>
                {stats.branches.map((branch) => <option key={branch.name}>{branch.name}</option>)}
              </select>
            }
          />
          <div className="table-scroll">
            <table className="dashboard-table">
              <thead><tr><th scope="col">Member</th><th scope="col">Plan</th><th scope="col">Location</th><th scope="col">When</th><th scope="col">Access</th></tr></thead>
              <tbody>
                {checkIns.map((entry) => (
                  <tr key={entry.name}>
                    <th scope="row">{entry.name}</th><td>{entry.plan}</td><td>{entry.branch}</td><td>{entry.time}</td>
                    <td><Badge variant={entry.status === 'ALLOWED' ? 'emerald' : 'rose'}>{entry.status === 'ALLOWED' ? 'Allowed' : 'Expired'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};
