import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Plus, Clock, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Pagination } from '../components/ui/pagination';
import { timeTrackingService } from '../services/timeTrackingService';
import { taskService } from '../services/taskService';
import { projectService } from '../services/projectService';
import type { TimeEntry, Task, Project } from '../types';
import { toast } from 'sonner';

const TimeTrackingPage: React.FC = () => {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [allTimeEntries, setAllTimeEntries] = useState<TimeEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Active timer state
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  // Filters
  const [dateFilter, setDateFilter] = useState('today');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog states
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isEditEntryOpen, setIsEditEntryOpen] = useState(false);
  const [isTimerDialogOpen, setIsTimerDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Form states
  const [manualEntryForm, setManualEntryForm] = useState({
    taskId: 0,
    projectId: 0,
    hours: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    billable: false
  });
  
  const [timerForm, setTimerForm] = useState({
    taskId: 0,
    projectId: 0,
    description: ''
  });
  
  const [editForm, setEditForm] = useState({
    taskId: 0,
    projectId: 0,
    hours: 0,
    description: '',
    date: '',
    billable: false
  });

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && activeTimer) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, activeTimer]);

  // Format timer display
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
      default:
        return { startDate: undefined, endDate: undefined };
    }
  };

  // Client-side filtering
  const applyFilters = (entries: TimeEntry[]) => {
    return entries.filter(entry => {
      const { startDate, endDate } = getDateRange(dateFilter);
      
      const matchesDate = !startDate || !endDate || 
        (entry.date >= startDate && entry.date <= endDate);
      
      const matchesProject = projectFilter === 'all' || 
        (entry.task?.projectId?.toString() === projectFilter);
      
      const matchesTask = taskFilter === 'all' || 
        (entry.taskId?.toString() === taskFilter);
      
      const matchesSearch = !searchTerm.trim() || 
        entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.task?.title?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesDate && matchesProject && matchesTask && matchesSearch;
    });
  };

  // Real-time filtering effect
  useEffect(() => {
    if (allTimeEntries.length > 0) {
      const filteredEntries = applyFilters(allTimeEntries);
      setTimeEntries(filteredEntries);
      setTotalItems(filteredEntries.length);
      setTotalPages(Math.ceil(filteredEntries.length / 10));
      if (currentPage > Math.ceil(filteredEntries.length / 10) && filteredEntries.length > 0) {
        setCurrentPage(1);
      }
    }
  }, [allTimeEntries, dateFilter, projectFilter, taskFilter, searchTerm, currentPage]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch time entries, tasks, and projects in parallel
      const [timeEntriesResponse, tasksResponse, projectsResponse, activeTimerResponse] = await Promise.all([
        timeTrackingService.getMyTimeEntries({ limit: 100 }),
        taskService.getTasks({ limit: 100 }),
        projectService.getProjects({ limit: 100 }),
        timeTrackingService.getActiveTimer().catch(() => null)
      ]);
      
      setAllTimeEntries(timeEntriesResponse.timeEntries);
      setTasks(tasksResponse.tasks);
      setProjects(projectsResponse.projects);
      
      if (activeTimerResponse) {
        setActiveTimer(activeTimerResponse);
        setIsTimerRunning(true);
        // Calculate elapsed time
        const startTime = new Date(activeTimerResponse.startTime);
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setTimerSeconds(elapsed);
      }
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch data');
      
      // Mock data for demo
      const mockTimeEntries: TimeEntry[] = [
        {
          id: 1,
          taskId: 1,
          userId: 1,
          hours: 2.5,
          description: 'Working on user authentication',
          date: new Date().toISOString().split('T')[0],
          createdAt: '2025-01-01T10:00:00Z',
          updatedAt: '2025-01-01T12:30:00Z',
          task: { id: 1, title: 'Implement login system', projectId: 1, description: 'User authentication system', status: 'in_progress' as const, priority: 'high' as const, createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z' }
        },
        {
          id: 2,
          taskId: 2,
          userId: 1,
          hours: 1.5,
          description: 'Bug fixes and testing',
          date: new Date().toISOString().split('T')[0],
          createdAt: '2025-01-01T14:00:00Z',
          updatedAt: '2025-01-01T15:30:00Z',
          task: { id: 2, title: 'Fix dashboard issues', projectId: 1, description: 'Dashboard bug fixes', status: 'todo' as const, priority: 'medium' as const, createdAt: '2025-01-01T14:00:00Z', updatedAt: '2025-01-01T14:00:00Z' }
        }
      ];
      
      setAllTimeEntries(mockTimeEntries);
      setTasks([
        { id: 1, title: 'Implement login system', projectId: 1, description: 'User authentication system', status: 'in_progress' as const, priority: 'high' as const, createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:00:00Z' },
        { id: 2, title: 'Fix dashboard issues', projectId: 1, description: 'Dashboard bug fixes', status: 'todo' as const, priority: 'medium' as const, createdAt: '2025-01-01T14:00:00Z', updatedAt: '2025-01-01T14:00:00Z' }
      ]);
      setProjects([
        { id: 1, name: 'Project Management Tool' }
      ] as Project[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Timer functions
  const startTimer = async () => {
    try {
      if (!timerForm.taskId && !timerForm.projectId) {
        toast.error('Please select a task or project');
        return;
      }
      
      const timer = await timeTrackingService.startTimer(
        timerForm.taskId || undefined,
        timerForm.projectId || undefined,
        timerForm.description
      );
      
      setActiveTimer(timer);
      setIsTimerRunning(true);
      setTimerSeconds(0);
      setIsTimerDialogOpen(false);
      setTimerForm({ taskId: 0, projectId: 0, description: '' });
      toast.success('Timer started');
    } catch (error: any) {
      toast.error(error.message || 'Failed to start timer');
    }
  };

  const stopTimer = async () => {
    try {
      await timeTrackingService.stopTimer();
      setActiveTimer(null);
      setIsTimerRunning(false);
      setTimerSeconds(0);
      toast.success('Timer stopped and time entry created');
      fetchData(); // Refresh data
    } catch (error: any) {
      toast.error(error.message || 'Failed to stop timer');
    }
  };

  const pauseTimer = async () => {
    try {
      await timeTrackingService.pauseTimer();
      setIsTimerRunning(false);
      toast.success('Timer paused');
    } catch (error: any) {
      toast.error(error.message || 'Failed to pause timer');
    }
  };

  const resumeTimer = async () => {
    try {
      await timeTrackingService.resumeTimer();
      setIsTimerRunning(true);
      toast.success('Timer resumed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resume timer');
    }
  };

  // Manual entry functions
  const createManualEntry = async () => {
    try {
      if (!manualEntryForm.hours || manualEntryForm.hours <= 0) {
        toast.error('Please enter valid hours');
        return;
      }
      
      if (!manualEntryForm.taskId && !manualEntryForm.projectId) {
        toast.error('Please select a task or project');
        return;
      }
      
      await timeTrackingService.createTimeEntry({
        taskId: manualEntryForm.taskId || undefined,
        projectId: manualEntryForm.projectId || undefined,
        hours: manualEntryForm.hours,
        description: manualEntryForm.description,
        date: manualEntryForm.date,
        billable: manualEntryForm.billable
      });
      
      setIsManualEntryOpen(false);
      setManualEntryForm({
        taskId: 0,
        projectId: 0,
        hours: 0,
        description: '',
        date: new Date().toISOString().split('T')[0],
        billable: false
      });
      toast.success('Time entry created');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create time entry');
    }
  };

  const updateTimeEntry = async () => {
    if (!editingEntry) return;
    
    try {
      await timeTrackingService.updateTimeEntry(editingEntry.id, {
        taskId: editForm.taskId || undefined,
        projectId: editForm.projectId || undefined,
        hours: editForm.hours,
        description: editForm.description,
        date: editForm.date,
        billable: editForm.billable
      });
      
      setIsEditEntryOpen(false);
      setEditingEntry(null);
      toast.success('Time entry updated');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update time entry');
    }
  };

  const deleteTimeEntry = async (id: number) => {
    try {
      await timeTrackingService.deleteTimeEntry(id);
      toast.success('Time entry deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete time entry');
    }
  };

  const openEditDialog = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditForm({
      taskId: entry.taskId || 0,
      projectId: entry.task?.projectId || 0,
      hours: entry.hours,
      description: entry.description || '',
      date: entry.date,
      billable: (entry as any).billable || false
    });
    setIsEditEntryOpen(true);
  };

  // Calculate statistics
  const todayEntries = allTimeEntries.filter(entry => 
    entry.date === new Date().toISOString().split('T')[0]
  );
  const totalHoursToday = todayEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const totalHoursWeek = allTimeEntries
    .filter(entry => {
      const { startDate } = getDateRange('thisWeek');
      return entry.date >= startDate!;
    })
    .reduce((sum, entry) => sum + entry.hours, 0);

  // Paginate entries for display
  const paginatedEntries = timeEntries.slice((currentPage - 1) * 10, currentPage * 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading time tracking data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Time Tracking</h1>
          <p className="text-muted-foreground">
            Track time spent on tasks and generate reports.
          </p>
        </div>
      </div>

      {/* Timer Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Active Timer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeTimer ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-mono font-bold text-primary mb-2">
                    {formatTime(timerSeconds)}
                  </div>
                  <p className="text-muted-foreground">
                    {activeTimer.description || 'Working on task'}
                  </p>
                  {activeTimer.task && (
                    <p className="text-sm text-muted-foreground">
                      Task: {activeTimer.task.title}
                    </p>
                  )}
                </div>
                <div className="flex justify-center gap-2">
                  {isTimerRunning ? (
                    <Button onClick={pauseTimer} variant="outline">
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  ) : (
                    <Button onClick={resumeTimer}>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  )}
                  <Button onClick={stopTimer} variant="destructive">
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No active timer</p>
                <Button onClick={() => setIsTimerDialogOpen(true)}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Timer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-2xl font-bold">{totalHoursToday.toFixed(1)}h</div>
              <p className="text-sm text-muted-foreground">Today</p>
            </div>
            <div>
              <div className="text-2xl font-bold">{totalHoursWeek.toFixed(1)}h</div>
              <p className="text-sm text-muted-foreground">This Week</p>
            </div>
            <div>
              <div className="text-2xl font-bold">{todayEntries.length}</div>
              <p className="text-sm text-muted-foreground">Entries Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search time entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="thisWeek">This Week</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by project" />
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
            <Select value={taskFilter} onValueChange={setTaskFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by task" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id.toString()}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setIsManualEntryOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </Button>
          </div>

          {/* Time Entries Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Task/Project</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {new Date(entry.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {entry.task?.title || 'Direct Project Work'}
                  </TableCell>
                  <TableCell>
                    {entry.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {entry.hours}h
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(entry)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteTimeEntry(entry.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {paginatedEntries.length === 0 && (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No time entries found for the selected criteria.</p>
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
          itemsPerPage={10}
          onPageChange={setCurrentPage}
          itemName="entries"
        />
      )}

      {/* Start Timer Dialog */}
      <Dialog open={isTimerDialogOpen} onOpenChange={setIsTimerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Timer</DialogTitle>
            <DialogDescription>
              Start tracking time for a task or project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="timerTask">Task</Label>
              <Select value={timerForm.taskId.toString()} onValueChange={(value) => setTimerForm({ ...timerForm, taskId: parseInt(value) })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a task (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No specific task</SelectItem>
                  {tasks.map((task) => (
                    <SelectItem key={task.id} value={task.id.toString()}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="timerProject">Project</Label>
              <Select value={timerForm.projectId.toString()} onValueChange={(value) => setTimerForm({ ...timerForm, projectId: parseInt(value) })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No specific project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="timerDescription">Description</Label>
              <Textarea
                id="timerDescription"
                value={timerForm.description}
                onChange={(e) => setTimerForm({ ...timerForm, description: e.target.value })}
                placeholder="What are you working on?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTimerDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={startTimer}>
              <Play className="h-4 w-4 mr-2" />
              Start Timer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Entry Dialog */}
      <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Time Entry</DialogTitle>
            <DialogDescription>
              Manually add a time entry for completed work.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="entryDate">Date</Label>
                <Input
                  id="entryDate"
                  type="date"
                  value={manualEntryForm.date}
                  onChange={(e) => setManualEntryForm({ ...manualEntryForm, date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="entryHours">Hours</Label>
                <Input
                  id="entryHours"
                  type="number"
                  step="0.25"
                  min="0"
                  value={manualEntryForm.hours}
                  onChange={(e) => setManualEntryForm({ ...manualEntryForm, hours: parseFloat(e.target.value) || 0 })}
                  placeholder="2.5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="entryTask">Task</Label>
              <Select value={manualEntryForm.taskId.toString()} onValueChange={(value) => setManualEntryForm({ ...manualEntryForm, taskId: parseInt(value) })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a task (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No specific task</SelectItem>
                  {tasks.map((task) => (
                    <SelectItem key={task.id} value={task.id.toString()}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="entryProject">Project</Label>
              <Select value={manualEntryForm.projectId.toString()} onValueChange={(value) => setManualEntryForm({ ...manualEntryForm, projectId: parseInt(value) })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No specific project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="entryDescription">Description</Label>
              <Textarea
                id="entryDescription"
                value={manualEntryForm.description}
                onChange={(e) => setManualEntryForm({ ...manualEntryForm, description: e.target.value })}
                placeholder="Describe the work done..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManualEntryOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createManualEntry}>
              Add Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog open={isEditEntryOpen} onOpenChange={setIsEditEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>
              Update the time entry details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editDate">Date</Label>
                <Input
                  id="editDate"
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editHours">Hours</Label>
                <Input
                  id="editHours"
                  type="number"
                  step="0.25"
                  min="0"
                  value={editForm.hours}
                  onChange={(e) => setEditForm({ ...editForm, hours: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="editTask">Task</Label>
              <Select value={editForm.taskId.toString()} onValueChange={(value) => setEditForm({ ...editForm, taskId: parseInt(value) })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a task (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No specific task</SelectItem>
                  {tasks.map((task) => (
                    <SelectItem key={task.id} value={task.id.toString()}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editProject">Project</Label>
              <Select value={editForm.projectId.toString()} onValueChange={(value) => setEditForm({ ...editForm, projectId: parseInt(value) })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No specific project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Describe the work done..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditEntryOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateTimeEntry}>
              Update Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimeTrackingPage;