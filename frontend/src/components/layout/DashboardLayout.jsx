import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { roles } from '../../data/roles';
import { useWorkspaceRole } from '../../context/WorkspaceContext';
import { Sidebar } from './Sidebar';
import { Brand } from './Brand';
import { ThemeToggle } from '../theme/ThemeToggle';

export const DashboardLayout = ({ children }) => {
  const location = useLocation();
  const roleKey = useWorkspaceRole();
  const role = roles[roleKey];
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        document.getElementById('workspace-menu-toggle')?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <div className="workspace" data-tone={role?.tone || 'member'}>
      <div className={menuOpen ? 'workspace-rail is-open' : 'workspace-rail'} id="workspace-menu">
        <Sidebar roleKey={roleKey} closeMenu={() => setMenuOpen(false)} />
      </div>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="workspace-mobile-brand">
            <button
              id="workspace-menu-toggle"
              className="icon-control"
              type="button"
              aria-label={menuOpen ? 'Close workspace navigation' : 'Open workspace navigation'}
              aria-expanded={menuOpen}
              aria-controls="workspace-menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Brand />
          </div>
          <div className="workspace-context">
            <span>Workspace</span>
            <strong>{role.label}</strong>
          </div>
          <ThemeToggle />
        </header>
        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
};
