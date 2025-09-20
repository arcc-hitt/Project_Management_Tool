import React from 'react';

const ProjectsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">
          Manage your projects and track progress.
        </p>
      </div>
      
      <div className="flex items-center justify-center h-96 border-2 border-dashed border-muted rounded-lg">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-muted-foreground mb-2">
            Projects Management
          </h2>
          <p className="text-sm text-muted-foreground">
            This page will contain project management functionality.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;