import React from 'react';

export const WorkspaceHeading = ({ label, title, description, action }) => (
  <div className="workspace-heading">
    <div>
      {label && <p className="eyebrow">{label}</p>}
      <h1>{title}</h1>
      {description && <p className="workspace-description">{description}</p>}
    </div>
    {action}
  </div>
);
