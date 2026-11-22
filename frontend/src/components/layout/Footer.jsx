import React from 'react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';

export const Footer = () => (
  <footer className="site-footer">
    <div className="site-wrap footer-inner">
      <Brand />
      <nav aria-label="Footer navigation">
        <Link to="/#features">Features</Link>
        <Link to="/#workspaces">Workspaces</Link>
        <Link to="/login">Sign in</Link>
      </nav>
      <small>© {new Date().getFullYear()} GymFit</small>
    </div>
  </footer>
);
