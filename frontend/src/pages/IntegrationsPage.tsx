import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Webhook,
  Plus,
  Trash2,
  Save,
  Link,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Separator } from '../components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { apiClient } from '../services/api';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookRecord {
  _id: string;
  projectId: string;
  url: string;
  events: string[];
  secret?: string;
  createdBy: string;
  createdAt: string;
}

interface CreateWebhookPayload {
  projectId: string;
  url: string;
  events: string[];
  secret?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const webhookService = {
  async list(): Promise<WebhookRecord[]> {
    const response = await apiClient.get<WebhookRecord[]>('/webhooks');
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to load webhooks');
    return response.data;
  },

  async create(payload: CreateWebhookPayload): Promise<WebhookRecord> {
    const response = await apiClient.post<WebhookRecord>('/webhooks', payload);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to create webhook');
    return response.data;
  },

  async remove(id: string): Promise<void> {
    const response = await apiClient.delete(`/webhooks/${id}`);
    if (!response.success) throw new Error(response.message || 'Failed to delete webhook');
  },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const WEBHOOK_EVENTS = [
  { value: 'issue.created', label: 'Issue Created' },
  { value: 'issue.updated', label: 'Issue Updated' },
  { value: 'issue.deleted', label: 'Issue Deleted' },
  { value: 'issue.transitioned', label: 'Issue Transitioned' },
  { value: 'comment.created', label: 'Comment Created' },
  { value: 'sprint.started', label: 'Sprint Started' },
  { value: 'sprint.closed', label: 'Sprint Closed' },
  { value: 'attachment.uploaded', label: 'Attachment Uploaded' },
];

// ─── Webhook Form ─────────────────────────────────────────────────────────────

interface WebhookFormProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const WebhookForm: React.FC<WebhookFormProps> = ({ open, onClose, onCreated }) => {
  const [url, setUrl] = useState('');
  const [projectId, setProjectId] = useState('');
  const [secret, setSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: webhookService.create,
    onSuccess: () => {
      toast.success('Webhook registered');
      onCreated();
      onClose();
      setUrl('');
      setProjectId('');
      setSecret('');
      setSelectedEvents([]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const selectAll = () => setSelectedEvents(WEBHOOK_EVENTS.map((e) => e.value));
  const clearAll = () => setSelectedEvents([]);

  const handleSubmit = () => {
    if (!url.trim()) { toast.error('URL is required'); return; }
    if (!url.startsWith('https://')) { toast.error('URL must start with https://'); return; }
    if (selectedEvents.length === 0) { toast.error('Select at least one event'); return; }
    mutation.mutate({
      url: url.trim(),
      projectId: projectId.trim(),
      events: selectedEvents,
      secret: secret.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register Webhook</DialogTitle>
          <DialogDescription>
            Receive HTTP POST payloads when project events occur. URL must use HTTPS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="wh-url">Endpoint URL *</Label>
            <Input
              id="wh-url"
              placeholder="https://example.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="wh-project">Project ID</Label>
            <Input
              id="wh-project"
              placeholder="Leave blank for all projects"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="wh-secret">Secret (optional)</Label>
            <Input
              id="wh-secret"
              type="password"
              placeholder="Used to sign payloads with HMAC-SHA256"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              When set, each delivery includes an <code>X-Kiro-Signature</code> header.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Events *</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAll}>
                  All
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearAll}>
                  None
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <div key={ev.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`ev-${ev.value}`}
                    checked={selectedEvents.includes(ev.value)}
                    onCheckedChange={() => toggleEvent(ev.value)}
                  />
                  <Label htmlFor={`ev-${ev.value}`} className="text-xs cursor-pointer">
                    {ev.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Registering…' : 'Register Webhook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Webhook Row ──────────────────────────────────────────────────────────────

const WebhookRow: React.FC<{ webhook: WebhookRecord; onDeleted: () => void }> = ({ webhook, onDeleted }) => {
  const [expanded, setExpanded] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => webhookService.remove(webhook._id),
    onSuccess: () => {
      toast.success('Webhook deleted');
      onDeleted();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-mono text-sm truncate">{webhook.url}</span>
              {webhook.secret && (
                <Badge variant="secondary" className="text-xs shrink-0">Signed</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {webhook.projectId && <span>Project: {webhook.projectId}</span>}
              <span>·</span>
              <span>{webhook.events.length} event{webhook.events.length !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{new Date(webhook.createdAt).toLocaleDateString()}</span>
            </div>

            {expanded && (
              <div className="mt-2 flex flex-wrap gap-1">
                {webhook.events.map((ev) => (
                  <Badge key={ev} variant="outline" className="text-xs">{ev}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? 'Collapse' : 'Expand events'}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              title="Delete webhook"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Slack Section ────────────────────────────────────────────────────────────

const SlackSection: React.FC = () => {
  const STORAGE_KEY = 'kiro_slack_webhook_url';
  const [url, setUrl] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [saved, setSaved] = useState(!!localStorage.getItem(STORAGE_KEY));

  const handleSave = () => {
    if (!url.trim()) {
      localStorage.removeItem(STORAGE_KEY);
      setSaved(false);
      toast.success('Slack webhook URL cleared');
      return;
    }
    if (!url.startsWith('https://hooks.slack.com/')) {
      toast.error('Must be a valid Slack Incoming Webhook URL (https://hooks.slack.com/…)');
      return;
    }
    localStorage.setItem(STORAGE_KEY, url.trim());
    setSaved(true);
    toast.success('Slack webhook URL saved');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {/* Slack logo placeholder */}
          <div className="h-8 w-8 rounded bg-[#4A154B] flex items-center justify-center text-white text-xs font-bold">
            S
          </div>
          <div>
            <CardTitle className="text-base">Slack</CardTitle>
            <CardDescription>
              Receive issue transition notifications in a Slack channel.
            </CardDescription>
          </div>
          {saved && (
            <Badge className="ml-auto bg-green-100 text-green-700 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="slack-url">Incoming Webhook URL</Label>
          <Input
            id="slack-url"
            placeholder="https://hooks.slack.com/services/…"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
          />
          <p className="text-xs text-muted-foreground">
            Create an Incoming Webhook in your Slack workspace and paste the URL here.
            Notifications are sent when issues move to <em>In Review</em>.
          </p>
        </div>
        <Button size="sm" onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </CardContent>
    </Card>
  );
};

// ─── GitHub Section ───────────────────────────────────────────────────────────

const GitHubSection: React.FC = () => {
  const STORAGE_KEY = 'kiro_github_webhook_secret';
  const [secret, setSecret] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [saved, setSaved] = useState(!!localStorage.getItem(STORAGE_KEY));
  const [showSecret, setShowSecret] = useState(false);

  const handleSave = () => {
    if (!secret.trim()) {
      localStorage.removeItem(STORAGE_KEY);
      setSaved(false);
      toast.success('GitHub webhook secret cleared');
      return;
    }
    localStorage.setItem(STORAGE_KEY, secret.trim());
    setSaved(true);
    toast.success('GitHub webhook secret saved');
  };

  const webhookUrl = `${window.location.origin.replace(':5173', ':5000')}/api/integrations/github/webhook`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {/* GitHub logo placeholder */}
          <div className="h-8 w-8 rounded bg-gray-900 flex items-center justify-center text-white text-xs font-bold">
            GH
          </div>
          <div>
            <CardTitle className="text-base">GitHub</CardTitle>
            <CardDescription>
              Auto-transition issues to Done when a linked PR is merged.
            </CardDescription>
          </div>
          {saved && (
            <Badge className="ml-auto bg-green-100 text-green-700 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Configured
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-muted p-3 space-y-1">
          <p className="text-xs font-medium">Webhook Endpoint</p>
          <p className="text-xs font-mono break-all text-muted-foreground">{webhookUrl}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add this URL as a webhook in your GitHub repository settings. Select the{' '}
            <strong>Pull requests</strong> event.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="gh-secret">Webhook Secret</Label>
          <div className="flex gap-2">
            <Input
              id="gh-secret"
              type={showSecret ? 'text' : 'password'}
              placeholder="Enter the secret you set in GitHub"
              value={secret}
              onChange={(e) => { setSecret(e.target.value); setSaved(false); }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSecret((v) => !v)}
              className="shrink-0"
            >
              {showSecret ? 'Hide' : 'Show'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Used to verify the <code>X-Hub-Signature-256</code> header on incoming payloads.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            Link a GitHub PR to an issue by setting the issue's <strong>GitHub PR URL</strong> field.
            When the PR is merged, the issue will automatically transition to <strong>Done</strong>.
          </p>
        </div>

        <Button size="sm" onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Secret
        </Button>
      </CardContent>
    </Card>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const IntegrationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [showWebhookForm, setShowWebhookForm] = useState(false);

  const { data: webhooks = [], isLoading, error } = useQuery({
    queryKey: ['webhooks'],
    queryFn: webhookService.list,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['webhooks'] });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect your workspace to external tools and services.
        </p>
      </div>

      {/* ── Webhooks ─────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Webhooks</h2>
            {webhooks.length > 0 && (
              <Badge variant="secondary">{webhooks.length}</Badge>
            )}
          </div>
          <Button size="sm" onClick={() => setShowWebhookForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Webhook
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Register HTTPS endpoints to receive real-time event payloads. Supports HMAC-SHA256
          payload signing and automatic retries with exponential backoff.
        </p>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading webhooks…</p>
        )}

        {error && (
          <Card>
            <CardContent className="py-8 text-center text-destructive text-sm">
              Failed to load webhooks.
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && webhooks.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Webhook className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No webhooks registered</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Add a webhook to start receiving event notifications.
              </p>
              <Button size="sm" onClick={() => setShowWebhookForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Webhook
              </Button>
            </CardContent>
          </Card>
        )}

        {webhooks.length > 0 && (
          <div className="space-y-2">
            {webhooks.map((wh) => (
              <WebhookRow key={wh._id} webhook={wh} onDeleted={invalidate} />
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* ── Slack ─────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Messaging</h2>
        <SlackSection />
      </section>

      <Separator />

      {/* ── GitHub ────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Source Control</h2>
        <GitHubSection />
      </section>

      {/* Webhook form dialog */}
      <WebhookForm
        open={showWebhookForm}
        onClose={() => setShowWebhookForm(false)}
        onCreated={invalidate}
      />
    </div>
  );
};

export default IntegrationsPage;
