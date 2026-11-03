import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { WorkoutPlanCard } from '../components/member/WorkoutPlanCard';
import { HomeWorkoutPlanCard } from '../components/member/HomeWorkoutPlanCard';
import { DietPlanCard } from '../components/member/DietPlanCard';
import { ArrowLeft, User } from 'lucide-react';

export const MemberDashboard = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <main className="flex-1 py-10 sm:py-14 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        
        {/* Back Navigation to Landing Page */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors group"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Dashboard Header */}
        <div className="mb-10 text-left border-b border-slate-100 dark:border-slate-800/80 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200/60 dark:border-cyan-900/60 text-xs font-semibold text-cyan-700 dark:text-cyan-300 mb-3">
            <User className="w-3.5 h-3.5" />
            <span>Member Dashboard</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Choose Your Training Category
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xl">
            Select a category below to access your structured workout routine, bodyweight home programming, or customized diet plan.
          </p>
        </div>

        {/* The Three Clickable Cards (Workout Plan, Home Workout Plan, Diet Plan) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <WorkoutPlanCard to="/member/workout-plan" />
          <HomeWorkoutPlanCard to="/planner" />
          <DietPlanCard to="/progress" />
        </div>

      </main>

      <Footer />
    </div>
  );
};
