import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Filter,
  BookmarkPlus,
  Trash2,
  Play,
  ChevronLeft,
  ChevronRight,
  X,
  Bug,
  Layers,
  CheckSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { apiClient } from '../services/api';
import { projectService } from '../services/projectService';
import type { Issue } from '../services/issueService';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilterCriteria {
  query?: string;
  issueType?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  projectId?: string;
  sprintId?: string;
  label?: string[];
  componentId?: string;
  bugSeverity?: string;
  versionId?: string;
  epicId?: string;
  storyPointsMin?: number;
  storyPointsMax?: number;
  createdAtFrom?: string;
  createdAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

interface SavedFilter {
  _id: string;
  name: string;
  criteria: FilterCriteria;
  createdAt: string;
}

interface SearchResponse {
  issues: Issue[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Service helpers ──────────────────────────────────────────────────────────

const filterService = {
  async searchIssues(criteria: FilterCriteria, page: number, limit: number): Promise<SearchResponse> {
    const params = new URLSearchParams();
    if (criteria.query) params.set('q', criteria.query);
    if (criteria.issueType) params.set('issueType', criteria.issueType);
    if (criteria.status) params.set('status', criteria.status);
    if (criteria.priority) params.set('priority', criteria.priority);
    if (criteria.assigneeId) params.set('assigneeId', criteria.assigneeId);
    if (criteria.projectId) params.set('projectId', criteria.projectId);
    if (criteria.sprintId) params.set('sprintId', criteria.sprintId);
    if (criteria.componentId) params.set('componentId', criteria.componentId);
    if (criteria.bugSeverity) params.set('bugSeverity', criteria.bugSeverity);
    if (criteria.versionId) params.set('versionId', criteria.versionId);
    if (criteria.epicId) params.set('epicId', criteria.epicId);
    if (criteria.label?.length) params.set('label', criteria.label.join(','));
    if (criteria.storyPointsMin != null) params.set('storyPointsMin', String(criteria.storyPointsMin));
    if (criteria.storyPointsMax != null) params.set('storyPointsMax', String(criteria.storyPointsMax));
    if (criteria.createdAtFrom) params.set('createdAtFrom', criteria.createdAtFrom);
    if (criteria.createdAtTo) params.set('createdAtTo', criteria.createdAtTo);
    if (criteria.updatedAtFrom) params.set('updatedAtFrom', criteria.updatedAtFrom);
    if (criteria.updatedAtTo) params.set('updatedAtTo', criteria.updatedAtTo);
    if (criteria.dueDateFrom) params.set('dueDateFrom', criteria.dueDateFrom);
    if (criteria.dueDateTo) params.set('dueDateTo', criteria.dueDateTo);
    params.set('page', String(page));
    params.set('limit', String(limit));

    const response = await apiClient.get<SearchResponse>(`/search/issues?${params.toString()}`);
    if (!response.success || !response.data) throw new Error(response.message || 'Search failed');
    return response.data;
  },

  async getSavedFilters(): Promise<SavedFilter[]> {
    const response = await apiClient.get<SavedFilter[]>('/filters');
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to load filters');
    return response.data;
  },

  async saveFilter(name: string, criteria: FilterCriteria): Promise<SavedFilter> {
    const response = await apiClient.post<SavedFilter>('/filters', { name, criteria });
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to save filter');
    return response.data;
  },

  async runFilter(filterId: string): Promise<SearchResponse> {
    const response = await apiClient.get<SearchResponse>(`/filters/${filterId}/run`);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to run filter');
    return response.data;
  },

  async deleteFilter(filterId: string): Promise<void> {
    const response = await apiClient.delete(`/filters/${filterId}`);
    if (!response.success) throw new Error(response.message || 'Failed to delete filter');
  },
};

// ─── Issue type icon ──────────────────────────────────────────────────────────

const IssueTypeIcon: React.FC<{ type: string; className?: string }> = ({ type, className = 'h-4 w-4' }) => {
  switch (type) {
    case 'bug': return <Bug className={`${className} text-red-500`} />;
    case 'epic': return <Layers className={`${className} text-purple-500`} />;
    default: return <CheckSquare className={`${className} text-blue-500`} />;
  }
};

// ─── Priority badge ───────────────────────────────────────────────────────────

const priorityVariant: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ISSUE_TYPES = ['task', 'bug', 'epic'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const BUG_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const PAGE_SIZE = 25;

const EMPTY_CRITERIA: FilterCriteria = {};

const AdvancedSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Filter state ────────────────────────────────────────────────────────────
  const [criteria, setCriteria] = useState<FilterCriteria>(EMPTY_CRITERIA);
  const [labelInput, setLabelInput] = useState('');
  const [page, setPage] = useState(1);

  // ── Search results ──────────────────────────────────────────────────────────
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // ── Save filter dialog ──────────────────────────────────────────────────────
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');

  // ── Projects for dropdown ───────────────────────────────────────────────────
  const { data: projectsData } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectService.getProjects({ limit: 100 }),
  });
  const projects = projectsData?.projects ?? [];

  // ── Saved filters ───────────────────────────────────────────────────────────
  const { data: savedFilters = [], refetch: refetchFilters } = useQuery({
    queryKey: ['saved-filters'],
    queryFn: filterService.getSavedFilters,
  });

  // ── Mutations ───────────────────────────────────────────────────────────────
  const saveFilterMutation = useMutation({
    mutationFn: ({ name, crit }: { name: string; crit: FilterCriteria }) =>
      filterService.saveFilter(name, crit),
    onSuccess: () => {
      toast.success('Filter saved');
      setShowSaveDialog(false);
      setFilterName('');
      refetchFilters();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteFilterMutation = useMutation({
    mutationFn: filterService.deleteFilter,
    onSuccess: () => {
      toast.success('Filter deleted');
      queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const set = useCallback(<K extends keyof FilterCriteria>(key: K, value: FilterCriteria[K]) => {
    setCriteria((prev) => ({ ...prev, [key]: value || undefined }));
    setPage(1);
  }, []);

  const clearAll = () => {
    setCriteria(EMPTY_CRITERIA);
    setLabelInput('');
    setPage(1);
    setSearchResults(null);
  };

  const addLabel = () => {
    const trimmed = labelInput.trim();
    if (!trimmed) return;
    const existing = criteria.label ?? [];
    if (!existing.includes(trimmed)) {
      set('label', [...existing, trimmed]);
    }
    setLabelInput('');
  };

  const removeLabel = (label: string) => {
    set('label', (criteria.label ?? []).filter((l) => l !== label));
  };

  const activeFilterCount = Object.values(criteria).filter((v) =>
    Array.isArray(v) ? v.length > 0 : v !== undefined && v !== ''
  ).length;

  // ── Search ──────────────────────────────────────────────────────────────────
  const runSearch = async (overridePage?: number) => {
    setIsSearching(true);
    try {
      const result = await filterService.searchIssues(criteria, overridePage ?? page, PAGE_SIZE);
      setSearchResults(result);
    } catch (err: any) {
      toast.error(err.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    runSearch(newPage);
  };

  const loadSavedFilter = (filter: SavedFilter) => {
    setCriteria(filter.criteria);
    setPage(1);
    toast.info(`Loaded filter: ${filter.name}`);
  };

  const runSavedFilter = async (filterId: string) => {
    setIsSearching(true);
    try {
      const result = await filterService.runFilter(filterId);
      setSearchResults(result);
      setPage(1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to run filter');
    } finally {
      setIsSearching(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Advanced Search</h1>
          <p className="text-sm text-muted-foreground">
            Filter issues by any combination of criteria and save searches for later.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="h-4 w-4 mr-1" />
              Clear ({activeFilterCount})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowSaveDialog(true)}
            disabled={activeFilterCount === 0}
          >
            <BookmarkPlus className="h-4 w-4 mr-2" />
            Save Filter
          </Button>
          <Button onClick={() => runSearch(1)} disabled={isSearching}>
            <Search className="h-4 w-4 mr-2" />
            {isSearching ? 'Searching…' : 'Search'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ── Filter Panel ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Text query */}
              <div className="space-y-1">
                <Label className="text-xs">Keyword</Label>
                <Input
                  placeholder="Search title / description…"
                  value={criteria.query ?? ''}
                  onChange={(e) => set('query', e.target.value)}
                />
              </div>

              {/* Issue type */}
              <div className="space-y-1">
                <Label className="text-xs">Issue Type</Label>
                <div className="space-y-1">
                  {ISSUE_TYPES.map((t) => (
                    <div key={t} className="flex items-center gap-2">
                      <Checkbox
                        id={`type-${t}`}
                        checked={criteria.issueType === t}
                        onCheckedChange={(checked) => set('issueType', checked ? t : undefined)}
                      />
                      <Label htmlFor={`type-${t}`} className="text-xs capitalize flex items-center gap-1">
                        <IssueTypeIcon type={t} className="h-3 w-3" />
                        {t}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Priority */}
              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <Select value={criteria.priority ?? ''} onValueChange={(v) => set('priority', v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Any priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bug severity (shown when issueType = bug or unset) */}
              {(!criteria.issueType || criteria.issueType === 'bug') && (
                <div className="space-y-1">
                  <Label className="text-xs">Bug Severity</Label>
                  <Select value={criteria.bugSeverity ?? ''} onValueChange={(v) => set('bugSeverity', v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Any severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any</SelectItem>
                      {BUG_SEVERITIES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status */}
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Input
                  placeholder="e.g. In Progress"
                  value={criteria.status ?? ''}
                  onChange={(e) => set('status', e.target.value)}
                />
              </div>

              <Separator />

              {/* Project */}
              <div className="space-y-1">
                <Label className="text-xs">Project</Label>
                <Select value={criteria.projectId ?? ''} onValueChange={(v) => set('projectId', v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Any project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    {projects.map((p: any) => (
                      <SelectItem key={p._id ?? p.id} value={p._id ?? String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Story points range */}
              <div className="space-y-1">
                <Label className="text-xs">Story Points</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Min"
                    className="h-8 text-xs"
                    value={criteria.storyPointsMin ?? ''}
                    onChange={(e) =>
                      set('storyPointsMin', e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Max"
                    className="h-8 text-xs"
                    value={criteria.storyPointsMax ?? ''}
                    onChange={(e) =>
                      set('storyPointsMax', e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* Labels */}
              <div className="space-y-1">
                <Label className="text-xs">Labels</Label>
                <div className="flex gap-1">
                  <Input
                    placeholder="Add label…"
                    className="h-8 text-xs"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addLabel()}
                  />
                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={addLabel}>
                    +
                  </Button>
                </div>
                {(criteria.label ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {criteria.label!.map((l) => (
                      <Badge key={l} variant="secondary" className="text-xs gap-1">
                        {l}
                        <button onClick={() => removeLabel(l)} className="hover:text-destructive">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Date ranges */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Created</Label>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={criteria.createdAtFrom ?? ''}
                      onChange={(e) => set('createdAtFrom', e.target.value)}
                    />
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={criteria.createdAtTo ?? ''}
                      onChange={(e) => set('createdAtTo', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Updated</Label>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={criteria.updatedAtFrom ?? ''}
                      onChange={(e) => set('updatedAtFrom', e.target.value)}
                    />
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={criteria.updatedAtTo ?? ''}
                      onChange={(e) => set('updatedAtTo', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Due Date</Label>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={criteria.dueDateFrom ?? ''}
                      onChange={(e) => set('dueDateFrom', e.target.value)}
                    />
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={criteria.dueDateTo ?? ''}
                      onChange={(e) => set('dueDateTo', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saved Filters */}
          {savedFilters.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Saved Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {savedFilters.map((f) => (
                  <div key={f._id} className="flex items-center justify-between gap-1">
                    <button
                      className="flex-1 text-left text-xs text-muted-foreground hover:text-foreground truncate"
                      onClick={() => loadSavedFilter(f)}
                    >
                      {f.name}
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        title="Run filter"
                        onClick={() => runSavedFilter(f._id)}
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        title="Delete filter"
                        onClick={() => deleteFilterMutation.mutate(f._id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Results Panel ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Results header */}
          {searchResults && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {searchResults.total} issue{searchResults.total !== 1 ? 's' : ''} found
              </p>
              {searchResults.totalPages > 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-muted-foreground">
                    {page} / {searchResults.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= searchResults.totalPages}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Issue rows */}
          {searchResults && searchResults.issues.length > 0 ? (
            <div className="space-y-2">
              {searchResults.issues.map((issue) => (
                <Card
                  key={issue._id}
                  className="hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => navigate(`/issues/${issue._id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <IssueTypeIcon type={issue.issueType} className="h-4 w-4 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground font-mono">
                            {issue.issueKey}
                          </span>
                          <span className="font-medium text-sm truncate">{issue.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge
                            className={`text-xs ${priorityVariant[issue.priority] ?? ''}`}
                          >
                            {issue.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {issue.status}
                          </Badge>
                          {issue.bugSeverity && (
                            <Badge variant="outline" className="text-xs text-red-600">
                              {issue.bugSeverity}
                            </Badge>
                          )}
                          {issue.storyPoints != null && (
                            <Badge variant="secondary" className="text-xs">
                              {issue.storyPoints} pts
                            </Badge>
                          )}
                          {(issue.labels ?? []).map((l) => (
                            <Badge key={l} variant="secondary" className="text-xs">
                              {l}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {issue.dueDate && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          Due {new Date(issue.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : searchResults && searchResults.issues.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No issues found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your filters or search terms.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Filter className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">Set filters and search</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Use the panel on the left to build your query, then click Search.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Save Filter Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter</DialogTitle>
            <DialogDescription>
              Give this filter a name so you can quickly re-run it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="filter-name">Filter Name</Label>
              <Input
                id="filter-name"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="e.g. My open bugs"
                onKeyDown={(e) => e.key === 'Enter' && filterName.trim() && saveFilterMutation.mutate({ name: filterName.trim(), crit: criteria })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''} will be saved.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!filterName.trim() || saveFilterMutation.isPending}
              onClick={() => saveFilterMutation.mutate({ name: filterName.trim(), crit: criteria })}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdvancedSearchPage;
