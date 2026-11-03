import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from '../theme/ThemeToggle';
import { useAuth } from '../../context/AuthMockContext';
import { Dumbbell, LayoutDashboard, ChevronRight } from 'lucide-react';

export const Navbar = () => {
  const auth = useAuth();
  const location = useLocation();

  const isPublicPage = ['/', '/login', '/register'].includes(location.pathname);

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        
        {/* Brand & Context */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center font-bold text-sm shadow-sm group-hover:bg-cyan-500 dark:group-hover:bg-cyan-400 group-hover:text-white transition-colors">
              <Dumbbell className="w-4 h-4 -rotate-45" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
              Gym<span className="text-cyan-500">Fit</span>
            </span>
          </Link>

          {/* In-app workspace breadcrumb (replaces redundant links on dashboard pages) */}
          {!isPublicPage && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 pl-3 border-l border-slate-200 dark:border-slate-800">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {auth.currentUser?.gymName || 'Apex Fitness'}
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="text-slate-500">
                {auth.currentUser?.branch || 'Downtown Flagship'}
              </span>
            </div>
          )}
        </div>

        {/* Public Marketing Links (Only on public landing/login/register pages) */}
        {isPublicPage && (
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Link to="/" className="hover:text-cyan-500 transition-colors">Platform</Link>
            <Link to="/exercises" className="hover:text-cyan-500 transition-colors">Exercise Library</Link>
            <Link to="/planner" className="hover:text-cyan-500 transition-colors">Workout Planner</Link>
            <Link to="/progress" className="hover:text-cyan-500 transition-colors">Biometrics</Link>
          </nav>
        )}

        {/* Right Section: Persona Switcher, Theme & Portal Access */}
        <div className="flex items-center gap-2.5">
          
          {/* Persona Switcher Pill (Clean, minimal evaluator toolbar) */}
          <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-xs font-medium">
            <button
              onClick={() => auth.switchRole('MEMBER')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                auth.currentRole === 'MEMBER'
                  ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Member
            </button>
            <button
              onClick={() => auth.switchRole('TRAINER')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                auth.currentRole === 'TRAINER'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Trainer
            </button>
            <button
              onClick={() => auth.switchRole('GYM_OWNER')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                auth.currentRole === 'GYM_OWNER'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Owner
            </button>
          </div>

          <ThemeToggle />

          {/* Action Button */}
          {auth.isAuthenticated ? (
            <Link
              to={
                auth.currentRole === 'GYM_OWNER'
                  ? '/dashboard/owner'
                  : auth.currentRole === 'TRAINER'
                  ? '/dashboard/trainer'
                  : '/dashboard/member'
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 transition-colors shadow-sm"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Workspace</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-950 transition-colors shadow-sm"
            >
              Sign In
            </Link>
          )}

        </div>
      </div>
    </header>
  );
};
