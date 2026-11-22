import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowDown, ArrowUpRight, Building2, ClipboardList, Dumbbell, LayoutDashboard, ScanLine, UsersRound,
} from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { roles } from '../data/roles';

const features = [
  { icon: ClipboardList, title: 'Workout planner', description: 'Build a routine and set the reps, load, and rest for each movement.', tone: 'member' },
  { icon: Dumbbell, title: 'Exercise library', description: 'Browse movements by muscle group and review form and coaching cues.', tone: 'trainer' },
  { icon: ScanLine, title: '3D muscle explorer', description: 'Rotate an anatomy model and highlight the muscles you want to examine.', tone: 'admin' },
  { icon: Activity, title: 'Progress tracking', description: 'Log measurements and review your lifting records alongside changes over time.', tone: 'member' },
  { icon: UsersRound, title: 'Coaching workspace', description: 'Review a client roster, check a class schedule, and work from saved split blueprints.', tone: 'trainer' },
  { icon: Building2, title: 'Gym operations', description: 'Review branch occupancy, membership trends, revenue, and recent check-ins.', tone: 'owner' },
];

const previews = {
  MEMBER: {
    title: 'Training overview',
    highlight: ['Assigned workout', 'Upper body strength', '4 movements · 55 min'],
    rows: [['Training streak', '8 days'], ['Workouts logged', '24 sessions']],
  },
  TRAINER: {
    title: 'Coaching overview',
    highlight: ['Workout split', 'Push / pull / legs', 'Strength programming template'],
    rows: [['Client roster', '12 clients'], ['Class schedule', '3 upcoming']],
  },
  GYM_OWNER: {
    title: 'Gym operations',
    highlight: ['Facility occupancy', '46 checked in', 'Across 3 locations'],
    rows: [['Active members', '540'], ['Member retention', '92%']],
  },
  PLATFORM_ADMIN: {
    title: 'Platform overview',
    highlight: ['Organization directory', 'Gym workspaces', 'Review plans and organization status'],
    rows: [['Active organizations', '9 gyms'], ['Subscriptions', '3 plan tiers']],
  },
};

function WorkspacePreview() {
  const [selectedRole, setSelectedRole] = useState('MEMBER');
  const role = roles[selectedRole];
  const { title, highlight, rows } = previews[selectedRole];
  const Icon = role.icon;

  return (
    <section className="product-preview" id="workspace-preview" data-tone={role.tone} aria-labelledby="workspace-preview-title">
      <div className="preview-content">
        <h2 id="workspace-preview-title">Inside a GymFit workspace.</h2>
        <p>Choose a role to see an example of what its dashboard brings together.</p>
        <fieldset className="preview-switch">
          <legend className="sr-only">Workspace to preview</legend>
          {Object.entries(roles).map(([id, option]) => (
            <label key={id}>
              <input
                className="sr-only"
                type="radio"
                name="workspace-preview"
                value={id}
                checked={selectedRole === id}
                onChange={() => setSelectedRole(id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="preview-window" aria-live="polite">
        <div className="preview-window-header">
          <span><LayoutDashboard size={16} aria-hidden="true" /> {role.label}</span>
          <small>Sample workspace</small>
        </div>
        <div className="preview-window-body">
          <h3>{title}</h3>
          <div className="preview-highlight">
            <div>
              <p>{highlight[0]}</p>
              <strong>{highlight[1]}</strong>
              <small>{highlight[2]}</small>
            </div>
            <Icon className="preview-highlight-icon" size={42} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <dl className="preview-stats">
            {rows.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

export const LandingPage = () => (
  <div className="site">
    <Navbar />
    <main className="site-wrap">
      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="hero-photo" />
        <div className="hero-content">
          <p className="eyebrow hero-label"><span /> The fitness workspace</p>
          <h1 id="hero-title">Train with<br /><em>purpose.</em></h1>
          <p className="hero-description">
            Plan your next workout, coach your clients, or run your gym. GymFit brings the work on and off the training floor together.
          </p>
          <div className="hero-actions">
            <a href="#features" className="action action-lime">
              Explore GymFit <ArrowDown size={18} aria-hidden="true" />
            </a>
            <Link to="/login" className="hero-text-link">
              Sign in <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="feature-section" id="features" aria-labelledby="features-title">
        <div className="section-intro">
          <h2 id="features-title">From the first rep to the front desk.</h2>
          <p>Plan sessions, follow progress, and see how your gym is doing.</p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, description, tone }) => (
            <article className="feature-card" data-tone={tone} key={title}>
              <span className="role-icon"><Icon size={21} aria-hidden="true" /></span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <WorkspacePreview />

      <section className="role-section" id="workspaces" aria-labelledby="workspaces-title">
        <div className="section-intro">
          <h2 id="workspaces-title">Find your workspace.</h2>
          <p>Each role has a dashboard for its day-to-day work.</p>
        </div>
        <div className="role-grid">
          {Object.entries(roles).map(([id, { label, tone, icon: Icon, summary }]) => (
            <article className="role-card" data-tone={tone} key={id}>
              <span className="role-icon"><Icon size={21} aria-hidden="true" /></span>
              <h3>{label}</h3>
              <p>{summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="product-access" aria-labelledby="product-access-title">
        <div>
          <h2 id="product-access-title">Open your GymFit workspace.</h2>
          <p>Sign in with an existing account or use your invitation to get started.</p>
        </div>
        <div className="product-access-links">
          <Link className="action action-ink" to="/login">Sign in <ArrowUpRight size={17} aria-hidden="true" /></Link>
          <Link className="action action-outline" to="/register">Use invitation</Link>
        </div>
      </section>
    </main>
    <Footer />
  </div>
);
