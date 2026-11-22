import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeft, ClipboardList, UsersRound } from 'lucide-react';
import { Brand } from './Brand';
import { ThemeToggle } from '../theme/ThemeToggle';

const productHighlights = [
  [ClipboardList, 'Plan workouts and explore exercises'],
  [Activity, 'Track training and personal records'],
  [UsersRound, 'Coordinate coaching and gym operations'],
];

export function AuthLayout({ title, description, children }) {
  return (
    <main className="auth-page">
      <aside className="auth-product" aria-labelledby="auth-product-title">
        <Brand />
        <div className="auth-product-copy">
          <p className="eyebrow hero-label"><span /> The fitness workspace</p>
          <h2 id="auth-product-title">Inside GymFit.</h2>
          <p>One workspace for your training, your clients, and your gym.</p>
          <ul>
            {productHighlights.map(([Icon, label]) => (
              <li key={label}><Icon size={18} aria-hidden="true" /> {label}</li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="site-actions auth-actions">
          <Link className="action action-small action-outline" to="/"><ArrowLeft size={16} aria-hidden="true" /> Home</Link>
          <ThemeToggle />
        </div>
        <div className="auth-panel-content">
          <h1 id="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
