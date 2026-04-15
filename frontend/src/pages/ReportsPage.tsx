import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { reportService, sprintService } from '../services/issueService';

// ─── Colour palette ──────────────────────────────────────────────────────────
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

const priorityColor: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#22c55e',
};

// ─── Burndown Tab ─────────────────────────────────────────────────────────────
const BurndownTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintService.getSprints(projectId),
    enabled: !!projectId,
  });

  // Auto-select the first sprint when list loads
  React.useEffect(() => {
    if (sprints.length > 0 && !selectedSprintId) {
      // Prefer active sprint, then most recent
      const active = sprints.find((s) => s.state === 'active');
      setSelectedSprintId(active?._id ?? sprints[0]._id);
    }
  }, [sprints, selectedSprintId]);

  const { data: burndown, isLoading, error } = useQuery({
    queryKey: ['burndown', projectId, selectedSprintId],
    queryFn: () => reportService.getBurndown(projectId, selectedSprintId),
    enabled: !!selectedSprintId,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Sprint</span>
        <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select a sprint" />
          </SelectTrigger>
          <SelectContent>
            {sprints.map((s) => (
              <SelectItem key={s._id} value={s._id}>
                {s.name}
                <Badge
                  className={`ml-2 text-xs ${
                    s.state === 'active'
                      ? 'bg-blue-100 text-blue-700'
                      : s.state === 'closed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {s.state}
                </Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading burndown data…
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-64 text-destructive text-sm">
          Failed to load burndown data.
        </div>
      )}

      {!isLoading && !error && burndown && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Burndown — {burndown.sprintName}
            </CardTitle>
            <CardDescription>
              {burndown.startDate} → {burndown.endDate}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={burndown.dataPoints} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="remainingStoryPoints"
                  name="Story Points"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="remainingIssueCount"
                  name="Issues"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 2"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && !burndown && !selectedSprintId && (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Select a sprint to view its burndown chart.
        </div>
      )}
    </div>
  );
};

// ─── Velocity Tab ─────────────────────────────────────────────────────────────
const VelocityTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: velocity, isLoading, error } = useQuery({
    queryKey: ['velocity', projectId],
    queryFn: () => reportService.getVelocity(projectId),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading velocity data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive text-sm">
        Failed to load velocity data.
      </div>
    );
  }

  const data = velocity?.velocityData ?? [];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No closed sprints yet. Velocity data will appear after the first sprint is closed.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Velocity — Last {data.length} Sprints</CardTitle>
        <CardDescription>Completed story points and issues per sprint</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="sprintName" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="completedStoryPoints"
              name="Story Points"
              fill="#6366f1"
              radius={[3, 3, 0, 0]}
            />
            <Bar
              yAxisId="right"
              dataKey="completedIssueCount"
              name="Issues"
              fill="#22c55e"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// ─── Issue Stats Tab ──────────────────────────────────────────────────────────
const IssueStatsTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['issue-stats', projectId],
    queryFn: () => reportService.getIssueStats(projectId),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading issue stats…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive text-sm">
        Failed to load issue stats.
      </div>
    );
  }

  if (!stats) return null;

  const typeData = Object.entries(stats.byIssueType).map(([name, value]) => ({ name, value }));
  const statusData = Object.entries(stats.byStatus).map(([name, value]) => ({ name, value }));
  const priorityData = Object.entries(stats.byPriority).map(([name, value]) => ({
    name,
    value,
    fill: priorityColor[name] ?? '#6366f1',
  }));

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Issues</p>
          </CardContent>
        </Card>
        {typeData.map(({ name, value }) => (
          <Card key={name}>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-1 capitalize">{name}s</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* By Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {statusData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By Priority */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={priorityData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={60} />
                <Tooltip />
                <Bar dataKey="value" name="Issues" radius={[0, 3, 3, 0]}>
                  {priorityData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By Issue Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" name="Issues" radius={[3, 3, 0, 0]}>
                  {typeData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ReportsPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No project selected.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Sprint burndown, velocity, and issue statistics
        </p>
      </div>

      <Tabs defaultValue="burndown">
        <TabsList>
          <TabsTrigger value="burndown">Burndown</TabsTrigger>
          <TabsTrigger value="velocity">Velocity</TabsTrigger>
          <TabsTrigger value="issue-stats">Issue Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="burndown" className="mt-4">
          <BurndownTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="velocity" className="mt-4">
          <VelocityTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="issue-stats" className="mt-4">
          <IssueStatsTab projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
