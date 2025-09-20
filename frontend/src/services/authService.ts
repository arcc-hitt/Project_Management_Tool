import { apiClient } from './api';
import type { 
  AuthResponse, 
  LoginRequest, 
  RegisterRequest, 
  User 
} from '../types';

export const authService = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Login failed');
    }
    
    return response.data;
  },

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', userData);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Registration failed');
    }
    
    return response.data;
  },

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me');
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get user data');
    }
    
    return response.data;
  },

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const response = await apiClient.post<{ accessToken: string }>('/auth/refresh', {
      refreshToken
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Token refresh failed');
    }
    
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Don't throw error on logout - just log it
      console.error('Logout API call failed:', error);
    }
  },

  async verifyEmail(token: string): Promise<void> {
    const response = await apiClient.post('/auth/verify-email', { token });
    
    if (!response.success) {
      throw new Error(response.message || 'Email verification failed');
    }
  },

  async forgotPassword(email: string): Promise<void> {
    const response = await apiClient.post('/auth/forgot-password', { email });
    
    if (!response.success) {
      throw new Error(response.message || 'Password reset request failed');
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await apiClient.post('/auth/reset-password', {
      token,
      newPassword
    });
    
    if (!response.success) {
      throw new Error(response.message || 'Password reset failed');
    }
  },

  async updateProfile(userData: Partial<User>): Promise<User> {
    const response = await apiClient.put<User>('/auth/profile', userData);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Profile update failed');
    }
    
    return response.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword
    });
    
    if (!response.success) {
      throw new Error(response.message || 'Password change failed');
    }
  }
};

export default authService;