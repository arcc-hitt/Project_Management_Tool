import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderOpen, 
  CheckSquare, 
  Users, 
  Search,
  Clock,
  Activity,
  Bell,
  Settings,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Users', href: '/users', icon: Users, adminOnly: true },
  { name: 'Search', href: '/search', icon: Search },
  { name: 'Time Tracking', href: '/time-tracking', icon: Clock },
  { name: 'Activity', href: '/activity', icon: Activity },
  { name: 'Notifications', href: '/notifications', icon: Bell },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const filteredNavigation = navigation.filter(item => 
    !item.adminOnly || user?.role === 'admin'
  );

  return (
    <div className="hidden md:flex md:w-64 md:flex-col">
      <div className="flex flex-col flex-grow pt-5 overflow-y-auto bg-card border-r">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0 px-4 mb-8">
          <h1 className="text-xl font-bold text-primary">ProjectFlow</h1>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-2 space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                  ${isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }
                `}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        {/* User section */}
        <div className="flex-shrink-0 p-4 border-t">
          <div className="flex items-center mb-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-foreground">
                  {user?.firstName?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </div>
          
          <div className="space-y-1">
            <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};