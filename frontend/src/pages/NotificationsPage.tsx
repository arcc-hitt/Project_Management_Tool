import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCircle, Trash2, MoreVertical, Eye, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { notificationService, type Notification, type NotificationStats } from '@/services/notificationService';

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);

  useEffect(() => {
    loadNotifications();
    loadStats();
  }, [activeTab]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const filters = activeTab === 'unread' ? { isRead: false } : {};
      const data = await notificationService.getUserNotifications(filters);
      setNotifications(data.notifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await notificationService.getNotificationStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading notification stats:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, isRead: true, updatedAt: new Date().toISOString() }
            : n
        )
      );
      loadStats();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, updatedAt: new Date().toISOString() }))
      );
      loadStats();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDelete = async (notificationId: number) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
      loadStats();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleBulkMarkAsRead = async () => {
    if (selectedNotifications.length === 0) return;

    try {
      await notificationService.bulkMarkAsRead(selectedNotifications);
      setNotifications(prev =>
        prev.map(n =>
          selectedNotifications.includes(n.id)
            ? { ...n, isRead: true, updatedAt: new Date().toISOString() }
            : n
        )
      );
      setSelectedNotifications([]);
      loadStats();
    } catch (error) {
      console.error('Error bulk marking notifications as read:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedNotifications.length === 0) return;

    try {
      await notificationService.bulkDelete(selectedNotifications);
      setNotifications(prev => prev.filter(n => !selectedNotifications.includes(n.id)));
      setSelectedNotifications([]);
      loadStats();
    } catch (error) {
      console.error('Error bulk deleting notifications:', error);
    }
  };

  const toggleNotificationSelection = (notificationId: number) => {
    setSelectedNotifications(prev =>
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const selectAllNotifications = () => {
    const visibleNotifications = notifications.filter(n => 
      activeTab === 'all' || !n.isRead
    );
    setSelectedNotifications(visibleNotifications.map(n => n.id));
  };

  const deselectAllNotifications = () => {
    setSelectedNotifications([]);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'project':
        return <Bell className="h-4 w-4 text-green-500" />;
      case 'deadline':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'mention':
        return <Eye className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const filteredNotifications = notifications.filter(n => 
    activeTab === 'all' || !n.isRead
  );

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          {stats && (
            <p className="text-gray-500 mt-1">
              {stats.unread} unread of {stats.total} total notifications
            </p>
          )}
        </div>
        <div className="flex space-x-2">
          <Button onClick={handleMarkAllAsRead} variant="outline">
            <Check className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Bell className="h-8 w-8 text-gray-400" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Unread</p>
                <p className="text-2xl font-bold text-red-600">{stats.unread}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">By Type</p>
                <p className="text-2xl font-bold text-blue-600">
                  {Object.keys(stats.byType).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-400" />
            </div>
          </Card>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedNotifications.length > 0 && (
        <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-700">
              {selectedNotifications.length} notification(s) selected
            </p>
            <div className="flex space-x-2">
              <Button size="sm" onClick={handleBulkMarkAsRead} variant="outline">
                <Check className="h-4 w-4 mr-1" />
                Mark Read
              </Button>
              <Button size="sm" onClick={handleBulkDelete} variant="outline">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
              <Button size="sm" onClick={deselectAllNotifications} variant="ghost">
                Deselect All
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Notifications Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'all' | 'unread')}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="all">All Notifications</TabsTrigger>
            <TabsTrigger value="unread">
              Unread {stats && stats.unread > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {stats.unread}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          {filteredNotifications.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={selectedNotifications.length === filteredNotifications.length 
                ? deselectAllNotifications 
                : selectAllNotifications}
            >
              {selectedNotifications.length === filteredNotifications.length 
                ? 'Deselect All' 
                : 'Select All'}
            </Button>
          )}
        </div>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <Card className="p-8 text-center">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
              </h3>
              <p className="text-gray-500">
                {activeTab === 'unread' 
                  ? 'All caught up! You have no unread notifications.'
                  : 'You haven\'t received any notifications yet.'}
              </p>
            </Card>
          ) : (
            filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={`p-4 cursor-pointer transition-colors ${
                  !notification.isRead ? 'bg-blue-50 border-blue-200' : ''
                } ${
                  selectedNotifications.includes(notification.id) ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => toggleNotificationSelection(notification.id)}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className={`text-sm font-medium ${
                          !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {notification.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        {notification.entityType && (
                          <p className="text-xs text-gray-500 mt-1">
                            Related to: {notification.entityType} #{notification.entityId}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Badge variant="secondary" className="text-xs">
                          {notification.type}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!notification.isRead && (
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(notification.id);
                                }}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Mark as Read
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(notification.id);
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationsPage;