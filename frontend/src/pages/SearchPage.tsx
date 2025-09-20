import React from 'react';

const SearchPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search</h1>
        <p className="text-muted-foreground">
          Search across projects, tasks, and team members.
        </p>
      </div>
      
      <div className="flex items-center justify-center h-96 border-2 border-dashed border-muted rounded-lg">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-muted-foreground mb-2">
            Global Search
          </h2>
          <p className="text-sm text-muted-foreground">
            This page will contain advanced search and filtering functionality.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;