import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { roles } from '../../data/roles';
import { ThemeToggle } from '../theme/ThemeToggle';
import { Brand } from './Brand';

export const Navbar = () => {
  const { user } = useAuth();

  return (
    <header className="site-header">
      <div className="site-wrap site-nav">
        <Brand />
        <nav className="product-nav" aria-label="Product navigation">
          <Link to="/#features">Features</Link>
          <Link to="/#workspace-preview">Product preview</Link>
          <Link to="/#workspaces">Workspaces</Link>
        </nav>
        <div className="site-actions">
          <ThemeToggle />
          <Link className="action action-ink action-small" to={user ? roles[user.role].path : '/login'}>
            {user ? 'Workspace' : 'Sign in'} <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
};
