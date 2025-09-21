import React from 'react';
import { useRealTime } from '../../contexts/RealTimeContext';

interface TypingIndicatorProps {
  taskId?: string;
  projectId?: string;
  context?: 'task' | 'project' | 'comment';
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  taskId,
  projectId,
  context = 'task'
}) => {
  const { typingUsers } = useRealTime();

  // Filter typing users based on context
  const relevantTypingUsers = typingUsers.filter(user => {
    if (context === 'task' && taskId) {
      return user.context === 'task' && user.contextId === taskId;
    }
    if (context === 'project' && projectId) {
      return user.context === 'project' && user.contextId === projectId;
    }
    return false;
  });

  if (relevantTypingUsers.length === 0) {
    return null;
  }

  const formatTypingText = () => {
    if (relevantTypingUsers.length === 1) {
      return `${relevantTypingUsers[0].userName} is typing...`;
    } else if (relevantTypingUsers.length === 2) {
      return `${relevantTypingUsers[0].userName} and ${relevantTypingUsers[1].userName} are typing...`;
    } else {
      return `${relevantTypingUsers.length} users are typing...`;
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted/30 rounded-md">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="italic">{formatTypingText()}</span>
    </div>
  );
};

export default TypingIndicator;