import { apiClient } from './api';
import type { 
  AuthResponse, 
  LoginRequest, 
  RegisterRequest, 
  User 
} from '../types';

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
}

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
      // Don't throw error on logout - just log it silently
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

  async verifyToken(): Promise<{ valid: boolean; user?: User }> {
    const response = await apiClient.get<{ valid: boolean; user?: User }>('/auth/verify');
    
    if (!response.success) {
      throw new Error(response.message || 'Token verification failed');
    }
    
    return response.data || { valid: false };
  },

  async sendEmailVerification(): Promise<void> {
    const response = await apiClient.post('/auth/send-verification');
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to send verification email');
    }
  },

  async requestPasswordReset(email: string): Promise<void> {
    const response = await apiClient.post('/auth/request-password-reset', { email });
    
    if (!response.success) {
      throw new Error(response.message || 'Password reset request failed');
    }
  },

  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    const response = await apiClient.put<User>('/auth/update-profile', data);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Profile update failed');
    }
    
    return response.data;
  },

  async updatePassword(data: UpdatePasswordRequest): Promise<void> {
    const response = await apiClient.put('/auth/update-password', data);
    
    if (!response.success) {
      throw new Error(response.message || 'Password update failed');
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.updatePassword({ currentPassword, newPassword });
  }
};

export default authService;