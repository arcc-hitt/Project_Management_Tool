import React from 'react';

const TimeTrackingPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Time Tracking</h1>
        <p className="text-muted-foreground">
          Track time spent on tasks and generate reports.
        </p>
      </div>
      
      <div className="flex items-center justify-center h-96 border-2 border-dashed border-muted rounded-lg">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-muted-foreground mb-2">
            Time Tracking
          </h2>
          <p className="text-sm text-muted-foreground">
            This page will contain time tracking and reporting functionality.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TimeTrackingPage;