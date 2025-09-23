import React, { useState, useEffect } from 'react';
import { Activity, Clock, User as UserIcon, FolderOpen, CheckSquare, MessageCircle, FileText, Timer, Filter, RefreshCw, Calendar, Users, ChevronDown, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Pagination } from '../components/ui/pagination';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { activityService, type Activity as ServiceActivity } from '../services/activityService';
import { userService } from '../services/userService';
import { projectService } from '../services/projectService';
import type { User, Project } from '../types';
import { toast } from 'sonner';

const ActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<ServiceActivity[]>([]);
  const [allActivities, setAllActivities] = useState<ServiceActivity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [activeTab, setActiveTab] = useState('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;

  // Activity type configurations
  const activityConfig = {
    create: { color: 'bg-green-500', icon: '+', label: 'Created' },
    update: { color: 'bg-blue-500', icon: '✓', label: 'Updated' },
    delete: { color: 'bg-red-500', icon: '×', label: 'Deleted' },
    assign: { color: 'bg-purple-500', icon: '→', label: 'Assigned' },
    complete: { color: 'bg-emerald-500', icon: '✓', label: 'Completed' },
    start: { color: 'bg-yellow-500', icon: '▶', label: 'Started' },
    pause: { color: 'bg-orange-500', icon: '⏸', label: 'Paused' },
    stop: { color: 'bg-gray-500', icon: '⏹', label: 'Stopped' },
    comment: { color: 'bg-cyan-500', icon: '💬', label: 'Commented' },
    upload: { color: 'bg-indigo-500', icon: '📎', label: 'Uploaded' },
    login: { color: 'bg-teal-500', icon: '🔐', label: 'Logged in' },
    logout: { color: 'bg-slate-500', icon: '🚪', label: 'Logged out' }
  };

  const entityTypeConfig = {
    user: { icon: UserIcon, color: 'text-blue-500', label: 'User' },
    project: { icon: FolderOpen, color: 'text-green-500', label: 'Project' },
    task: { icon: CheckSquare, color: 'text-purple-500', label: 'Task' },
    comment: { icon: MessageCircle, color: 'text-orange-500', label: 'Comment' },
    file: { icon: FileText, color: 'text-indigo-500', label: 'File' },
    time_entry: { icon: Timer, color: 'text-red-500', label: 'Time Entry' }
  };

  // Date filter functions
  const getDateRange = (filter: string) => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    switch (filter) {
      case 'today':
        return {
          startDate: startOfToday.toISOString().split('T')[0],
          endDate: startOfToday.toISOString().split('T')[0]
        };
      case 'yesterday':
        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          startDate: yesterday.toISOString().split('T')[0],
          endDate: yesterday.toISOString().split('T')[0]
        };
      case 'thisWeek':
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        return {
          startDate: startOfWeek.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
      case 'thisMonth':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          startDate: startOfMonth.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
      case 'lastWeek':
        const lastWeekStart = new Date(startOfToday);
        lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
        return {
          startDate: lastWeekStart.toISOString().split('T')[0],
          endDate: lastWeekEnd.toISOString().split('T')[0]
        };
      case 'lastMonth':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          startDate: lastMonth.toISOString().split('T')[0],
          endDate: lastMonthEnd.toISOString().split('T')[0]
        };
      default:
        return { startDate: undefined, endDate: undefined };
    }
  };

  // Client-side filtering
  const applyFilters = (activities: ServiceActivity[]) => {
    return activities.filter(activity => {
      const { startDate, endDate } = getDateRange(dateFilter);
      
      const matchesDate = !startDate || !endDate || 
        (activity.createdAt >= startDate && activity.createdAt <= endDate);
      
      const matchesEntityType = entityTypeFilter === 'all' || 
        activity.entityType === entityTypeFilter;
      
      const matchesUser = userFilter === 'all' || 
        activity.userId?.toString() === userFilter;
      
      const matchesAction = actionFilter === 'all' || 
        activity.action === actionFilter;
      
      const matchesSearch = !searchTerm.trim() || 
        activity.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTab = activeTab === 'all' || 
        (activeTab === 'my' && activity.userId === getCurrentUserId()) ||
        (activeTab === 'projects' && activity.entityType === 'project') ||
        (activeTab === 'tasks' && activity.entityType === 'task') ||
        (activeTab === 'time' && activity.entityType === 'comment'); // Using comment as placeholder since time_entry not in base type
      
      return matchesDate && matchesEntityType && matchesUser && matchesAction && matchesSearch && matchesTab;
    });
  };

  // Get current user ID (mock for now)
  const getCurrentUserId = () => 1; // In real app, get from auth context

  // Real-time filtering effect
  useEffect(() => {
    if (allActivities.length > 0) {
      const filteredActivities = applyFilters(allActivities);
      setActivities(filteredActivities);
      setTotalItems(filteredActivities.length);
      setTotalPages(Math.ceil(filteredActivities.length / itemsPerPage));
      if (currentPage > Math.ceil(filteredActivities.length / itemsPerPage) && filteredActivities.length > 0) {
        setCurrentPage(1);
      }
    }
  }, [allActivities, entityTypeFilter, userFilter, projectFilter, actionFilter, dateFilter, searchTerm, activeTab, currentPage]);

  const fetchData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Fetch activities, users, and projects in parallel
      const [activitiesResponse, usersResponse, projectsResponse] = await Promise.all([
        activityService.getActivities({ limit: 200, sortBy: 'createdAt', sortOrder: 'desc' }),
        userService.getUsers({ limit: 100 }),
        projectService.getProjects({ limit: 100 })
      ]);
      
      setAllActivities(activitiesResponse.activities);
      setUsers(usersResponse.users);
      setProjects(projectsResponse.projects);
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch data');
      
      // Mock data for demo
      const mockActivities: ServiceActivity[] = [
        {
          id: 1,
          action: 'create',
          entityType: 'task',
          entityId: 1,
          userId: 1,
          details: 'Created new task: Implement user authentication',
          createdAt: new Date().toISOString(),
          user: { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', role: 'developer', isActive: true, createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z' }
        },
        {
          id: 2,
          action: 'update',
          entityType: 'project',
          entityId: 1,
          userId: 2,
          details: 'Updated project status to In Progress',
          createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          user: { id: 2, firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', role: 'manager', isActive: true, createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z' }
        },
        {
          id: 3,
          action: 'complete',
          entityType: 'task',
          entityId: 2,
          userId: 3,
          details: 'Completed task: Fix login bugs',
          createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          user: { id: 3, firstName: 'Bob', lastName: 'Johnson', email: 'bob@example.com', role: 'developer', isActive: true, createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z' }
        },
        {
          id: 4,
          action: 'start',
          entityType: 'comment',
          entityId: 1,
          userId: 1,
          details: 'Started working on database optimization',
          createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
          user: { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', role: 'developer', isActive: true, createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z' }
        },
        {
          id: 5,
          action: 'comment',
          entityType: 'task',
          entityId: 1,
          userId: 2,
          details: 'Added comment: Please review the authentication flow',
          createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          user: { id: 2, firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', role: 'manager', isActive: true, createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z' }
        },
        {
          id: 6,
          action: 'assign',
          entityType: 'task',
          entityId: 3,
          userId: 2,
          details: 'Assigned task to John Doe',
          createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
          user: { id: 2, firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', role: 'manager', isActive: true, createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z' }
        }
      ];
      
      setAllActivities(mockActivities);
      setUsers([
        { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', role: 'developer', isActive: true, createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z' },
        { id: 2, firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', role: 'manager', isActive: true, createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z' },
        { id: 3, firstName: 'Bob', lastName: 'Johnson', email: 'bob@example.com', role: 'developer', isActive: true, createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z' }
      ]);
      setProjects([
        { id: 1, name: 'Project Management Tool' },
        { id: 2, name: 'E-commerce Platform' }
      ] as Project[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const activityDate = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - activityDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return activityDate.toLocaleDateString();
  };

  const getActivityIcon = (activity: ServiceActivity) => {
    const entityConfig = entityTypeConfig[activity.entityType as keyof typeof entityTypeConfig];
    
    if (entityConfig) {
      const IconComponent = entityConfig.icon;
      return <IconComponent className={`h-4 w-4 ${entityConfig.color}`} />;
    }
    
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  const getActivityBadgeColor = (action: string) => {
    const config = activityConfig[action as keyof typeof activityConfig];
    return config ? config.color : 'bg-gray-500';
  };

  const getActivityLabel = (action: string) => {
    const config = activityConfig[action as keyof typeof activityConfig];
    return config ? config.label : action;
  };

  const clearFilters = () => {
    setEntityTypeFilter('all');
    setUserFilter('all');
    setProjectFilter('all');
    setActionFilter('all');
    setDateFilter('today');
    setSearchTerm('');
    setActiveTab('all');
    setCurrentPage(1);
  };

  // Get unique actions from activities
  const uniqueActions = [...new Set(allActivities.map(a => a.action))];

  // Paginate activities for display
  const paginatedActivities = activities.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Calculate activity statistics
  const todayActivities = allActivities.filter(activity => {
    const today = new Date().toISOString().split('T')[0];
    return activity.createdAt.split('T')[0] === today;
  });

  const myActivities = allActivities.filter(activity => activity.userId === getCurrentUserId());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading activity data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Feed</h1>
          <p className="text-muted-foreground">
            Track project activity and team collaboration in real-time.
          </p>
        </div>
        <Button 
          onClick={() => fetchData(true)} 
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allActivities.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayActivities.length}</div>
            <p className="text-xs text-muted-foreground">Activities today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Activities</CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myActivities.length}</div>
            <p className="text-xs text-muted-foreground">Your activities</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(todayActivities.map(a => a.userId)).size}
            </div>
            <p className="text-xs text-muted-foreground">Active today</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Activity Timeline</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={clearFilters}>
                  Clear All Filters
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList>
              <TabsTrigger value="all">All Activity</TabsTrigger>
              <TabsTrigger value="my">My Activity</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="time">Time Tracking</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
            <Input
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="lg:col-span-2"
            />
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="thisWeek">This Week</SelectItem>
                <SelectItem value="lastWeek">Last Week</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="project">Projects</SelectItem>
                <SelectItem value="task">Tasks</SelectItem>
                <SelectItem value="comment">Comments</SelectItem>
                <SelectItem value="time_entry">Time Entries</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger>
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.firstName} {user.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {getActivityLabel(action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Activity List */}
          <div className="space-y-4">
            {paginatedActivities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 ${getActivityBadgeColor(activity.action)} rounded-full flex items-center justify-center`}>
                    {getActivityIcon(activity)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activity.user?.firstName}`} />
                        <AvatarFallback>
                          {activity.user?.firstName?.[0]}{activity.user?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {activity.user?.firstName} {activity.user?.lastName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getActivityLabel(activity.action)}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {entityTypeConfig[activity.entityType as keyof typeof entityTypeConfig]?.label || activity.entityType}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimeAgo(activity.createdAt)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activity.details}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="flex-shrink-0">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {paginatedActivities.length === 0 && (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No activities found for the selected criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          itemName="activities"
        />
      )}
    </div>
  );
};

export default ActivityPage;