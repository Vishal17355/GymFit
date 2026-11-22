import React, { useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { WorkspaceContext } from './context/WorkspaceContext';
import { roles } from './data/roles';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ExerciseLibrary } from './pages/ExerciseLibrary';
import { WorkoutPlanner } from './pages/WorkoutPlanner';
import { WorkoutPlanBuilder } from './pages/WorkoutPlanBuilder';

import { RoleWorkspace } from './pages/RoleWorkspace';
import DietPlannerPage from './pages/DietPlannerPage';
import NutritionDiaryPage from './pages/NutritionDiaryPage';
import NutritionToolsPage from './pages/NutritionToolsPage';
import HomeWorkoutDashboard from './pages/HomeWorkout/HomeWorkoutDashboard';
import { MemberFeature } from './components/workspace/MemberFeature';
import { bindMemberApiSession } from './services/memberApiSession';
import { workspacePath } from './data/workspaceNavigation';

const trainingRoles = ['MEMBER', 'TRAINER', 'GYM_OWNER'];
const memberFeatures = [
  ['/member/diet-plan', 'Diet planner', DietPlannerPage],
  ['/member/nutrition-diary', 'Nutrition diary', NutritionDiaryPage],
  ['/member/nutrition-tools', 'Nutrition tools', NutritionToolsPage],
  ['/member/home-workout', 'Home workouts', HomeWorkoutDashboard],
];

function WorkspaceRoute({ allowedRoles, children }) {
  const { user, checking } = useAuth();

  if (checking) return <main className="site-wrap py-8" role="status">Checking your session…</main>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to={roles[user.role].path} replace />;
  return <WorkspaceContext.Provider key={user.id} value={user.role}>{children}</WorkspaceContext.Provider>;
}

function AppRoutes() {
  const { pathname, hash } = useLocation();
  const { request } = useAuth();

  useLayoutEffect(() => bindMemberApiSession(request), [request]);

  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {Object.keys(roles).map((role) => (
        <Route key={role} path={`${workspacePath(role)}/:section?`} element={<WorkspaceRoute allowedRoles={[role]}><RoleWorkspace role={role} /></WorkspaceRoute>} />
      ))}
      <Route path="/member/workout-plan" element={<WorkspaceRoute allowedRoles={['MEMBER']}><WorkoutPlanBuilder /></WorkspaceRoute>} />
      {memberFeatures.map(([path, title, Screen]) => (
        <Route key={path} path={path} element={<WorkspaceRoute allowedRoles={['MEMBER']}>
          <MemberFeature title={title}><Screen /></MemberFeature>
        </WorkspaceRoute>} />
      ))}
      <Route path="/diet-plan" element={<Navigate to="/member/diet-plan" replace />} />
      <Route path="/home-workout" element={<Navigate to="/member/home-workout" replace />} />
      <Route path="/anatomy" element={<WorkspaceRoute allowedRoles={trainingRoles}><WorkoutPlanBuilder /></WorkspaceRoute>} />
      <Route path="/exercises" element={<WorkspaceRoute allowedRoles={trainingRoles}><ExerciseLibrary /></WorkspaceRoute>} />
      <Route path="/planner" element={<WorkspaceRoute allowedRoles={trainingRoles}><WorkoutPlanner /></WorkspaceRoute>} />
      <Route path="/progress" element={<Navigate to={workspacePath('MEMBER', 'progress')} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
