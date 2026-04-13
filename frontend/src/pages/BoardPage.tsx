import React, { useState, useCallback } from 'react';
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
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { issueService, type Issue, type BoardColumn } from '../services/issueService';

// ── helpers ──────────────────────────────────────────────────────────────────

const priorityColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

const typeColor: Record<string, string> = {
  bug: 'bg-red-50 text-red-700 border-red-200',
  epic: 'bg-purple-50 text-purple-700 border-purple-200',
  task: 'bg-blue-50 text-blue-700 border-blue-200',
};

// ── IssueCard ─────────────────────────────────────────────────────────────────

interface IssueCardProps {
  issue: Issue;
  overlay?: boolean;
}

const IssueCard: React.FC<IssueCardProps> = ({ issue, overlay }) => {
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
      className={`bg-white rounded-lg border p-3 shadow-sm cursor-grab active:cursor-grabbing select-none ${overlay ? 'shadow-lg rotate-2' : 'hover:shadow-md'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-muted-foreground font-mono">{issue.issueKey}</span>
        <Badge variant="outline" className={`text-xs ${typeColor[issue.issueType]}`}>
          {issue.issueType}
        </Badge>
      </div>
      <p className="text-sm font-medium line-clamp-2 mb-2">{issue.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={`text-xs ${priorityColor[issue.priority]}`}>{issue.priority}</Badge>
        {issue.storyPoints != null && (
          <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{issue.storyPoints} pts</span>
        )}
        {issue.assignee && (
          <span className="text-xs text-muted-foreground ml-auto">
            {issue.assignee.firstName[0]}{issue.assignee.lastName[0]}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Column ────────────────────────────────────────────────────────────────────

interface ColumnProps {
  column: BoardColumn;
  filteredIssues: Issue[];
}

const Column: React.FC<ColumnProps> = ({ column, filteredIssues }) => {
  const categoryColor: Record<string, string> = {
    todo: 'border-t-gray-400',
    in_progress: 'border-t-blue-500',
    done: 'border-t-green-500',
  };

  return (
    <div className={`flex flex-col bg-gray-50 rounded-lg border-t-4 ${categoryColor[column.category]} min-w-[260px] w-[260px] flex-shrink-0`}>
      <div className="flex items-center justify-between px-3 py-2 border-b bg-white rounded-t-lg">
        <span className="font-semibold text-sm">{column.state}</span>
        <Badge variant="outline" className="text-xs">{filteredIssues.length}</Badge>
      </div>
      <SortableContext items={filteredIssues.map(i => i._id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 min-h-[120px] flex-1">
          {filteredIssues.map(issue => (
            <IssueCard key={issue._id} issue={issue} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

// ── BoardPage ─────────────────────────────────────────────────────────────────

const BoardPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterLabel, setFilterLabel] = useState('all');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: columns = [], isLoading } = useQuery({
    queryKey: ['board', projectId],
    queryFn: () => issueService.getBoard(projectId!),
    enabled: !!projectId,
  });

  const reorderMutation = useMutation({
    mutationFn: ({ columnState, ids }: { columnState: string; ids: string[] }) =>
      issueService.reorderIssues(columnState, ids),
    onError: () => {
      toast.error('Failed to reorder issues');
      queryClient.invalidateQueries({ queryKey: ['board', projectId] });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: ({ issueId, targetState }: { issueId: string; targetState: string }) =>
      issueService.transitionIssue(issueId, targetState),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board', projectId] }),
    onError: (err: any) => toast.error(err.message || 'Transition not permitted'),
  });

  // Collect all unique assignees and labels for filter dropdowns
  const allIssues = columns.flatMap(c => c.issues);
  const assignees = Array.from(new Map(allIssues.filter(i => i.assignee).map(i => [i.assignee!._id, i.assignee!])).values());
  const labels = Array.from(new Set(allIssues.flatMap(i => i.labels ?? [])));

  const applyFilters = useCallback((issues: Issue[]) => {
    return issues.filter(issue => {
      if (filterAssignee !== 'all' && issue.assignedTo !== filterAssignee) return false;
      if (filterPriority !== 'all' && issue.priority !== filterPriority) return false;
      if (filterType !== 'all' && issue.issueType !== filterType) return false;
      if (filterLabel !== 'all' && !(issue.labels ?? []).includes(filterLabel)) return false;
      return true;
    });
  }, [filterAssignee, filterPriority, filterType, filterLabel]);

  const findColumnForIssue = (issueId: string) =>
    columns.find(c => c.issues.some(i => i._id === issueId));

  const handleDragStart = (event: DragStartEvent) => {
    const issue = allIssues.find(i => i._id === event.active.id);
    setActiveIssue(issue ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveIssue(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const sourceCol = findColumnForIssue(activeId);
    // over could be a column id (state name) or an issue id
    const targetCol = columns.find(c => c.state === overId) ?? findColumnForIssue(overId);

    if (!sourceCol || !targetCol) return;

    if (sourceCol.state !== targetCol.state) {
      // Cross-column drop → transition
      transitionMutation.mutate({ issueId: activeId, targetState: targetCol.state });
    } else {
      // Same-column reorder
      const ids = sourceCol.issues.map(i => i._id);
      const oldIdx = ids.indexOf(activeId);
      const newIdx = overId === sourceCol.state ? ids.length - 1 : ids.indexOf(overId);
      if (oldIdx === newIdx) return;
      const reordered = [...ids];
      reordered.splice(oldIdx, 1);
      reordered.splice(newIdx, 0, activeId);
      // Optimistic update
      queryClient.setQueryData<BoardColumn[]>(['board', projectId], prev =>
        prev?.map(c => c.state === sourceCol.state ? { ...c, issues: reordered.map(id => c.issues.find(i => i._id === id)!) } : c) ?? []
      );
      reorderMutation.mutate({ columnState: sourceCol.state, ids: reordered });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const sourceCol = findColumnForIssue(activeId);
    const targetCol = columns.find(c => c.state === overId) ?? findColumnForIssue(overId);
    if (!sourceCol || !targetCol || sourceCol.state === targetCol.state) return;

    // Optimistic cross-column move for visual feedback
    queryClient.setQueryData<BoardColumn[]>(['board', projectId], prev => {
      if (!prev) return prev;
      const issue = sourceCol.issues.find(i => i._id === activeId)!;
      return prev.map(c => {
        if (c.state === sourceCol.state) return { ...c, issues: c.issues.filter(i => i._id !== activeId) };
        if (c.state === targetCol.state) return { ...c, issues: [...c.issues, issue] };
        return c;
      });
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading board...</div>;
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Filter:</span>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            {assignees.map(a => (
              <SelectItem key={a._id} value={a._id}>{a.firstName} {a.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="epic">Epic</SelectItem>
          </SelectContent>
        </Select>
        {labels.length > 0 && (
          <Select value={filterLabel} onValueChange={setFilterLabel}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Label" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Labels</SelectItem>
              {labels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {columns.map(col => (
            <Column key={col.state} column={col} filteredIssues={applyFilters(col.issues)} />
          ))}
        </div>
        <DragOverlay>
          {activeIssue && <IssueCard issue={activeIssue} overlay />}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default BoardPage;
