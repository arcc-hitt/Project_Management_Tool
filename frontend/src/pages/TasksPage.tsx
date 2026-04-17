import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Bug, Layers, CheckSquare, List, LayoutGrid,
  User, Calendar, Clock, MoreHorizontal, ArrowRight, Tag,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { issueService, type Issue } from '../services/issueService';
import { projectService } from '../services/projectService';
import { apiClient } from '../services/api';
import { toast } from 'sonner';

// ── helpers ───────────────────────────────────────────────────────────────────

const priorityColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200',
};

const statusColor: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-800 border-gray-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  in_review: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  done: 'bg-green-100 text-green-800 border-green-200',
};

const getStatusColor = (status: string) => {
  const key = status.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  return statusColor[key] ?? 'bg-gray-100 text-gray-800 border-gray-200';
};

const formatStatus = (status: string) =>
  status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const IssueTypeIcon: React.FC<{ type: string; className?: string }> = ({ type, className = 'h-4 w-4' }) => {
  switch (type) {
    case 'bug':  return <Bug className={`${className} text-red-500`} />;
    case 'epic': return <Layers className={`${className} text-purple-500`} />;
    default:     return <CheckSquare className={`${className} text-blue-500`} />;
  }
};

const KANBAN_STATUSES = ['To Do', 'In Progress', 'In Review', 'Done'];
const STATUS_TRANSITIONS = ['todo', 'in_progress', 'in_review', 'done'];
const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

// ── IssueCard ─────────────────────────────────────────────────────────────────

interface IssueCardProps {
  issue: Issue;
  onClick: () => void;
  onStatusChange: (issueId: string, newStatus: string) => void;
}

