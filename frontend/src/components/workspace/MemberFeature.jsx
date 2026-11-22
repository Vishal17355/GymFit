import React from 'react';
import { NavLink } from 'react-router-dom';
import { DashboardLayout } from '../layout/DashboardLayout';
import { WorkspaceHeading } from '../layout/WorkspaceHeading';
import { memberFeatureLinks } from '../../data/workspaceNavigation';

export function MemberFeature({ title, children }) {
  return <DashboardLayout>
    <div className="dashboard-stack work-desk">
      <WorkspaceHeading title={title} />
      <nav aria-label="Member tools" className="work-tabs">
        {memberFeatureLinks.map(([label, path, Icon]) => <NavLink key={path} to={path} end>
          <Icon size={16} aria-hidden="true" />{label}
        </NavLink>)}
      </nav>
      <div className="member-feature-content">{children}</div>
    </div>
  </DashboardLayout>;
}
