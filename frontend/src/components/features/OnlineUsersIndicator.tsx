import React from 'react';
import { Users, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useRealTime } from '../../contexts/RealTimeContext';

export const OnlineUsersIndicator: React.FC = () => {
  const { onlineUsers, isConnected } = useRealTime();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <Users className="h-4 w-4" />
          <Badge variant="outline" className="text-xs">
            {onlineUsers.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Online Team Members</h3>
            <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          
          {onlineUsers.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <Users className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No team members online</p>
            </div>
          ) : (
            <div className="space-y-2">
              {onlineUsers.map((userId) => (
                <div key={userId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm">User {userId}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default OnlineUsersIndicator;