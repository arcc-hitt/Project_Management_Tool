import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Save, Download, Trash2, Shield, Bell, Clock, Palette, Globe, Keyboard, User } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';

import { settingsService } from '../services/settingsService';
import type { UserPreferences } from '../services/settingsService';
import { useAuth } from '../contexts/AuthContext';

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, setValue } = useForm();

  // Load user preferences and settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const prefs = await settingsService.getUserPreferences();
        
        setPreferences(prefs);
        
        // Populate form with current values
        Object.entries(prefs).forEach(([key, value]) => {
          setValue(key, value);
        });
      } catch (error) {
        console.error('Error loading settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [setValue]);

  const onSubmit = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      await settingsService.updateUserPreferences(data as Partial<UserPreferences>);
      setPreferences({ ...preferences!, ...data } as UserPreferences);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationToggle = async (type: string, category: 'email' | 'push', value: boolean) => {
    if (!preferences) return;
    
    const updated = {
      ...preferences,
      [category === 'email' ? 'emailNotifications' : 'pushNotifications']: {
        ...preferences[category === 'email' ? 'emailNotifications' : 'pushNotifications'],
        [type]: value
      }
    };
    
    try {
      await settingsService.updateUserPreferences(updated);
      setPreferences(updated);
      toast.success('Notification preferences updated');
    } catch (error) {
      console.error('Error updating notifications:', error);
      toast.error('Failed to update notification preferences');
    }
  };

  const handleTestNotification = async (type: 'email' | 'push') => {
    try {
      await settingsService.testNotification(type);
      toast.success(`Test ${type} notification sent`);
    } catch (error) {
      console.error('Error testing notification:', error);
      toast.error(`Failed to send test ${type} notification`);
    }
  };

  const handleExportData = async () => {
    try {
      const blob = await settingsService.exportUserData('json');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `user-data-${user?.email}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('User data exported successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export user data');
    }
  };

  const handleResetPreferences = async () => {
    if (!confirm('Are you sure you want to reset all preferences to defaults?')) return;
    
    try {
      const defaults = await settingsService.resetUserPreferences();
      setPreferences(defaults);
      Object.entries(defaults).forEach(([key, value]) => {
        setValue(key, value);
      });
      toast.success('Preferences reset to defaults');
    } catch (error) {
      console.error('Error resetting preferences:', error);
      toast.error('Failed to reset preferences');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application preferences.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="productivity" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Productivity
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Privacy
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Advanced
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Regional Settings
                </CardTitle>
                <CardDescription>
                  Configure your language, timezone, and date formats.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select defaultValue={preferences?.language}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select defaultValue={preferences?.timezone}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        <SelectItem value="Europe/London">London</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">Date Format</Label>
                    <Select defaultValue={preferences?.dateFormat}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="DD.MM.YYYY">DD.MM.YYYY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeFormat">Time Format</Label>
                    <Select defaultValue={preferences?.timeFormat}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12h">12 Hour</SelectItem>
                        <SelectItem value="24h">24 Hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Settings */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Theme & Display
                </CardTitle>
                <CardDescription>
                  Customize the appearance of the application.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select defaultValue={preferences?.theme}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="defaultView">Default View</Label>
                    <Select defaultValue={preferences?.defaultView}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select view" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kanban">Kanban Board</SelectItem>
                        <SelectItem value="list">List View</SelectItem>
                        <SelectItem value="calendar">Calendar</SelectItem>
                        <SelectItem value="timeline">Timeline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Animations</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable smooth animations and transitions
                      </p>
                    </div>
                    <Switch defaultChecked={preferences?.animationsEnabled} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Compact Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Reduce spacing and use smaller UI elements
                      </p>
                    </div>
                    <Switch defaultChecked={preferences?.compactMode} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Collapse Sidebar</Label>
                      <p className="text-sm text-muted-foreground">
                        Start with sidebar collapsed
                      </p>
                    </div>
                    <Switch defaultChecked={preferences?.sidebarCollapsed} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Choose what notifications you want to receive and how.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Email Notifications</h4>
                  {preferences && Object.entries(preferences.emailNotifications).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                      </div>
                      <Switch 
                        checked={value}
                        onCheckedChange={(checked: boolean) => handleNotificationToggle(key, 'email', checked)}
                      />
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Push Notifications</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestNotification('push')}
                    >
                      Test
                    </Button>
                  </div>
                  {preferences && Object.entries(preferences.pushNotifications).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                      </div>
                      <Switch 
                        checked={value}
                        onCheckedChange={(checked: boolean) => handleNotificationToggle(key, 'push', checked)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Productivity Settings */}
          <TabsContent value="productivity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Time Tracking & Goals
                </CardTitle>
                <CardDescription>
                  Configure your productivity settings and time tracking preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dailyTimeGoal">Daily Time Goal (minutes)</Label>
                    <Input
                      id="dailyTimeGoal"
                      type="number"
                      defaultValue={preferences?.dailyTimeGoal}
                      {...register('dailyTimeGoal', { min: 60, max: 960 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reminderInterval">Reminder Interval (minutes)</Label>
                    <Input
                      id="reminderInterval"
                      type="number"
                      defaultValue={preferences?.reminderInterval}
                      {...register('reminderInterval', { min: 15, max: 240 })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Time Tracking</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically start tracking time when you begin working on tasks
                    </p>
                  </div>
                  <Switch defaultChecked={preferences?.autoTimeTracking} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Settings */}
          <TabsContent value="privacy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy & Security
                </CardTitle>
                <CardDescription>
                  Control your privacy settings and account security.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="profileVisibility">Profile Visibility</Label>
                    <Select defaultValue={preferences?.profileVisibility}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="team">Team Only</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="activityVisibility">Activity Visibility</Label>
                    <Select defaultValue={preferences?.activityVisibility}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="team">Team Only</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow Mentions</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow other users to mention you in comments
                      </p>
                    </div>
                    <Switch defaultChecked={preferences?.allowMentions} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {preferences?.twoFactorEnabled && (
                        <Badge variant="secondary">Enabled</Badge>
                      )}
                      <Switch defaultChecked={preferences?.twoFactorEnabled} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Data Export
                </CardTitle>
                <CardDescription>
                  Download your data for backup or migration purposes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportData}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export My Data
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced Settings */}
          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Keyboard className="h-5 w-5" />
                  Keyboard Shortcuts
                </CardTitle>
                <CardDescription>
                  View and configure keyboard shortcuts for faster navigation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Keyboard Shortcuts</Label>
                    <p className="text-sm text-muted-foreground">
                      Use keyboard shortcuts for quick actions
                    </p>
                  </div>
                  <Switch defaultChecked={preferences?.keyboard_shortcuts} />
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Available Shortcuts</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {Object.entries(settingsService.getKeyboardShortcuts()).map(([key, description]) => (
                      <div key={key} className="flex justify-between items-center py-1">
                        <span className="text-muted-foreground">{description}</span>
                        <Badge variant="outline" className="font-mono text-xs">
                          {key}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible actions that affect your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetPreferences}
                  className="w-full"
                >
                  Reset All Preferences
                </Button>
                
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                      // Handle account deletion
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </Tabs>
      </form>
    </div>
  );
};

export default SettingsPage;