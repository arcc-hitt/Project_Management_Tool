import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  FolderOpen,
  CheckSquare,
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  Target,
  ArrowRight
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { format, subDays, isAfter } from 'date-fns';
import type { Project, Task } from '../types';
import { projectService } from '../services/projectService';
import { taskService } from '../services/taskService';
import { toast } from 'sonner';

const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch projects and tasks
      const [projectResponse, taskResponse] = await Promise.all([
        projectService.getProjects({ limit: 50 }),
        taskService.getTasks({ limit: 100 })
      ]);

      setProjects(projectResponse.projects);
      setTasks(taskResponse.tasks);

      // Mock recent activity
      setRecentActivity([
        { id: 1, type: 'task_completed', description: 'John completed "Setup authentication"', time: '2 hours ago' },
        { id: 2, type: 'project_created', description: 'New project "Mobile App" was created', time: '4 hours ago' },
        { id: 3, type: 'user_assigned', description: 'Jane was assigned to "Database Migration"', time: '6 hours ago' },
        { id: 4, type: 'task_overdue', description: 'Task "Code Review" is overdue', time: '1 day ago' },
      ]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch dashboard data');

      // Mock data for demo
      setProjects([
        {
          id: 1,
          name: 'Project Management Tool',
          description: 'A comprehensive project management application',
          status: 'active',
          priority: 'high',
          startDate: '2025-01-01',
          endDate: '2025-06-30',
          managerId: 1,
          createdAt: '',
          updatedAt: '',
          manager: { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', role: 'manager', isActive: true, createdAt: '', updatedAt: '' }
        },
        {
          id: 2,
          name: 'Website Redesign',
          description: 'Modernize the company website',
          status: 'planning',
          priority: 'medium',
          startDate: '2025-03-01',
          managerId: 1,
          createdAt: '',
          updatedAt: '',
          manager: { id: 1, firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', role: 'manager', isActive: true, createdAt: '', updatedAt: '' }
        }
      ]);

      setTasks([
        { id: 1, title: 'Setup project structure', status: 'done', priority: 'high', projectId: 1, createdAt: '', updatedAt: '', description: '' },
        { id: 2, title: 'Design database schema', status: 'in_progress', priority: 'medium', projectId: 1, createdAt: '', updatedAt: '', description: '' },
        { id: 3, title: 'Implement authentication', status: 'todo', priority: 'high', projectId: 1, createdAt: '', updatedAt: '', description: '' },
        { id: 4, title: 'Setup deployment', status: 'review', priority: 'medium', projectId: 1, createdAt: '', updatedAt: '', description: '' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === 'active').length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'done').length,
    pendingTasks: tasks.filter(t => t.status !== 'done').length,
    overdueTasks: tasks.filter(t => t.dueDate && isAfter(new Date(), new Date(t.dueDate)) && t.status !== 'done').length,
    totalUsers: 25, // This would come from user service
    completionRate: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0
  };

  // Chart data
  const taskStatusData = [
    { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length, color: '#94a3b8' },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, color: '#3b82f6' },
    { name: 'Review', value: tasks.filter(t => t.status === 'review').length, color: '#f59e0b' },
    { name: 'Done', value: tasks.filter(t => t.status === 'done').length, color: '#10b981' }
  ];

  const priorityData = [
    { name: 'Low', value: tasks.filter(t => t.priority === 'low').length },
    { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length },
    { name: 'High', value: tasks.filter(t => t.priority === 'high').length },
    { name: 'Critical', value: tasks.filter(t => t.priority === 'critical').length }
  ];

  // Mock productivity data
  const productivityData = Array.from({ length: 7 }, (_, i) => ({
    date: format(subDays(new Date(), 6 - i), 'MMM dd'),
    tasksCompleted: Math.floor(Math.random() * 10) + 2,
    hoursLogged: Math.floor(Math.random() * 6) + 4
  }));

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
          <div className={`flex items-center text-xs mt-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
            <TrendingUp className="h-3 w-3 mr-1" />
            {trend.isPositive ? '+' : ''}{trend.value}% from last month
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's what's happening with your projects.
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
          description="Active contributors"
          icon={Users}
          trend={{ value: 3, isPositive: true }}
        />
        <StatCard
          title="Completion Rate"
          value={`${stats.completionRate}%`}
          description="This month"
          icon={Target}
          trend={{ value: 5, isPositive: true }}
        />
      </div>

      {/* Charts and Analytics */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Task Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Task Status Distribution</CardTitle>
            <CardDescription>Current status of all tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                  <Pie
                  data={taskStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name}: ${typeof percent === 'number' ? (percent * 100).toFixed(0) : '0'}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {taskStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Task Priority Distribution</CardTitle>
            <CardDescription>Tasks by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Productivity Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Productivity Trends</CardTitle>
          <CardDescription>Daily task completion and hours logged</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={productivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="tasksCompleted"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                name="Tasks Completed"
              />
              <Area
                type="monotone"
                dataKey="hoursLogged"
                stackId="2"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                name="Hours Logged"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Projects</CardTitle>
                <CardDescription>Latest project updates</CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projects.slice(0, 3).map((project) => (
                <div key={project.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{project.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Manager: {project.manager?.firstName} {project.manager?.lastName}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                    <Badge variant={project.priority === 'high' ? 'destructive' : 'outline'}>
                      {project.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest team updates</CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                  <div className="flex-1">
                    <div className="text-sm">{activity.description}</div>
                    <div className="text-xs text-muted-foreground">{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Items */}
      {stats.overdueTasks > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-800">Urgent Attention Required</CardTitle>
            </div>
            <CardDescription className="text-red-700">
              You have {stats.overdueTasks} overdue tasks that need immediate attention.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" size="sm">
              View Overdue Tasks
            </Button>
          </CardContent>
        </Card>
      )}

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