const IssueCard: React.FC<IssueCardProps> = ({ issue, onClick, onStatusChange }) => {
  const issueId = issue._id ?? (issue as any).id;
  const isOverdue = issue.dueDate && new Date(issue.dueDate) < new Date() && issue.status !== 'done';

  return (
    <Card className="hover:shadow-md transition-all duration-200 cursor-pointer group border border-border">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0" onClick={onClick}>
            <IssueTypeIcon type={issue.issueType} className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs font-mono text-muted-foreground shrink-0">{issue.issueKey}</span>
          </div>
          {/* Status dropdown — stops propagation so clicking it doesn't navigate */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={e => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                className="text-xs font-medium text-muted-foreground cursor-default"
                disabled
              >
                Move to…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {STATUS_TRANSITIONS.map(s => (
                <DropdownMenuItem
                  key={s}
                  className="text-xs"
                  onClick={e => {
                    e.stopPropagation();
                    onStatusChange(issueId, s);
                  }}
                >
                  <ArrowRight className="h-3 w-3 mr-2 text-muted-foreground" />
                  {STATUS_LABELS[s]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs"
                onClick={e => { e.stopPropagation(); onClick(); }}
              >
                Open issue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CardTitle
          className="text-sm font-semibold leading-snug line-clamp-2 mt-1 cursor-pointer hover:text-primary transition-colors"
          onClick={onClick}
        >
          {issue.title}
        </CardTitle>

        {issue.description && (
          <CardDescription className="text-xs line-clamp-2 mt-0.5">
            {issue.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="px-4 pb-3 space-y-2.5">
        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={`text-xs border ${priorityColor[issue.priority] ?? ''}`}>
            {issue.priority}
          </Badge>
          <Badge className={`text-xs border ${getStatusColor(issue.status)}`}>
            {formatStatus(issue.status)}
          </Badge>
          {issue.issueType === 'bug' && issue.bugSeverity && (
            <Badge variant="outline" className="text-xs text-red-600 border-red-200">
              {issue.bugSeverity}
            </Badge>
          )}
          {issue.storyPoints != null && (
            <Badge variant="secondary" className="text-xs">
              {issue.storyPoints} pts
            </Badge>
          )}
          {(issue.labels ?? []).slice(0, 2).map(l => (
            <Badge key={l} variant="outline" className="text-xs gap-1">
              <Tag className="h-2.5 w-2.5" />{l}
            </Badge>
          ))}
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {issue.assignee && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {issue.assignee.firstName} {issue.assignee.lastName}
              </span>
            )}
            {issue.dueDate && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
                <Calendar className="h-3 w-3" />
                {new Date(issue.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
          {(issue as any).estimatedHours != null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {(issue as any).estimatedHours}h
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ── CreateIssueDialog ─────────────────────────────────────────────────────────

interface CreateIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const CreateIssueDialog: React.FC<CreateIssueDialogProps> = ({ open, onOpenChange, onCreated }) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    projectId: '',
    issueType: 'task' as 'task' | 'bug' | 'epic',
    priority: 'medium' as Issue['priority'],
    storyPoints: '',
    bugSeverity: 'medium' as Issue['bugSeverity'],
    dueDate: '',
    labels: '',
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectService.getProjects({ limit: 100 }),
  });
  const projects = projectsData?.projects ?? [];

  const createMutation = useMutation({
    mutationFn: () => {
      const payload: Partial<Issue> = {
        title: form.title,
        description: form.description || undefined,
        projectId: form.projectId,
        issueType: form.issueType,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        labels: form.labels ? form.labels.split(',').map(l => l.trim()).filter(Boolean) : undefined,
      };
      if (form.issueType === 'task' || form.issueType === 'epic') {
        payload.storyPoints = form.storyPoints ? Number(form.storyPoints) : undefined;
      }
      if (form.issueType === 'bug') {
        payload.bugSeverity = form.bugSeverity;
      }
      return issueService.createIssue(payload);
    },
    onSuccess: () => {
      toast.success('Issue created');
      onOpenChange(false);
      setForm({
        title: '',
        description: '',
        projectId: '',
        issueType: 'task',
        priority: 'medium',
        storyPoints: '',
        bugSeverity: 'medium',
        dueDate: '',
        labels: '',
      });
      onCreated();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create issue'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Issue</DialogTitle>
          <DialogDescription>Add a new issue to track work.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="ci-title">Title *</Label>
            <Input
              id="ci-title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Issue title"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ci-desc">Description</Label>
            <Textarea
              id="ci-desc"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe the issue…"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Project *</Label>
              <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p: any) => (
                    <SelectItem key={p._id ?? p.id} value={p._id ?? String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Issue Type</Label>
              <Select value={form.issueType} onValueChange={v => setForm(f => ({ ...f, issueType: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="epic">Epic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.issueType === 'task' || form.issueType === 'epic') && (
              <div className="space-y-1">
                <Label htmlFor="ci-sp">Story Points</Label>
                <Input
                  id="ci-sp"
                  type="number"
                  min={0}
                  value={form.storyPoints}
                  onChange={e => setForm(f => ({ ...f, storyPoints: e.target.value }))}
                  placeholder="0"
                />
              </div>
            )}
            {form.issueType === 'bug' && (
              <div className="space-y-1">
                <Label>Bug Severity</Label>
                <Select value={form.bugSeverity} onValueChange={v => setForm(f => ({ ...f, bugSeverity: v as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ci-due">Due Date</Label>
              <Input
                id="ci-due"
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ci-labels">Labels</Label>
              <Input
                id="ci-labels"
                value={form.labels}
                onChange={e => setForm(f => ({ ...f, labels: e.target.value }))}
                placeholder="bug, frontend, …"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!form.title.trim() || !form.projectId || createMutation.isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── IssuesPage ────────────────────────────────────────────────────────────────

const IssuesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  // Fetch all issues
  const { data: issuesRaw = [], isLoading } = useQuery({
    queryKey: ['issues-global'],
    queryFn: async () => {
      const response = await apiClient.get<{ issues: Issue[]; total: number }>('/search/issues?limit=200');
      return response.data?.issues ?? [];
    },
  });

  // Quick status update mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      issueService.updateIssue(id, { status }),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['issues-global'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update status'),
  });

  const handleStatusChange = (issueId: string, newStatus: string) => {
    statusMutation.mutate({ id: issueId, status: newStatus });
  };

  const issues = issuesRaw.filter(issue => {
    const matchesSearch =
      !searchTerm.trim() ||
      issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.issueKey?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || issue.priority === priorityFilter;
    const matchesType = typeFilter === 'all' || issue.issueType === typeFilter;
    const matchesStatus = statusFilter === 'all' ||
      issue.status.toLowerCase().replace(/\s+/g, '_') === statusFilter;
    return matchesSearch && matchesPriority && matchesType && matchesStatus;
  });

  const handleCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['issues-global'] });
  };

  // ── Kanban view ─────────────────────────────────────────────────────────────

  const KanbanBoard: React.FC = () => {
    const normalise = (s: string) => s.toLowerCase().replace(/_/g, ' ');
    const columns = [
      { label: 'To Do',       match: (s: string) => ['to do', 'todo', 'open', 'backlog'].includes(normalise(s)) },
      { label: 'In Progress', match: (s: string) => ['in progress', 'in_progress'].includes(normalise(s)) },
      { label: 'In Review',   match: (s: string) => ['in review', 'in_review', 'review'].includes(normalise(s)) },
      { label: 'Done',        match: (s: string) => ['done', 'closed', 'resolved', 'complete', 'completed'].includes(normalise(s)) },
    ];

    const columnColors: Record<string, string> = {
      'To Do': 'border-t-gray-400',
      'In Progress': 'border-t-blue-500',
      'In Review': 'border-t-yellow-500',
      'Done': 'border-t-green-500',
    };

    const buckets: Record<string, Issue[]> = { 'To Do': [], 'In Progress': [], 'In Review': [], 'Done': [] };
    for (const issue of issues) {
      let placed = false;
      for (const col of columns) {
        if (col.match(issue.status)) { buckets[col.label].push(issue); placed = true; break; }
      }
      if (!placed) buckets['To Do'].push(issue);
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KANBAN_STATUSES.map(col => (
          <div key={col} className={`flex flex-col rounded-lg border border-border border-t-4 ${columnColors[col]} bg-muted/30 p-3 space-y-3 min-h-[200px]`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col}</h3>
              <Badge variant="secondary" className="text-xs h-5 px-1.5">{buckets[col].length}</Badge>
            </div>
            <div className="space-y-2 flex-1">
              {buckets[col].map(issue => (
                <IssueCard
                  key={issue._id ?? (issue as any).id}
                  issue={issue}
                  onClick={() => navigate(`/issues/${issue._id ?? (issue as any).id}`)}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {buckets[col].length === 0 && (
                <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/50 border-2 border-dashed border-border rounded-md">
                  No issues
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── List view ───────────────────────────────────────────────────────────────

  const ListView: React.FC = () => (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-4 py-2.5 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span className="w-24">Key</span>
        <span>Title</span>
        <span className="w-24 text-center">Type</span>
        <span className="w-24 text-center">Priority</span>
        <span className="w-28 text-center">Status</span>
        <span className="w-32">Assignee</span>
      </div>
      {issues.map((issue, idx) => {
        const issueId = issue._id ?? (issue as any).id;
        return (
          <div
            key={issueId}
            className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-4 py-3 items-center hover:bg-muted/40 transition-colors cursor-pointer group ${idx !== issues.length - 1 ? 'border-b border-border' : ''}`}
            onClick={() => navigate(`/issues/${issueId}`)}
          >
            {/* Key + type icon */}
            <div className="flex items-center gap-1.5 w-24">
              <IssueTypeIcon type={issue.issueType} className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs font-mono text-muted-foreground truncate">{issue.issueKey}</span>
            </div>

            {/* Title + description */}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{issue.title}</p>
              {issue.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{issue.description}</p>
              )}
              {(issue.labels ?? []).length > 0 && (
                <div className="flex gap-1 mt-1">
                  {(issue.labels ?? []).slice(0, 3).map(l => (
                    <Badge key={l} variant="outline" className="text-xs h-4 px-1">{l}</Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Type badge */}
            <div className="w-24 flex justify-center">
              <Badge variant="outline" className="text-xs capitalize">{issue.issueType}</Badge>
            </div>

            {/* Priority */}
            <div className="w-24 flex justify-center">
              <Badge className={`text-xs border ${priorityColor[issue.priority] ?? ''}`}>{issue.priority}</Badge>
            </div>

            {/* Status with quick-change dropdown */}
            <div className="w-28 flex justify-center" onClick={e => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusColor(issue.status)} hover:opacity-80 transition-opacity`}>
                    {formatStatus(issue.status)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-40">
                  {STATUS_TRANSITIONS.map(s => (
                    <DropdownMenuItem
                      key={s}
                      className="text-xs"
                      onClick={() => handleStatusChange(issueId, s)}
                    >
                      <ArrowRight className="h-3 w-3 mr-2 text-muted-foreground" />
                      {STATUS_LABELS[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Assignee */}
            <div className="w-32">
              {issue.assignee ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{issue.assignee.firstName} {issue.assignee.lastName}</span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/40">Unassigned</span>
              )}
            </div>
          </div>
        );
      })}
      {issues.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No issues match your filters</p>
        </div>
      )}
    </div>
  );

  // ── Stats bar ───────────────────────────────────────────────────────────────

  const totalByType = {
    task: issuesRaw.filter(i => i.issueType === 'task').length,
    bug: issuesRaw.filter(i => i.issueType === 'bug').length,
    epic: issuesRaw.filter(i => i.issueType === 'epic').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm">Loading issues…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Issues</h1>
          <p className="text-muted-foreground">Track bugs, tasks, and epics across all projects</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Issue
        </Button>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{issuesRaw.length} total</span>
        <span className="flex items-center gap-1">
          <CheckSquare className="h-3.5 w-3.5 text-blue-500" /> {totalByType.task} tasks
        </span>
        <span className="flex items-center gap-1">
          <Bug className="h-3.5 w-3.5 text-red-500" /> {totalByType.bug} bugs
        </span>
        <span className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5 text-purple-500" /> {totalByType.epic} epics
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or key…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="epic">Epic</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        {/* View toggle */}
        <div className="flex gap-1 border border-border rounded-md p-0.5">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode('kanban')}
            title="Kanban view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'kanban' ? <KanbanBoard /> : <ListView />}

      <CreateIssueDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
};

export default IssuesPage;
