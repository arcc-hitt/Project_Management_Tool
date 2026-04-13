import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { Play, CheckSquare, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { issueService, sprintService, type Issue, type Sprint } from '../services/issueService';

// ── helpers ───────────────────────────────────────────────────────────────────

const priorityColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

const sprintStateColor: Record<string, string> = {
  created: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-700',
  closed: 'bg-green-100 text-green-700',
};

// ── DraggableIssueRow ─────────────────────────────────────────────────────────

const DraggableIssueRow: React.FC<{ issue: Issue; overlay?: boolean }> = ({ issue, overlay }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue._id,
    data: { issue },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={overlay ? undefined : style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-3 px-3 py-2 bg-white border rounded cursor-grab active:cursor-grabbing select-none text-sm ${overlay ? 'shadow-lg' : 'hover:bg-gray-50'}`}
    >
      <span className="text-xs font-mono text-muted-foreground w-20 shrink-0">{issue.issueKey}</span>
      <span className="flex-1 truncate">{issue.title}</span>
      <Badge variant="outline" className="text-xs shrink-0">{issue.issueType}</Badge>
      <Badge className={`text-xs shrink-0 ${priorityColor[issue.priority]}`}>{issue.priority}</Badge>
      {issue.storyPoints != null && (
        <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5 shrink-0">{issue.storyPoints}p</span>
      )}
    </div>
  );
};

// ── SprintSection ─────────────────────────────────────────────────────────────

interface SprintSectionProps {
  sprint: Sprint;
  issues: Issue[];
  onStart: (id: string) => void;
  onClose: (id: string) => void;
  isStarting: boolean;
  isClosing: boolean;
}

const SprintSection: React.FC<SprintSectionProps> = ({ sprint, issues, onStart, onClose, isStarting, isClosing }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b">
        <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span className="font-semibold text-sm flex-1">{sprint.name}</span>
        <Badge className={`text-xs ${sprintStateColor[sprint.state]}`}>{sprint.state}</Badge>
        <span className="text-xs text-muted-foreground">{issues.length} issues</span>
        {sprint.state === 'created' && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onStart(sprint._id)} disabled={isStarting}>
            <Play className="h-3 w-3 mr-1" /> Start Sprint
          </Button>
        )}
        {sprint.state === 'active' && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onClose(sprint._id)} disabled={isClosing}>
            <CheckSquare className="h-3 w-3 mr-1" /> Close Sprint
          </Button>
        )}
      </div>
      {expanded && (
        <SortableContext items={issues.map(i => i._id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1 p-2 min-h-[60px]">
            {issues.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No issues in this sprint</p>
            ) : (
              issues.map(issue => <DraggableIssueRow key={issue._id} issue={issue} />)
            )}
          </div>
        </SortableContext>
      )}
    </div>
  );
};

// ── BacklogPage ───────────────────────────────────────────────────────────────

const BacklogPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [createSprintOpen, setCreateSprintOpen] = useState(false);
  const [sprintForm, setSprintForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });

  const { data: backlog = [], isLoading: backlogLoading } = useQuery({
    queryKey: ['backlog', projectId],
    queryFn: () => issueService.getBacklog(projectId!),
    enabled: !!projectId,
  });

  const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintService.getSprints(projectId!),
    enabled: !!projectId,
  });

  const createSprintMutation = useMutation({
    mutationFn: (data: typeof sprintForm) => sprintService.createSprint(projectId!, data),
    onSuccess: () => {
      toast.success('Sprint created');
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      setCreateSprintOpen(false);
      setSprintForm({ name: '', goal: '', startDate: '', endDate: '' });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create sprint'),
  });

  const startSprintMutation = useMutation({
    mutationFn: sprintService.startSprint,
    onSuccess: () => {
      toast.success('Sprint started');
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to start sprint'),
  });

  const closeSprintMutation = useMutation({
    mutationFn: sprintService.closeSprint,
    onSuccess: () => {
      toast.success('Sprint closed');
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlog', projectId] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to close sprint'),
  });

  const addToSprintMutation = useMutation({
    mutationFn: ({ sprintId, issueId }: { sprintId: string; issueId: string }) =>
      sprintService.addIssueToSprint(sprintId, issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlog', projectId] });
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to move issue'),
  });

  // Build a map of sprintId → issues (from board data or sprint issues endpoint)
  // For now we derive sprint issues from the issue's sprintId field
  const sprintIssuesMap: Record<string, Issue[]> = {};
  // We'd need a separate endpoint; for now show empty (sprint issues come from board)

  const handleDragStart = (event: DragStartEvent) => {
    const issue = backlog.find(i => i._id === event.active.id);
    setActiveIssue(issue ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveIssue(null);
    const { active, over } = event;
    if (!over) return;
    const issueId = active.id as string;
    const overId = over.id as string;
    // If dropped over a sprint section (sprint._id)
    const targetSprint = sprints.find(s => s._id === overId && s.state !== 'closed');
    if (targetSprint) {
      addToSprintMutation.mutate({ sprintId: targetSprint._id, issueId });
    }
  };

  const isLoading = backlogLoading || sprintsLoading;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading backlog...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Backlog</h1>
          <p className="text-sm text-muted-foreground">Plan sprints and manage your backlog</p>
        </div>
        <Button size="sm" onClick={() => setCreateSprintOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Create Sprint
        </Button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-4">
          {/* Sprint swimlanes */}
          {sprints.filter(s => s.state !== 'closed').map(sprint => (
            <SprintSection
              key={sprint._id}
              sprint={sprint}
              issues={sprintIssuesMap[sprint._id] ?? []}
              onStart={startSprintMutation.mutate}
              onClose={closeSprintMutation.mutate}
              isStarting={startSprintMutation.isPending}
              isClosing={closeSprintMutation.isPending}
            />
          ))}

          {/* Backlog section */}
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b">
              <span className="font-semibold text-sm flex-1">Backlog</span>
              <span className="text-xs text-muted-foreground">{backlog.length} issues</span>
            </div>
            <SortableContext items={backlog.map(i => i._id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1 p-2 min-h-[80px]">
                {backlog.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Backlog is empty</p>
                ) : (
                  backlog.map(issue => <DraggableIssueRow key={issue._id} issue={issue} />)
                )}
              </div>
            </SortableContext>
          </div>
        </div>

        <DragOverlay>
          {activeIssue && <DraggableIssueRow issue={activeIssue} overlay />}
        </DragOverlay>
      </DndContext>

      {/* Create Sprint Dialog */}
      <Dialog open={createSprintOpen} onOpenChange={setCreateSprintOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="sprint-name">Name *</Label>
              <Input
                id="sprint-name"
                value={sprintForm.name}
                onChange={e => setSprintForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Sprint 1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sprint-goal">Goal</Label>
              <Input
                id="sprint-goal"
                value={sprintForm.goal}
                onChange={e => setSprintForm(f => ({ ...f, goal: e.target.value }))}
                placeholder="Sprint goal (optional)"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sprint-start">Start Date</Label>
                <Input id="sprint-start" type="date" value={sprintForm.startDate} onChange={e => setSprintForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sprint-end">End Date</Label>
                <Input id="sprint-end" type="date" value={sprintForm.endDate} onChange={e => setSprintForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSprintOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createSprintMutation.mutate(sprintForm)}
              disabled={!sprintForm.name.trim() || createSprintMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BacklogPage;
