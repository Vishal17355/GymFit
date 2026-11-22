import React from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';

export const Brand = () => (
  <Link className="gym-brand" to="/" aria-label="GymFit home">
    <span className="gym-mark"><Dumbbell size={19} strokeWidth={2.5} aria-hidden="true" /></span>
    <span>gymfit<span className="gym-brand-dot">.</span></span>
  </Link>
);
