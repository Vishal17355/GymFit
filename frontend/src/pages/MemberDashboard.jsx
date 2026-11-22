import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, Clock3, Dumbbell, Flame, ScanLine, Trophy } from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { WorkspaceHeading } from '../components/layout/WorkspaceHeading';
import { Card, CardHeader, CardBody } from '../components/common/Card';
import { StatsCard } from '../components/common/StatsCard';
import { DietPlanCard } from '../components/member/DietPlanCard';
import { mockWorkouts, sampleMemberTraining } from '../data/mockData';

const memberTools = [
  ['Workout planner', 'Build a routine', '/planner', Dumbbell],
  ['Exercise library', 'Find a movement', '/exercises', Activity],
  ['3D anatomy', 'Explore muscle groups', '/member/workout-plan', ScanLine],
];

export const MemberDashboard = () => {
  const [nextWorkout] = mockWorkouts;
  const workoutName = nextWorkout.title.split(': ').at(-1);

  return (
    <DashboardLayout>
      <div className="dashboard-stack">
        <WorkspaceHeading
          label="Training overview"
          title="Member overview"
          description="Assigned workouts and personal records."
          action={<Link className="action action-ink" to="/progress">View progress <ArrowUpRight size={17} /></Link>}
        />

        <div className="member-overview">
          <section className="workout-spotlight" aria-labelledby="up-next">
            <p className="eyebrow"><Dumbbell size={16} /> Assigned workout</p>
            <h2 id="up-next">{workoutName}</h2>
            <p>{nextWorkout.goal}</p>
            <div className="spotlight-footer">
              <a href="#assigned-routine" className="action action-lime">View routine <ArrowUpRight size={17} /></a>
              <span><Clock3 size={15} /> {nextWorkout.estimatedMinutes} min</span>
            </div>
          </section>
          <div className="member-metrics">
            <StatsCard title="Current streak" value={sampleMemberTraining.currentStreak} subtitle="Days" icon={Flame} />
            <StatsCard title="Workouts logged" value={sampleMemberTraining.totalWorkouts} subtitle="All time" icon={Activity} />
            <StatsCard title="Bench press PR" value={sampleMemberTraining.personalBest1RM.benchPress} subtitle="One-rep max" icon={Trophy} />
          </div>
        </div>

        <div className="workspace-split">
          <section id="assigned-routine" aria-label="Assigned routine">
            <Card>
              <CardHeader title="Assigned routine" subtitle={`Programmed by ${nextWorkout.assignedBy}`} />
              <CardBody className="detail-list">
                {nextWorkout.exercises.map((exercise) => (
                  <div className="detail-row" key={exercise.exerciseId}>
                    <div>
                      <strong>{exercise.name}</strong>
                      <small>{exercise.sets} sets × {exercise.targetReps} reps · {exercise.rest} rest</small>
                    </div>
                    <strong>{exercise.targetLoad}</strong>
                  </div>
                ))}
              </CardBody>
            </Card>
          </section>
          <div className="dashboard-stack compact">
            <Card>
              <CardHeader title="Training tools" />
              <CardBody className="detail-list">
                {memberTools.map(([title, subtitle, path, Icon]) => (
                  <Link className="detail-row tool-row" to={path} key={path}>
                    <span className="tool-icon"><Icon size={18} /></span>
                    <span><strong>{title}</strong><small>{subtitle}</small></span>
                    <ArrowUpRight size={17} />
                  </Link>
                ))}
              </CardBody>
            </Card>
            <DietPlanCard />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
