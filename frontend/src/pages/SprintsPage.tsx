import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Play, CheckSquare, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { sprintService, type Sprint } from '../services/issueService';

const sprintStateColor: Record<string, string> = {
  created: 'bg-gray-100 text-gray-700 border-gray-200',
  active: 'bg-blue-100 text-blue-700 border-blue-200',
  closed: 'bg-green-100 text-green-700 border-green-200',
};

const SprintsPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });

  const { data: sprints = [], isLoading } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintService.getSprints(projectId!),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: () => sprintService.createSprint(projectId!, form),
    onSuccess: () => {
      toast.success('Sprint created');
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      setCreateOpen(false);
      setForm({ name: '', goal: '', startDate: '', endDate: '' });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create sprint'),
  });

  const startMutation = useMutation({
    mutationFn: sprintService.startSprint,
    onSuccess: () => {
      toast.success('Sprint started');
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to start sprint'),
  });

  const closeMutation = useMutation({
    mutationFn: sprintService.closeSprint,
    onSuccess: () => {
      toast.success('Sprint closed');
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to close sprint'),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading sprints...</div>;
  }

  const activeSprints = sprints.filter(s => s.state === 'active');
  const createdSprints = sprints.filter(s => s.state === 'created');
  const closedSprints = sprints.filter(s => s.state === 'closed');

  const SprintCard: React.FC<{ sprint: Sprint }> = ({ sprint }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{sprint.name}</CardTitle>
          <Badge className={`text-xs shrink-0 ${sprintStateColor[sprint.state]}`}>{sprint.state}</Badge>
        </div>
        {sprint.goal && <p className="text-sm text-muted-foreground">{sprint.goal}</p>}
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {(sprint.startDate || sprint.endDate) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {sprint.startDate ? new Date(sprint.startDate).toLocaleDateString() : '—'}
              {' → '}
              {sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : '—'}
            </span>
          </div>
        )}
        {sprint.state === 'closed' && (
          <div className="flex gap-4 text-sm">
            <span className="text-muted-foreground">
              Completed: <strong>{sprint.completedIssueCount ?? 0}</strong> issues
            </span>
            <span className="text-muted-foreground">
              Story points: <strong>{sprint.completedStoryPoints ?? 0}</strong>
            </span>
          </div>
        )}
        <div className="flex gap-2">
          {sprint.state === 'created' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => startMutation.mutate(sprint._id)}
              disabled={startMutation.isPending || activeSprints.length > 0}
            >
              <Play className="h-3 w-3 mr-1" /> Start Sprint
            </Button>
          )}
          {sprint.state === 'active' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => closeMutation.mutate(sprint._id)}
              disabled={closeMutation.isPending}
            >
              <CheckSquare className="h-3 w-3 mr-1" /> Close Sprint
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sprints</h1>
          <p className="text-sm text-muted-foreground">Manage sprint lifecycle for this project</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Sprint
        </Button>
      </div>

      {sprints.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No sprints yet. Create your first sprint to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeSprints.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Active</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeSprints.map(s => <SprintCard key={s._id} sprint={s} />)}
              </div>
            </section>
          )}
          {createdSprints.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Upcoming</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {createdSprints.map(s => <SprintCard key={s._id} sprint={s} />)}
              </div>
            </section>
          )}
          {closedSprints.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Closed</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {closedSprints.map(s => <SprintCard key={s._id} sprint={s} />)}
              </div>
            </section>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Sprint 1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal">Goal</Label>
              <Input
                id="goal"
                value={form.goal}
                onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                placeholder="What do you want to achieve?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.name.trim() || createMutation.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SprintsPage;
