import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { 
  FolderOpen, 
  CheckSquare, 
  Users, 
  Clock,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

const DashboardPage: React.FC = () => {
  // TODO: Replace with actual data from API
  const stats = {
    totalProjects: 12,
    activeProjects: 8,
    totalTasks: 156,
    completedTasks: 89,
    pendingTasks: 67,
    overdueTasks: 15,
    totalUsers: 25,
    totalHoursLogged: 1240
  };

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    description: string;
    icon: React.ElementType;
    trend?: { value: number; isPositive: boolean };
  }> = ({ title, value, description, icon: Icon, trend }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className={`flex items-center text-xs mt-1 ${
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            <TrendingUp className="h-3 w-3 mr-1" />
            {trend.isPositive ? '+' : ''}{trend.value}% from last month
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your project management metrics.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Projects"
          value={stats.totalProjects}
          description={`${stats.activeProjects} active projects`}
          icon={FolderOpen}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Total Tasks"
          value={stats.totalTasks}
          description={`${stats.completedTasks} completed`}
          icon={CheckSquare}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Team Members"
          value={stats.totalUsers}
          description="Active team members"
          icon={Users}
          trend={{ value: 4, isPositive: true }}
        />
        <StatCard
          title="Hours Logged"
          value={`${stats.totalHoursLogged}h`}
          description="This month"
          icon={Clock}
          trend={{ value: 15, isPositive: true }}
        />
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Projects */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Projects</CardTitle>
            <CardDescription>
              Your most recently updated projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* TODO: Replace with actual data */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Project Alpha {i}</p>
                    <p className="text-xs text-muted-foreground">Updated 2 hours ago</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      In Progress
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Urgent Tasks */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
              Urgent Tasks
            </CardTitle>
            <CardDescription>
              {stats.overdueTasks} overdue tasks need attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* TODO: Replace with actual data */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Task {i}</p>
                    <p className="text-xs text-muted-foreground">Due yesterday</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Progress */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Task Progress</CardTitle>
            <CardDescription>Completion status across all projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Completed</span>
                <span className="text-sm text-muted-foreground">{stats.completedTasks}</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${(stats.completedTasks / stats.totalTasks) * 100}%` }}
                ></div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">In Progress</span>
                <span className="text-sm text-muted-foreground">{stats.pendingTasks}</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${(stats.pendingTasks / stats.totalTasks) * 100}%` }}
                ></div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overdue</span>
                <span className="text-sm text-muted-foreground">{stats.overdueTasks}</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full">
                <div 
                  className="bg-red-500 h-2 rounded-full" 
                  style={{ width: `${(stats.overdueTasks / stats.totalTasks) * 100}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <button className="flex items-center justify-start w-full p-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                <FolderOpen className="h-4 w-4 mr-2" />
                Create New Project
              </button>
              <button className="flex items-center justify-start w-full p-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                <CheckSquare className="h-4 w-4 mr-2" />
                Add Task
              </button>
              <button className="flex items-center justify-start w-full p-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                <Users className="h-4 w-4 mr-2" />
                Invite Team Member
              </button>
              <button className="flex items-center justify-start w-full p-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                <Clock className="h-4 w-4 mr-2" />
                Log Time
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;