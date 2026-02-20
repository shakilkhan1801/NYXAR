
export interface User {
  id: string;
  username: string;
  publicKey: JsonWebKey; 
  avatarUrl?: string;
  isAi?: boolean; 
  bio?: string;
  isOnline?: boolean;
}

export interface UserSettings {
  // --- Category: Privacy & Identity ---
  readReceipts: boolean;
  onlineStatus: boolean;
  incognitoKeyboard: boolean;
  burnOnRead: boolean;
  
  // --- Category: Stealth & Disguise ---
  appDisguise: boolean; // Calculator Mode
  disguisePin?: string; 
  decoyNotifications: boolean;
  duressPassword?: string;
  shakeToLock: boolean;

  // --- Category: Network & Security ---
  biometricLock: boolean;
  torProxy: boolean;
  meshNetworking: boolean;
  deadMansSwitch: boolean;
  deadMansTimerDays: number;
  ipRelaying: boolean; // Mask IP Address via Relay
  biometricAnswer: boolean; // Require Auth to Answer Call
  
  // --- Category: Connections & Discovery (NEW) ---
  publicDiscovery: boolean; // Allow finding by ID
  allowAcousticHandshake: boolean; // Data over sound
  allowNfcPairing: boolean; // Physical tap
  allowBleBeacon: boolean; // Bluetooth Low Energy Discovery
  
  // --- Category: Spy Tools ---
  voiceChanger: boolean;
  metadataScrubbing: boolean;
  screenPrivacy: boolean; 
  intruderSelfie: boolean;
  callFaceBlur: boolean; // Auto-blur face in video calls
  lowBandwidthMode: boolean; // Optimize for slow networks
  
  // --- UI Preferences ---
  wallpaper: string; 
}

export interface PrivateIdentity {
  id: string;
  username: string;
  keyPair: CryptoKeyPair;
  recoveryPhrase: string;
  bio?: string; 
  settings: UserSettings;
  blockedUsers: string[];
  lastActive?: number; 
}

export type MessageType = 'text' | 'image' | 'audio' | 'file' | 'call_signal' | 'location' | 'poll' | 'steganography' | 'geo_locked';

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; 
}

export interface EncryptedMessage {
  id: string;
  senderId: string;
  receiverId: string;
  encryptedKey: string; 
  encryptedContent: string; 
  iv: string; 
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
  type: MessageType; 
  expiresAt?: number; 
  fileName?: string; 
  isEdited?: boolean;
  reactions?: Record<string, string>; 
  pollData?: { question: string; options: PollOption[] };
  scheduledFor?: number; 
  isBurnOnRead?: boolean; 
  isDistortedAudio?: boolean;
  callType?: 'audio' | 'video'; // NEW: Track call type
  mediaDuration?: number; // NEW: Track duration in seconds
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string; 
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
  isSystem?: boolean;
  type: MessageType;
  fileName?: string;
  expiresAt?: number;
  isEdited?: boolean;
  reactions?: Record<string, string>;
  pollData?: { question: string; options: PollOption[] };
  scheduledFor?: number;
  isBurnOnRead?: boolean;
  isDistortedAudio?: boolean;
  callType?: 'audio' | 'video'; // NEW
  mediaDuration?: number; // NEW
}

export interface SecureNote {
    id: string;
    title: string;
    content: string; 
    timestamp: number;
    isIntruderAlert?: boolean; 
}

export type ChatFolder = 'all' | 'work' | 'personal' | 'groups';

export interface ChatSession {
  userId: string;
  username: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
  isAi?: boolean;
  avatarUrl?: string;
  isDisappearing?: boolean;
  isPinned?: boolean; 
  folder?: ChatFolder; 
  isGroup?: boolean; 
}

export enum AppView {
  ONBOARDING = 'ONBOARDING',
  MAIN = 'MAIN',
  SETTINGS = 'SETTINGS',
  LOCKED = 'LOCKED',
  VAULT = 'VAULT',      
  CALCULATOR = 'CALCULATOR' 
}

export interface SignalData {
  callId: string; // UNIQUE SESSION ID FOR CALL
  timestamp: number; // Time sent to prevent old calls arriving late
  type: 'offer' | 'answer' | 'candidate' | 'bye';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  isVideo: boolean;
  duration?: number; 
  reason?: 'hangup' | 'reject' | 'cancel' | 'busy'; 
}

export enum CallState {
  IDLE = 'IDLE',
  RINGING = 'RINGING', 
  CALLING = 'CALLING', 
  CONNECTED = 'CONNECTED',
  ENDED = 'ENDED'
}

export type ThemeMode = 'nyxar-dark' | 'light' | 'midnight' | 'cyberpunk' | 'matrix' | 'dracula' | 'royal' | 'sunset';

export interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}
