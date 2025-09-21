import { apiClient } from './api';

export interface UserPreferences {
  // Appearance
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  dateFormat: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'DD.MM.YYYY';
  timeFormat: '12h' | '24h';
  
  // Notifications
  emailNotifications: {
    taskAssigned: boolean;
    taskUpdated: boolean;
    taskCompleted: boolean;
    projectUpdated: boolean;
    deadlineReminder: boolean;
    commentAdded: boolean;
    mentions: boolean;
  };
  
  pushNotifications: {
    taskAssigned: boolean;
    taskUpdated: boolean;
    taskCompleted: boolean;
    projectUpdated: boolean;
    deadlineReminder: boolean;
    commentAdded: boolean;
    mentions: boolean;
  };
  
  // Dashboard
  defaultView: 'kanban' | 'list' | 'calendar' | 'timeline';
  tasksPerPage: number;
  projectsPerPage: number;
  showCompletedTasks: boolean;
  showArchivedProjects: boolean;
  
  // Productivity
  autoTimeTracking: boolean;
  dailyTimeGoal: number; // in minutes
  reminderInterval: number; // in minutes
  workingHours: {
    start: string; // HH:mm format
    end: string; // HH:mm format
    workingDays: number[]; // 0-6, 0=Sunday
  };
  
  // Privacy & Security
  profileVisibility: 'public' | 'team' | 'private';
  activityVisibility: 'public' | 'team' | 'private';
  allowMentions: boolean;
  twoFactorEnabled: boolean;
  
  // Advanced
  keyboard_shortcuts: boolean;
  animationsEnabled: boolean;
  compactMode: boolean;
  sidebarCollapsed: boolean;
}

export interface SystemSettings {
  // Application info
  appName: string;
  version: string;
  environment: string;
  
  // Features
  features: {
    timeTracking: boolean;
    fileUpload: boolean;
    realTimeChat: boolean;
    integrations: boolean;
    advancedReporting: boolean;
    aiAssistant: boolean;
  };
  
  // Limits
  limits: {
    maxProjectMembers: number;
    maxFileSize: number; // in MB
    maxProjects: number;
    maxTasksPerProject: number;
    storageLimit: number; // in MB
  };
  
  // Security
  security: {
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
    sessionTimeout: number; // in minutes
    maxLoginAttempts: number;
    twoFactorRequired: boolean;
  };
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  inApp: boolean;
  digest: 'disabled' | 'daily' | 'weekly';
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string; // HH:mm
  };
}

class SettingsService {
  /**
   * Get user preferences
   */
  async getUserPreferences(): Promise<UserPreferences> {
    try {
      const response = await apiClient.get('/users/preferences');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      // Return default preferences if not found
      return this.getDefaultPreferences();
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    try {
      const response = await apiClient.put('/users/preferences', preferences);
      return response.data.data;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }

  /**
   * Reset user preferences to defaults
   */
  async resetUserPreferences(): Promise<UserPreferences> {
    try {
      const response = await apiClient.post('/users/preferences/reset');
      return response.data.data;
    } catch (error) {
      console.error('Error resetting user preferences:', error);
      throw error;
    }
  }

  /**
   * Get system settings (admin only)
   */
  async getSystemSettings(): Promise<SystemSettings> {
    try {
      const response = await apiClient.get('/settings/system');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching system settings:', error);
      throw error;
    }
  }

  /**
   * Update system settings (admin only)
   */
  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    try {
      const response = await apiClient.put('/settings/system', settings);
      return response.data.data;
    } catch (error) {
      console.error('Error updating system settings:', error);
      throw error;
    }
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const response = await apiClient.get('/users/notification-settings');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      throw error;
    }
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    try {
      const response = await apiClient.put('/users/notification-settings', settings);
      return response.data.data;
    } catch (error) {
      console.error('Error updating notification settings:', error);
      throw error;
    }
  }

