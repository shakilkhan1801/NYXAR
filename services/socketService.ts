import { io, Socket } from 'socket.io-client';
import { Message, User } from '../types';

// The proxy in vite.config.ts will forward relative paths to port 5000
const SERVER_URL = ''; 

class SocketService {
  socket: Socket | null = null;

  connect(userData: { id: string, username: string, publicKey: any, avatarUrl: string }) {
    // We point to the same origin, relying on the proxy to handle /socket.io/ request
    this.socket = io({
      path: '/socket.io', // Standard Socket.io path
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket Connected via Proxy');
      this.socket?.emit('register', userData);
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ Socket Connection Error:', err.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendMessage(receiverId: string, message: any) {
    if (this.socket) {
      this.socket.emit('private_message', { receiverId, message });
    } else {
      console.warn("Socket not connected, cannot send message");
    }
  }

  sendSignal(targetId: string, signalData: any) {
    if (this.socket) {
        this.socket.emit('signal', { targetId, signalData });
    }
  }

  sendTyping(receiverId: string) {
      if (this.socket) {
          this.socket.emit('typing', { receiverId });
      }
  }

  async fetchUsers(): Promise<User[]> {
      try {
          const res = await fetch(`/api/users`);
          if (!res.ok) throw new Error(`Server error: ${res.status}`);
          return await res.json();
      } catch (e) {
          console.error("API Error fetching users:", e);
          return [];
      }
  }
}

export const socketService = new SocketService();