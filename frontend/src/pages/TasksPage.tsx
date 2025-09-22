import React, { useState, useEffect } from 'react';
import { Plus, Search, User, Calendar, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Pagination } from '../components/ui/pagination';
import { taskService } from '../services/taskService';
import { projectService } from '../services/projectService';
import type { Task, Project } from '../types';
import { toast } from 'sonner';

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]); // Store all fetched tasks for client-side filtering
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Remove debounced search - we'll use real-time filtering instead

  // Client-side search filtering function
  const applySearchFilter = (taskList: Task[]) => {
    if (!searchTerm.trim()) {
      return taskList;
    }
    
    const searchLower = searchTerm.toLowerCase();
    return taskList.filter(task => 
      task.title.toLowerCase().includes(searchLower) ||
      (task.description && task.description.toLowerCase().includes(searchLower))
    );
  };

  // Real-time search effect
  useEffect(() => {
    if (allTasks.length > 0) {
      const filteredTasks = applySearchFilter(allTasks);
      setTasks(filteredTasks);
    }
  }, [searchTerm, allTasks]);

  // Create task form state
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    projectId: 0,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    dueDate: '',
    estimatedHours: 0
  });

  useEffect(() => {
    fetchTasks();
    fetchProjects();
  }, [statusFilter, priorityFilter, currentPage]);

  // Real-time filtering when search term changes
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1); // Reset to page 1 when search changes
    }
  }, [searchTerm]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [statusFilter, priorityFilter]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const filters = {
        // Don't send search to API - we'll filter client-side for real-time results
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        page: currentPage,
        limit: 10
      };
      const response = await taskService.getTasks(filters);
      
      // Store all tasks for client-side filtering
      setAllTasks(response.tasks);
      
      // Apply client-side search filtering
      const filteredTasks = applySearchFilter(response.tasks);
      setTasks(filteredTasks);
      
      // Update pagination state
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
        setTotalItems(response.pagination.totalItems);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch tasks');
      // Mock data for demo
      setTasks([
        {
          id: 1,
          title: 'Setup project structure',
          description: 'Initialize the project with proper folder structure',
          status: 'todo',
          priority: 'high',
          projectId: 1,
          assigneeId: 1,
          dueDate: '2025-01-15',
          estimatedHours: 4,
          actualHours: 0,
          createdAt: '',
          updatedAt: '',
          assignee: { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', role: 'developer', isActive: true, createdAt: '', updatedAt: '' }
        },
        {
          id: 2,
          title: 'Design database schema',
          description: 'Create comprehensive database design for the application',
          status: 'in_progress',
          priority: 'medium',
          projectId: 1,
          assigneeId: 2,
          dueDate: '2025-01-20',
          estimatedHours: 8,
          actualHours: 3,
          createdAt: '',
          updatedAt: '',
          assignee: { id: 2, firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', role: 'developer', isActive: true, createdAt: '', updatedAt: '' }
        },
        {
          id: 3,
          title: 'Implement authentication',
          description: 'Build user authentication system with JWT',
          status: 'in_review',
          priority: 'high',
          projectId: 1,
          assigneeId: 1,
          dueDate: '2025-01-25',
          estimatedHours: 12,
          actualHours: 10,
          createdAt: '',
          updatedAt: '',
          assignee: { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', role: 'developer', isActive: true, createdAt: '', updatedAt: '' }
        },
        {
          id: 4,
          title: 'Setup deployment pipeline',
          description: 'Configure CI/CD pipeline for automated deployments',
          status: 'done',
          priority: 'medium',
          projectId: 1,
          assigneeId: 2,
          dueDate: '2025-01-10',
          estimatedHours: 6,
          actualHours: 7,
          createdAt: '',
          updatedAt: '',
          assignee: { id: 2, firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', role: 'developer', isActive: true, createdAt: '', updatedAt: '' }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await projectService.getProjects({ limit: 50 });
      setProjects(response.projects);
    } catch (error: any) {
      // Mock projects for demo
      setProjects([
        { id: 1, name: 'Project Management Tool', description: 'Main project', status: 'active', priority: 'high', startDate: '2025-01-01', managerId: 1, createdAt: '', updatedAt: '' },
        { id: 2, name: 'Website Redesign', description: 'UI/UX improvements', status: 'active', priority: 'medium', startDate: '2025-01-15', managerId: 1, createdAt: '', updatedAt: '' }
      ]);
    }
  };

  const handleCreateTask = async () => {
    try {
      if (!createForm.title.trim()) {
        toast.error('Task title is required');
        return;
      }

      if (!createForm.projectId || createForm.projectId === 0) {
        toast.error('Please select a project');
        return;
      }

      await taskService.createTask({
        title: createForm.title,
        description: createForm.description,
        projectId: createForm.projectId,
        priority: createForm.priority,
        dueDate: createForm.dueDate || undefined,
        estimatedHours: createForm.estimatedHours || undefined
      });

      toast.success('Task created successfully');
      setIsCreateDialogOpen(false);
      setCreateForm({
        title: '',
        description: '',
        projectId: 0,
        priority: 'medium',
        dueDate: '',
        estimatedHours: 0
      });
      
      // Reset to page 1 to show the new task (which should be first due to newest-first sorting)
      setCurrentPage(1);
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create task');
    }
  };

  const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      await taskService.updateTaskStatus(taskId, newStatus as any);
      toast.success('Task status updated');
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update task status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_review': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'done': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const TaskCard: React.FC<{ task: Task }> = ({ task }) => (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-base">{task.title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleUpdateTaskStatus(task.id, 'todo')}>
                Move to Todo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}>
                Move to In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdateTaskStatus(task.id, 'in_review')}>
                Move to Review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdateTaskStatus(task.id, 'done')}>
                Move to Done
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex gap-2">
          <Badge className={getPriorityColor(task.priority)}>
            {task.priority}
          </Badge>
          <Badge className={getStatusColor(task.status)}>
            {task.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="line-clamp-2 mb-3">
          {task.description || 'No description provided'}
        </CardDescription>
        <div className="space-y-2 text-sm text-muted-foreground">
          {task.assignee && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>{task.assignee.firstName} {task.assignee.lastName}</span>
            </div>
          )}
          {task.dueDate && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Estimated: {task.estimatedHours || 0}h</span>
            <span>Actual: {task.actualHours || 0}h</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const KanbanBoard: React.FC = () => {
    const columns = [
      { id: 'todo', title: 'To Do', status: 'todo' },
      { id: 'in_progress', title: 'In Progress', status: 'in_progress' },
      { id: 'in_review', title: 'Review', status: 'in_review' },
      { id: 'done', title: 'Done', status: 'done' }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map((column) => {
          const columnTasks = tasks.filter(task => task.status === column.status);
          return (
            <div key={column.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  {column.title}
                </h3>
                <Badge variant="outline">{columnTasks.length}</Badge>
              </div>
              <div className="space-y-3">
                {columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            Manage tasks across all your projects
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>
                Add a new task to track work progress.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title</Label>
                <Input
                  id="title"
                  value={createForm.title}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project">Project</Label>
                <Select value={createForm.projectId.toString()} onValueChange={(value) => setCreateForm(prev => ({ ...prev, projectId: parseInt(value) }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter task description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={createForm.priority} onValueChange={(value) => setCreateForm(prev => ({ ...prev, priority: value as any }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedHours">Estimated Hours</Label>
                  <Input
                    id="estimatedHours"
                    type="number"
                    value={createForm.estimatedHours}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, estimatedHours: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTask}>
                Create Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="in_review">Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as any)}>
        <TabsList>
          <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>
        
        <TabsContent value="kanban" className="mt-6">
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium">No tasks found</h3>
              <p className="text-muted-foreground mt-2">
                Get started by creating your first task.
              </p>
            </div>
          ) : (
            <>
              <KanbanBoard />
              
              {/* Pagination Controls for Kanban */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={10}
                onPageChange={setCurrentPage}
                itemName="tasks"
                className="mt-6"
              />
            </>
          )}
        </TabsContent>
        
        <TabsContent value="list" className="mt-6">
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium">No tasks found</h3>
              <p className="text-muted-foreground mt-2">
                Get started by creating your first task.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {tasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
              
              {/* Pagination Controls for List */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={10}
                onPageChange={setCurrentPage}
                itemName="tasks"
                className="mt-6"
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TasksPage;