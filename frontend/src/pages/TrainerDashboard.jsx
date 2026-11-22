import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Plus, Search, TrendingUp, UsersRound } from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { WorkspaceHeading } from '../components/layout/WorkspaceHeading';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { StatsCard } from '../components/common/StatsCard';
import { mockClasses, mockTrainerClients, mockWorkouts } from '../data/mockData';

export const TrainerDashboard = () => {
  const [query, setQuery] = useState('');
  const clients = mockTrainerClients.filter((client) => client.name.toLowerCase().includes(query.trim().toLowerCase()));
  const schedule = mockClasses;
  const adherence = Math.round(mockTrainerClients.reduce((sum, client) => sum + parseInt(client.adherence, 10), 0) / mockTrainerClients.length);

  return (
    <DashboardLayout>
      <div className="dashboard-stack">
        <WorkspaceHeading
          label="Coaching overview"
          title="Trainer overview"
          description="Review clients, coaching plans, and upcoming classes."
          action={<Link className="action action-ink" to="/planner"><Plus size={17} /> New workout split</Link>}
        />
        <div className="dashboard-metrics metrics-three">
          <StatsCard title="Active clients" value={mockTrainerClients.length} subtitle="Assigned athletes" icon={UsersRound} />
          <StatsCard title="Sample roster adherence" value={`${adherence}%`} subtitle="Average across listed clients" icon={TrendingUp} />
          <StatsCard title="Upcoming classes" value={schedule.length} subtitle="On the sample schedule" icon={CalendarDays} />
        </div>

        <div className="workspace-split workspace-split-wide">
          <Card>
            <CardHeader
              title="Client roster"
              subtitle={`${clients.length} of ${mockTrainerClients.length} sample clients`}
              action={
                <label className="compact-search">
                  <Search size={16} />
                  <input aria-label="Search clients" placeholder="Search clients" value={query} onChange={(event) => setQuery(event.target.value)} />
                </label>
              }
            />
            <div className="table-scroll">
              <table className="dashboard-table">
                <thead><tr><th scope="col">Client</th><th scope="col">Assigned plan</th><th scope="col">Adherence</th></tr></thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <th scope="row"><strong>{client.name}</strong><small>{client.goal}</small></th>
                      <td>{client.plan}<small>{client.lastActive}</small></td>
                      <td>
                        <div className="table-meter">
                          <strong>{client.adherence}</strong>
                          <progress value={parseInt(client.adherence, 10)} max="100" aria-label={`${client.name} adherence`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!clients.length && <tr><td colSpan={3}>No clients match your search.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="dashboard-stack compact">
            <Card>
              <CardHeader title="Class schedule" />
              <CardBody className="detail-list">
                {schedule.map((session) => (
                  <div className="schedule-item" key={session.id}>
                    <span className="tool-icon"><CalendarDays size={18} /></span>
                    <div>
                      <strong>{session.name}</strong>
                      <small>{session.time}</small>
                      <small>{session.room} · {session.capacity - session.spotsLeft} booked</small>
                    </div>
                  </div>
                ))}
                {!schedule.length && <p className="workspace-description">No upcoming classes.</p>}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Saved split blueprints" />
              <CardBody className="detail-list">
                {mockWorkouts.map((workout) => (
                  <Link className="detail-row" to={`/planner?split=${workout.id}`} key={workout.id}>
                    <span><strong>{workout.title}</strong><small>{workout.exercises.length} movements · {workout.estimatedMinutes} min</small></span>
                    <ArrowUpRight size={16} />
                  </Link>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