  /**
   * Export user data (GDPR compliance)
   */
  async exportUserData(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    try {
      const response = await apiClient.get(`/users/export?format=${format}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw error;
    }
  }

  /**
   * Delete user account
   */
  async deleteUserAccount(password: string): Promise<void> {
    try {
      await apiClient.delete('/users/account', {
        data: { password }
      });
    } catch (error) {
      console.error('Error deleting user account:', error);
      throw error;
    }
  }

  /**
   * Get available timezones
   */
  async getTimezones(): Promise<{ value: string; label: string; offset: string }[]> {
    try {
      const response = await apiClient.get('/settings/timezones');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching timezones:', error);
      // Return common timezones as fallback
      return this.getCommonTimezones();
    }
  }

  /**
   * Get available languages
   */
  async getLanguages(): Promise<{ code: string; name: string; nativeName: string }[]> {
    try {
      const response = await apiClient.get('/settings/languages');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching languages:', error);
      // Return default languages as fallback
      return this.getDefaultLanguages();
    }
  }

  /**
   * Test notification settings
   */
  async testNotification(type: 'email' | 'push'): Promise<void> {
    try {
      await apiClient.post('/users/test-notification', { type });
    } catch (error) {
      console.error('Error testing notification:', error);
      throw error;
    }
  }

  /**
   * Enable/disable two-factor authentication
   */
  async toggleTwoFactor(enabled: boolean, password?: string): Promise<{ secret?: string; qrCode?: string }> {
    try {
      const response = await apiClient.post('/auth/two-factor/toggle', {
        enabled,
        password
      });
      return response.data.data;
    } catch (error) {
      console.error('Error toggling two-factor authentication:', error);
      throw error;
    }
  }

  /**
   * Get user's activity log
   */
  async getUserActivityLog(page: number = 1, limit: number = 20): Promise<{
    activities: any[];
    pagination: any;
  }> {
    try {
      const response = await apiClient.get(`/users/activity-log?page=${page}&limit=${limit}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching user activity log:', error);
      throw error;
    }
  }

  /**
   * Clear user activity log
   */
  async clearActivityLog(): Promise<void> {
    try {
      await apiClient.delete('/users/activity-log');
    } catch (error) {
      console.error('Error clearing activity log:', error);
      throw error;
    }
  }

  /**
   * Get keyboard shortcuts
   */
  getKeyboardShortcuts(): { [key: string]: string } {
    return {
      'Ctrl+N': 'Create new task',
      'Ctrl+P': 'Create new project',
      'Ctrl+K': 'Quick search',
      'Ctrl+Shift+K': 'Command palette',
      'Ctrl+B': 'Toggle sidebar',
      'Ctrl+/': 'Show keyboard shortcuts',
      'Esc': 'Close modals/dialogs',
      'Tab': 'Navigate forward',
      'Shift+Tab': 'Navigate backward',
      'Enter': 'Confirm action',
      'Space': 'Toggle selection',
      'F1': 'Help',
      'F2': 'Rename',
      'Delete': 'Delete selected',
      'Ctrl+Z': 'Undo',
      'Ctrl+Y': 'Redo',
      'Ctrl+S': 'Save',
      'Ctrl+F': 'Find in page',
      'Alt+Left': 'Go back',
      'Alt+Right': 'Go forward'
    };
  }

  /**
   * Local storage helpers for client-side preferences
   */
  getLocalPreference<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(`pmt_${key}`);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  setLocalPreference<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`pmt_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error('Error storing local preference:', error);
    }
  }

  removeLocalPreference(key: string): void {
    try {
      localStorage.removeItem(`pmt_${key}`);
    } catch (error) {
      console.error('Error removing local preference:', error);
    }
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      theme: 'system',
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24h',
      emailNotifications: {
        taskAssigned: true,
        taskUpdated: true,
        taskCompleted: false,
        projectUpdated: true,
        deadlineReminder: true,
        commentAdded: true,
        mentions: true
      },
      pushNotifications: {
        taskAssigned: true,
        taskUpdated: false,
        taskCompleted: false,
        projectUpdated: false,
        deadlineReminder: true,
        commentAdded: true,
        mentions: true
      },
      defaultView: 'kanban',
      tasksPerPage: 25,
      projectsPerPage: 12,
      showCompletedTasks: false,
      showArchivedProjects: false,
      autoTimeTracking: false,
      dailyTimeGoal: 480, // 8 hours
      reminderInterval: 60, // 1 hour
      workingHours: {
        start: '09:00',
        end: '17:00',
        workingDays: [1, 2, 3, 4, 5] // Monday to Friday
      },
      profileVisibility: 'team',
      activityVisibility: 'team',
      allowMentions: true,
      twoFactorEnabled: false,
      keyboard_shortcuts: true,
      animationsEnabled: true,
      compactMode: false,
      sidebarCollapsed: false
    };
  }

  /**
   * Get common timezones
   */
  private getCommonTimezones(): { value: string; label: string; offset: string }[] {
    return [
      { value: 'UTC', label: 'UTC - Coordinated Universal Time', offset: '+00:00' },
      { value: 'America/New_York', label: 'Eastern Time (US & Canada)', offset: '-05:00' },
      { value: 'America/Chicago', label: 'Central Time (US & Canada)', offset: '-06:00' },
      { value: 'America/Denver', label: 'Mountain Time (US & Canada)', offset: '-07:00' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)', offset: '-08:00' },
      { value: 'Europe/London', label: 'London', offset: '+00:00' },
      { value: 'Europe/Berlin', label: 'Berlin, Frankfurt, Paris, Rome', offset: '+01:00' },
      { value: 'Europe/Athens', label: 'Athens, Bucharest, Istanbul', offset: '+02:00' },
      { value: 'Asia/Shanghai', label: 'Beijing, Shanghai', offset: '+08:00' },
      { value: 'Asia/Tokyo', label: 'Tokyo', offset: '+09:00' },
      { value: 'Australia/Sydney', label: 'Sydney', offset: '+10:00' }
    ];
  }

  /**
   * Get default languages
   */
  private getDefaultLanguages(): { code: string; name: string; nativeName: string }[] {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' }
    ];
  }
}

export const settingsService = new SettingsService();