import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthMockProvider } from './context/AuthMockContext';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { MemberDashboard } from './pages/MemberDashboard';
import { TrainerDashboard } from './pages/TrainerDashboard';
import { GymOwnerDashboard } from './pages/GymOwnerDashboard';
import { ExerciseLibrary } from './pages/ExerciseLibrary';
import { WorkoutPlanner } from './pages/WorkoutPlanner';
import { WorkoutPlanBuilder } from './pages/WorkoutPlanBuilder';
import { ProgressTracking } from './pages/ProgressTracking';

export function App() {
  return (
    <ThemeProvider>
      <AuthMockProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Role Dashboards */}
            <Route path="/dashboard/member" element={<MemberDashboard />} />
            <Route path="/dashboard/trainer" element={<TrainerDashboard />} />
            <Route path="/dashboard/owner" element={<GymOwnerDashboard />} />

            {/* Core Fitness & Operational Features */}
            <Route path="/member/workout-plan" element={<WorkoutPlanBuilder />} />
            <Route path="/exercises" element={<ExerciseLibrary />} />
            <Route path="/planner" element={<WorkoutPlanBuilder />} />
            <Route path="/progress" element={<ProgressTracking />} />

            {/* 404 Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthMockProvider>
    </ThemeProvider>
  );
}

export default App;
