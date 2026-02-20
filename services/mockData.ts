import { User, ChatSession } from '../types';

export const MOCK_USERS: User[] = [
  {
    id: 'user_bob',
    username: 'Bob_The_Builder',
    publicKey: {} as JsonWebKey,
    avatarUrl: 'https://picsum.photos/id/64/200/200',
    isAi: false
  },
  {
    id: 'user_alice',
    username: 'Alice_Wonder',
    publicKey: {} as JsonWebKey,
    avatarUrl: 'https://picsum.photos/id/65/200/200',
    isAi: false
  },
  {
    id: 'group_project',
    username: 'Project Alpha Team',
    publicKey: {} as JsonWebKey,
    avatarUrl: 'https://picsum.photos/id/180/200/200',
    isAi: false
  }
];

export const MOCK_CHATS: ChatSession[] = [
  {
    userId: 'user_bob',
    username: 'Bob_The_Builder',
    lastMessage: 'Did you get the blueprints?',
    lastMessageTime: Date.now() - 1000 * 60 * 5,
    unreadCount: 2,
    avatarUrl: 'https://picsum.photos/id/64/200/200',
    folder: 'work',
    isPinned: true
  },
  {
    userId: 'user_alice',
    username: 'Alice_Wonder',
    lastMessage: 'Lunch tomorrow?',
    lastMessageTime: Date.now() - 1000 * 60 * 60 * 24,
    unreadCount: 0,
    avatarUrl: 'https://picsum.photos/id/65/200/200',
    folder: 'personal'
  },
  {
    userId: 'group_project',
    username: 'Project Alpha Team',
    lastMessage: 'Alice: File uploaded.',
    lastMessageTime: Date.now() - 1000 * 60 * 30,
    unreadCount: 5,
    avatarUrl: 'https://picsum.photos/id/180/200/200',
    isGroup: true,
    folder: 'groups'
  }
];