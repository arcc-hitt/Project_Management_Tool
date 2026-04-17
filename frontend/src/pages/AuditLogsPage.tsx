import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import { Navigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLog {
  _id: string;
  actorUserId: string;
  actorUser?: { firstName: string; lastName: string; email: string };
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

interface AuditFilters {
  actorUserId?: string;
  entityType?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const auditService = {
  async getLogs(filters: AuditFilters, page: number, limit: number): Promise<AuditLogsResponse> {
    const params = new URLSearchParams();
    if (filters.actorUserId) params.set('actorUserId', filters.actorUserId);
    if (filters.entityType) params.set('entityType', filters.entityType);
    if (filters.action) params.set('action', filters.action);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    params.set('page', String(page));
    params.set('limit', String(limit));

    const response = await apiClient.get<AuditLogsResponse>(
      `/admin/audit-logs?${params.toString()}`
    );
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to load audit logs');
    return response.data;
  },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_TYPES = [
  'user', 'project', 'issue', 'sprint', 'webhook', 'sso', 'projectMember',
];

const ACTIONS = [
  'user.role_changed',
  'project.member_added',
  'project.member_removed',
  'project.settings_updated',
  'webhook.registered',
  'webhook.deleted',
  'sprint.started',
  'sprint.closed',
  'sso.linked',
  'sso.unlinked',
];

const PAGE_SIZE = 25;

// ─── Action badge colour ──────────────────────────────────────────────────────

const actionColour = (action: string): string => {
  if (action.includes('deleted') || action.includes('removed')) return 'bg-red-100 text-red-700';
  if (action.includes('created') || action.includes('added') || action.includes('registered')) return 'bg-green-100 text-green-700';
  if (action.includes('started') || action.includes('linked')) return 'bg-blue-100 text-blue-700';
  if (action.includes('closed') || action.includes('unlinked')) return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-700';
};

// ─── Diff viewer ──────────────────────────────────────────────────────────────

const DiffViewer: React.FC<{ old?: Record<string, any>; next?: Record<string, any> }> = ({ old, next }) => {
  if (!old && !next) return null;
  const keys = Array.from(new Set([...Object.keys(old ?? {}), ...Object.keys(next ?? {})]));
  if (keys.length === 0) return null;

  return (
    <div className="mt-2 text-xs font-mono bg-muted rounded p-2 space-y-0.5 max-h-32 overflow-y-auto">
      {keys.map((k) => {
        const before = old?.[k];
        const after = next?.[k];
        if (before === after) return null;
        return (
          <div key={k}>
            {before !== undefined && (
              <span className="text-red-600">- {k}: {JSON.stringify(before)}</span>
            )}
            {after !== undefined && (
              <span className="text-green-600 block">+ {k}: {JSON.stringify(after)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const AuditLogsPage: React.FC = () => {
  const { user } = useAuth();

  // Redirect non-admins (Req 11.5)
  if (user && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const [filters, setFilters] = useState<AuditFilters>({});
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const setFilter = <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const activeCount = Object.values(filters).filter(Boolean).length;

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: () => auditService.getLogs(filters, page, PAGE_SIZE),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Audit Logs</h1>
            <p className="text-sm text-muted-foreground">
              Immutable record of all administrative and security-sensitive changes.
            </p>
          </div>
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear filters ({activeCount})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ── Filter Panel ─────────────────────────────────────────────────── */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Actor User ID</Label>
              <Input
                placeholder="User ID…"
                className="h-8 text-xs"
                value={filters.actorUserId ?? ''}
                onChange={(e) => setFilter('actorUserId', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Entity Type</Label>
              <Select value={filters.entityType ?? 'all'} onValueChange={(v) => setFilter('entityType', v === 'all' ? undefined : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Any type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Action</Label>
              <Select value={filters.action ?? 'all'} onValueChange={(v) => setFilter('action', v === 'all' ? undefined : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Any action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-1">
              <Label className="text-xs">Date From</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={filters.dateFrom ?? ''}
                onChange={(e) => setFilter('dateFrom', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Date To</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={filters.dateTo ?? ''}
                onChange={(e) => setFilter('dateTo', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Log Table ────────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Pagination header */}
          {data && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {data.total} entr{data.total !== 1 ? 'ies' : 'y'}
              </p>
              {data.totalPages > 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-muted-foreground">
                    {page} / {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {isLoading && (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground text-sm">
                Loading audit logs…
              </CardContent>
            </Card>
          )}

          {error && (
            <Card>
              <CardContent className="py-16 text-center text-destructive text-sm">
                Failed to load audit logs. Make sure you have admin access.
              </CardContent>
            </Card>
          )}

          {data && data.logs.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No audit log entries</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Entries appear here when administrative actions are performed.
                </p>
              </CardContent>
            </Card>
          )}

          {data && data.logs.length > 0 && (
            <div className="space-y-2">
              {data.logs.map((log) => (
                <Card
                  key={log._id}
                  className="cursor-pointer hover:shadow-sm transition-shadow"
                  onClick={() => setExpandedId(expandedId === log._id ? null : log._id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-xs ${actionColour(log.action)}`}>
                            {log.action}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {log.entityType}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {log.entityId}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>
                            {log.actorUser
                              ? `${log.actorUser.firstName} ${log.actorUser.lastName}`
                              : log.actorUserId}
                          </span>
                          <span>·</span>
                          <span>{log.ipAddress}</span>
                        </div>

                        {/* Expanded diff */}
                        {expandedId === log._id && (
                          <div className="mt-3 space-y-2">
                            <DiffViewer old={log.oldValues} next={log.newValues} />
                            <p className="text-xs text-muted-foreground break-all">
                              UA: {log.userAgent}
                            </p>
                          </div>
                        )}
                      </div>

                      <time className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </time>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogsPage;
