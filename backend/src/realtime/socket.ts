import { Server } from 'socket.io';
import { verifyToken } from '../middleware/auth.js';
import { config } from '../config/config.js';
import { notificationEmitter } from '../utils/notificationUtils.js';

let io: Server | null = null;
const onlineUsers = new Map<string, Set<string>>();

const normalizeToken = (token: unknown) => {
  if (!token || typeof token !== 'string') return null;
  if (token.startsWith('Bearer ')) return token.slice(7);
  return token;
};

const emitOnlineUsers = () => {
  if (!io) return;
  io.emit('online_users', {
    users: [...onlineUsers.keys()].map((id) => Number(id)),
  });
};

const addOnlineUserSocket = (userId: string, socketId: string) => {
  const userSockets = onlineUsers.get(userId) || new Set();
  userSockets.add(socketId);
  onlineUsers.set(userId, userSockets);
};

const removeOnlineUserSocket = (userId: string, socketId: string) => {
  const userSockets = onlineUsers.get(userId);
  if (!userSockets) return false;

  userSockets.delete(socketId);
  if (!userSockets.size) {
    onlineUsers.delete(userId);
    return true;
  }

  onlineUsers.set(userId, userSockets);
  return false;
};

export const initSocketIO = (httpServer: any) => {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    try {
      const token = normalizeToken(socket.handshake.auth?.token);
      if (!token) {
        return next(new Error('Authentication token is required'));
      }

      const user = verifyToken(token);
      socket.data.user = user;
      return next();
    } catch (error) {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String((socket.data.user as any)?.id);
    const userRoom = `user_${userId}`;

    socket.join(userRoom);
    addOnlineUserSocket(userId, socket.id);

    socket.broadcast.emit('user_online', { userId: Number(userId) });
    emitOnlineUsers();

    socket.on('join_room', ({ room }: { room?: string }) => {
      if (!room || typeof room !== 'string') return;
      socket.join(room);
    });

    socket.on('leave_room', ({ room }: { room?: string }) => {
      if (!room || typeof room !== 'string') return;
      socket.leave(room);
    });

    socket.on('task_status_updated', (payload: any = {}) => {
      const { projectId } = payload;
      if (projectId) {
        io.to(`project_${projectId}`).emit('task_status_updated', payload);
      }
    });

    socket.on('task_assigned', (payload: any = {}) => {
      const { assigneeId, projectId } = payload;
      if (assigneeId) {
        io.to(`user_${assigneeId}`).emit('task_assigned', payload);
      }
      if (projectId) {
        io.to(`project_${projectId}`).emit('task_assigned', payload);
      }
    });

    socket.on('typing_start', (payload: any = {}) => {
      const { room } = payload;
      if (room) {
        socket.to(room).emit('typing_start', payload);
      }
    });

    socket.on('typing_stop', (payload: any = {}) => {
      const { room } = payload;
      if (room) {
        socket.to(room).emit('typing_stop', payload);
      }
    });

    socket.on('notification', (payload: any = {}) => {
      const { userId: targetUserId } = payload;
      if (targetUserId) {
        io.to(`user_${targetUserId}`).emit('notification', payload);
      }
    });

    socket.on('disconnect', () => {
      const userWentOffline = removeOnlineUserSocket(userId, socket.id);
      if (userWentOffline) {
        socket.broadcast.emit('user_offline', { userId: Number(userId) });
      }
      emitOnlineUsers();
    });
  });

  notificationEmitter.on('notification', ({ userId, notification }) => {
    if (!io) return;

    io.to(`user_${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  });

  return io;
};

export const getIO = () => io;
