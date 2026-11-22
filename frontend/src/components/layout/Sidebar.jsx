import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Building2, ClipboardList, Dumbbell, LayoutDashboard, LogOut, ScanLine } from 'lucide-react';
import { roles } from '../../data/roles';
import { memberFeatureLinks, roleWorkspaces, workspacePath } from '../../data/workspaceNavigation';
import { useAuth } from '../../context/AuthContext';
import { Brand } from './Brand';

const toolLinks = {
  MEMBER: [
    ...memberFeatureLinks,
    ['Workout planner', '/planner', ClipboardList],
    ['Exercise library', '/exercises', Dumbbell],
    ['3D anatomy', '/member/workout-plan', ScanLine],
  ],
  TRAINER: [
    ['Split planner', '/planner', ClipboardList],
    ['Exercise library', '/exercises', Dumbbell],
    ['3D anatomy', '/anatomy', ScanLine],
  ],
  GYM_OWNER: [
    ['Program planner', '/planner', ClipboardList],
    ['Exercise library', '/exercises', Dumbbell],
    ['3D anatomy', '/anatomy', ScanLine],
  ],
  PLATFORM_ADMIN: [],
};

export const Sidebar = ({ roleKey, closeMenu }) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState(false);
  const role = roles[roleKey];
  const links = [
    [roleKey === 'PLATFORM_ADMIN' ? 'Platform overview' : 'Overview', role.path, LayoutDashboard],
    ...roleWorkspaces[roleKey].sections.map(([section, label, Icon]) => [label, workspacePath(roleKey, section), Icon]),
    ...toolLinks[roleKey],
  ];

  const exit = async () => {
    setLeaving(true);
    setError(false);
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch {
      setError(true);
    } finally {
      setLeaving(false);
    }
  };

  return (
    <aside className="workspace-sidebar">
      <Brand />
      <div className="workspace-identity">
        <Building2 size={18} aria-hidden="true" />
        <strong>{role.label}</strong>
      </div>
      <nav className="workspace-links" aria-label="Workspace navigation">
        {links.map(([label, path, Icon]) => (
          <NavLink key={path} to={path} end onClick={closeMenu}>
            <Icon size={18} aria-hidden="true" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button type="button" disabled={leaving} onClick={exit}>
          <LogOut size={17} aria-hidden="true" /> {leaving ? 'Signing out…' : 'Sign out'}
        </button>
        {error && <p role="alert" className="px-2 text-xs text-rose-300">Could not sign out. Try again.</p>}
      </div>
    </aside>
  );
};
