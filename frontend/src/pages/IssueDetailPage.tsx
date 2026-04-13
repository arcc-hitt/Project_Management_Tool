import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, ArrowRight } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { issueService, type Issue } from '../services/issueService';
import { userService } from '../services/userService';

// ── helpers ───────────────────────────────────────────────────────────────────

const priorityColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

const severityColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

// ── MentionTextarea ───────────────────────────────────────────────────────────

interface MentionTextareaProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

const MentionTextarea: React.FC<MentionTextareaProps> = ({ value, onChange, onSubmit, isSubmitting }) => {
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionStart, setMentionStart] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => userService.getUsers({ limit: 50 }).then(r => r.users),
    enabled: mentionOpen,
  });

  const filteredUsers = users.filter((u: any) =>
    `${u.firstName}${u.lastName}`.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionStart(cursor - match[0].length);
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (username: string) => {
    const before = value.slice(0, mentionStart);
    const after = value.slice(textareaRef.current?.selectionStart ?? mentionStart + mentionQuery.length + 1);
    onChange(`${before}@${username} ${after}`);
    setMentionOpen(false);
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment… Use @username to mention someone. Ctrl+Enter to submit."
        rows={3}
        className="resize-none"
      />
      {mentionOpen && filteredUsers.length > 0 && (
        <div className="absolute z-10 bottom-full mb-1 left-0 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto w-56">
          {filteredUsers.map((u: any) => (
            <button
              key={u._id ?? u.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              onMouseDown={e => { e.preventDefault(); insertMention(`${u.firstName}${u.lastName}`); }}
            >
              {u.firstName} {u.lastName}
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-end mt-2">
        <Button size="sm" onClick={onSubmit} disabled={isSubmitting || !value.trim()}>
          <Send className="h-3 w-3 mr-1" /> Comment
        </Button>
      </div>
    </div>
  );
};

// ── IssueDetailPage ───────────────────────────────────────────────────────────

const IssueDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');

  const { data: issue, isLoading } = useQuery({
    queryKey: ['issue', id],
    queryFn: () => issueService.getIssue(id!),
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['issue-comments', id],
    queryFn: () => issueService.getComments(id!),
    enabled: !!id,
  });

  const transitionMutation = useMutation({
    mutationFn: (targetState: string) => issueService.transitionIssue(id!, targetState),
    onSuccess: () => {
      toast.success('Issue transitioned');
      queryClient.invalidateQueries({ queryKey: ['issue', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Transition not permitted'),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => issueService.addComment(id!, content),
    onSuccess: () => {
      toast.success('Comment added');
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['issue-comments', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add comment'),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading issue...</div>;
  }

  if (!issue) {
    return <div className="text-center py-12 text-muted-foreground">Issue not found.</div>;
  }

  // Derive permitted transitions from workflow (issue.workflow not always available; show generic select)
  const workflowStates: string[] = (issue as any).workflow?.states?.map((s: any) => s.name) ?? [];
  const currentStateObj = (issue as any).workflow?.states?.find((s: any) => s.name === issue.status);
  const permittedTransitions: string[] = currentStateObj?.transitions ?? workflowStates.filter(s => s !== issue.status);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-muted-foreground">{issue.issueKey}</span>
            <Badge variant="outline" className="text-xs">{issue.issueType}</Badge>
          </div>
          <h1 className="text-2xl font-bold">{issue.title}</h1>
        </div>
        {/* Transition button */}
        {permittedTransitions.length > 0 && (
          <Select onValueChange={v => transitionMutation.mutate(v)} disabled={transitionMutation.isPending}>
            <SelectTrigger className="w-48">
              <ArrowRight className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Transition to…" />
            </SelectTrigger>
            <SelectContent>
              {permittedTransitions.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Description</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {issue.description || 'No description provided.'}
            </p>
          </div>

          {/* Child issues (epics) */}
          {issue.issueType === 'epic' && issue.childIssueIds && issue.childIssueIds.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Child Issues ({issue.childIssueIds.length})</h3>
              <div className="space-y-1">
                {issue.childIssueIds.map(childId => (
                  <div key={childId} className="text-sm text-muted-foreground bg-gray-50 rounded px-3 py-1.5 font-mono">
                    {childId}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Comments ({comments.length})</h3>
            <div className="space-y-3 mb-4">
              {comments.map((c: any) => (
                <div key={c._id ?? c.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">
                      {c.user?.firstName ?? 'User'} {c.user?.lastName ?? ''}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}
            </div>
            <MentionTextarea
              value={commentText}
              onChange={setCommentText}
              onSubmit={() => commentMutation.mutate(commentText)}
              isSubmitting={commentMutation.isPending}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Status</span>
              <p className="font-medium mt-0.5">{issue.status}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Priority</span>
              <div className="mt-0.5">
                <Badge className={`text-xs ${priorityColor[issue.priority]}`}>{issue.priority}</Badge>
              </div>
            </div>
            {issue.issueType === 'bug' && issue.bugSeverity && (
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Severity</span>
                <div className="mt-0.5">
                  <Badge className={`text-xs ${severityColor[issue.bugSeverity]}`}>{issue.bugSeverity}</Badge>
                </div>
              </div>
            )}
            {(issue.issueType === 'task' || issue.issueType === 'epic') && issue.storyPoints != null && (
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Story Points</span>
                <p className="font-medium mt-0.5">{issue.storyPoints}</p>
              </div>
            )}
            {issue.assignee && (
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Assignee</span>
                <p className="font-medium mt-0.5">{issue.assignee.firstName} {issue.assignee.lastName}</p>
              </div>
            )}
            {issue.dueDate && (
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Due Date</span>
                <p className="font-medium mt-0.5">{new Date(issue.dueDate).toLocaleDateString()}</p>
              </div>
            )}
            {issue.labels && issue.labels.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Labels</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {issue.labels.map(l => (
                    <Badge key={l} variant="outline" className="text-xs">{l}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Created</span>
              <p className="font-medium mt-0.5">{new Date(issue.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IssueDetailPage;
