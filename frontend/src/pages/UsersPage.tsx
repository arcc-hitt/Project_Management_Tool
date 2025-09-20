import React from 'react';

const UsersPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Manage team members and user accounts.
        </p>
      </div>
      
      <div className="flex items-center justify-center h-96 border-2 border-dashed border-muted rounded-lg">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-muted-foreground mb-2">
            User Management
          </h2>
          <p className="text-sm text-muted-foreground">
            This page will contain user management functionality (Admin only).
          </p>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;