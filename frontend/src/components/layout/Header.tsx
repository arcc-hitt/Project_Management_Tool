import React from 'react';
import { Menu } from 'lucide-react';
import { Button } from '../ui/button';
import NotificationsDropdown from '../features/NotificationsDropdown';
import OnlineUsersIndicator from '../features/OnlineUsersIndicator';

export const Header: React.FC = () => {
  return (
    <header className="bg-card border-b px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Mobile menu button */}
        <Button variant="ghost" size="sm" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        
        {/* Page title - will be dynamically updated */}
        <div className="flex-1 md:flex-none">
          <h2 className="text-lg font-semibold">Dashboard</h2>
        </div>
        
        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Online Users */}
          <OnlineUsersIndicator />
          
          {/* Notifications */}
          <NotificationsDropdown />
        </div>
      </div>
    </header>
  );
};