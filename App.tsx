import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, Lock, Unlock, Send, MoreVertical, 
  Settings, Phone, Video, Search, Menu, 
  Check, CheckCheck, RefreshCw, Key, 
  User as UserIcon, LogOut, Bot, Mic, MicOff, VideoOff, PhoneOff,
  Clock, Calendar, FileText, Paperclip, Image as ImageIcon, File, X, Trash2, Ban, StopCircle, Fingerprint,
  MapPin, Smile, Edit2, Vote, Pin, Briefcase, Home, Users, AlertTriangle, CalendarClock, ExternalLink,
  Calculator, Vault as VaultIcon, Plus, EyeOff, Radio, Flame, Ghost, Globe, Mic2, Navigation, 
  Camera, MessageSquareDashed, Scissors, Zap, ShieldCheck, Activity, Eye, ScanFace, Server as ServerIcon,
  Volume2, ChevronRight, ListChecks, ChevronLeft, Download, Maximize2, Minimize2, Play, Pause, PhoneIncoming, PhoneMissed, PhoneOutgoing, ArrowDownLeft, ArrowUpRight, Ban as BanIcon, Upload, FileJson
} from 'lucide-react';
import { 
  generateIdentity, 
  exportPublicKey, 
  exportPrivateKey,
  importPublicKey,
  importPrivateKey,
  encryptMessage, 
  decryptMessage, 
  generateRecoveryPhrase,
  deserializeIdentity 
} from './services/cryptoService';
import { User, PrivateIdentity, Message, EncryptedMessage, AppView, CallState, SignalData, UserSettings, MessageType, ChatFolder, PollOption, SecureNote } from './types';
import { webRTC } from './services/webrtcService';
import { socketService } from './services/socketService';
import { formatTime, formatChatListDate, getMessageDateLabel, formatFullDate } from './utils/dateUtils';

import SettingsView from './components/SettingsView';
import { ThemeProvider } from './contexts/ThemeContext';

// --- UTILS ---

const STORAGE_KEY = 'nyxar_identity_v1';
const MSG_STORAGE_KEY = 'nyxar_messages_v1';

// Polyfill for UUID generation
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// --- RINGTONE SERVICE (WEB AUDIO API) ---
class RingtoneService {
    audioCtx: AudioContext | null = null;
    oscillator: OscillatorNode | null = null;
    gainNode: GainNode | null = null;
    intervalId: any = null;

    private initCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    playIncoming() {
        this.stop();
        this.initCtx();
        if(!this.audioCtx) return;

        const playBeep = () => {
             const osc = this.audioCtx!.createOscillator();
             const gain = this.audioCtx!.createGain();
             osc.connect(gain);
             gain.connect(this.audioCtx!.destination);
             
             osc.type = 'square';
             osc.frequency.setValueAtTime(800, this.audioCtx!.currentTime);
             osc.frequency.setValueAtTime(600, this.audioCtx!.currentTime + 0.1);
             
             gain.gain.setValueAtTime(0.1, this.audioCtx!.currentTime);
             gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx!.currentTime + 0.5);
             
             osc.start();
             osc.stop(this.audioCtx!.currentTime + 0.5);
        };

        playBeep();
        this.intervalId = setInterval(() => {
            playBeep();
            setTimeout(playBeep, 600); 
        }, 2000);
    }

    playOutgoing() {
        this.stop();
        this.initCtx();
        if(!this.audioCtx) return;

        const playTone = () => {
            const osc = this.audioCtx!.createOscillator();
            const gain = this.audioCtx!.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx!.destination);

            osc.type = 'sine';
            osc.frequency.value = 440; // A4
            
            gain.gain.setValueAtTime(0.05, this.audioCtx!.currentTime);
            gain.gain.linearRampToValueAtTime(0.05, this.audioCtx!.currentTime + 0.8);
            gain.gain.linearRampToValueAtTime(0, this.audioCtx!.currentTime + 0.81);

            osc.start();
            osc.stop(this.audioCtx!.currentTime + 1.5);
        };

        playTone();
        this.intervalId = setInterval(playTone, 2000);
    }

    stop() {
        if (this.intervalId) clearInterval(this.intervalId);
        if (this.oscillator) {
            try { this.oscillator.stop(); } catch(e){}
            this.oscillator.disconnect();
        }
    }
}

const ringtoneService = new RingtoneService();


// --- COMPONENT: PREMIUM VOICE MESSAGE PLAYER ---
const VoiceMessagePlayer = ({ src, durationLabel, isMe }: { src: string, durationLabel?: string, isMe?: boolean }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(e => {
                    console.error("Playback failed", e);
                    setIsPlaying(false);
                });
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
            setProgress(p || 0);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
    };

    return (
        <div className={`flex items-center gap-3 min-w-[200px] p-2 pr-3 rounded-full transition-all border ${isMe ? 'bg-black/20 border-white/20 text-white' : 'bg-nyx-bg/50 border-nyx-border/50 text-nyx-text'}`}>
            <button 
                onClick={togglePlay}
                className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full transition-all shadow-sm active:scale-95 
                ${isMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-nyx-accent text-white hover:bg-nyx-accentHover'}`}
            >
                {isPlaying ? <Pause className="w-4 h-4 fill-current"/> : <Play className="w-4 h-4 fill-current ml-0.5"/>}
            </button>
            
            <div className="flex-1 flex flex-col justify-center gap-1">
                {/* Visualizer Bars */}
                <div className="h-5 flex items-center gap-[2px] opacity-90 overflow-hidden">
                    {[...Array(30)].map((_, i) => (
                         <div 
                            key={i} 
                            className={`w-[3px] rounded-full transition-all duration-300 ${i/30 * 100 < progress ? (isMe ? 'bg-white' : 'bg-nyx-accent') : (isMe ? 'bg-white/30' : 'bg-nyx-muted/30')}`}
                            style={{ 
                                height: isPlaying ? `${Math.max(20, Math.random() * 100)}%` : '30%',
                                animationDelay: `${i * 0.05}s`
                            }}
                        ></div>
                    ))}
                </div>
            </div>
             <span className="text-[10px] font-mono opacity-80 min-w-[30px] text-right">{durationLabel || '0:00'}</span>
            
            <audio 
                ref={audioRef} 
                src={src} 
                onTimeUpdate={handleTimeUpdate} 
                onEnded={handleEnded} 
                className="hidden" 
            />
        </div>
    );
};


// --- CALCULATOR COMPONENT ---
const CalculatorView = ({ onUnlock, onIntruderAttempt }: { onUnlock: () => void, onIntruderAttempt: () => void }) => {
   // ... (No Changes to Calculator)
    const [display, setDisplay] = useState('0');
    const [pinBuffer, setPinBuffer] = useState('');
    const [attempts, setAttempts] = useState(0);

    const handlePress = (val: string) => {
        if(val === 'C') { setDisplay('0'); setPinBuffer(''); return; }
        if(val === '=') { 
            onUnlock(); 
            return;
        }
        const newDisplay = display === '0' ? val : display + val;
        setDisplay(newDisplay);
        const newBuffer = pinBuffer + val;
        setPinBuffer(newBuffer);
    };
    
    const verifyPinInternal = () => {
       if (display !== '1234') { 
           setAttempts(prev => prev + 1);
           if (attempts >= 2) onIntruderAttempt();
           setDisplay('Error');
           setTimeout(() => setDisplay('0'), 1000);
           setPinBuffer('');
       } else {
           onUnlock();
       }
    }

    return (
        <div className="h-screen w-screen bg-black flex flex-col items-center justify-end pb-12">
            <div className="w-full max-w-sm px-6">
                <div className="text-white text-6xl font-light text-right mb-8 truncate">{display}</div>
                <div className="grid grid-cols-4 gap-4">
                    {['C','±','%','÷','7','8','9','×','4','5','6','-','1','2','3','+','0','.','='].map(btn => (
                        <button 
                            key={btn}
                            onClick={() => btn === '=' ? verifyPinInternal() : handlePress(btn)}
                            className={`h-20 w-20 rounded-full text-3xl font-medium transition active:opacity-70 flex items-center justify-center 
                            ${btn === '0' ? 'col-span-2 w-full text-left pl-8 justify-start' : ''}
                            ${['÷','×','-','+','='].includes(btn) ? 'bg-orange-500 text-white' : (['C','±','%'].includes(btn) ? 'bg-gray-400 text-black' : 'bg-gray-800 text-white')}
                            `}
                        >
                            {btn}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

// --- SECURE VAULT COMPONENT ---
const SecureVaultView = ({ onBack, notes, onAddNote }: { onBack: () => void, notes: SecureNote[], onAddNote: (n: SecureNote) => void }) => {
   // ... (No Changes to Vault)
    const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');

    const handleSave = () => {
        if(!newTitle.trim()) return;
        onAddNote({
            id: generateUUID(),
            title: newTitle,
            content: newContent,
            timestamp: Date.now()
        });
        setNewTitle('');
        setNewContent('');
        setViewMode('list');
    };

    return (
        <div className="h-full bg-nyx-bg text-nyx-text flex flex-col">
            <header className="h-16 border-b border-nyx-border flex items-center justify-between px-6 bg-nyx-sidebar">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-nyx-border rounded-full"><X className="w-5 h-5"/></button>
                    <div className="flex items-center gap-2">
                        <VaultIcon className="w-5 h-5 text-nyx-secondary"/>
                        <span className="font-bold text-lg">Secure Vault</span>
                    </div>
                </div>
                {viewMode === 'list' && <button onClick={() => setViewMode('create')} className="p-2 bg-nyx-accent rounded-full text-white"><Plus className="w-5 h-5"/></button>}
            </header>

            <div className="flex-1 p-6 overflow-y-auto">
                {viewMode === 'list' ? (
                    <div className="grid gap-4">
                        {notes.length === 0 ? (
                            <div className="text-center text-nyx-muted mt-20">
                                <VaultIcon className="w-16 h-16 mx-auto mb-4 opacity-20"/>
                                <p>Vault is empty.</p>
                            </div>
                        ) : (
                            notes.map(note => (
                                <div key={note.id} className={`bg-nyx-card border p-4 rounded-xl hover:border-nyx-accent transition cursor-pointer ${note.isIntruderAlert ? 'border-red-500/50 bg-red-900/10' : 'border-nyx-border'}`}>
                                    <h3 className="font-bold mb-1 flex items-center gap-2">
                                        {note.isIntruderAlert && <Camera className="w-4 h-4 text-red-500"/>}
                                        {note.title}
                                    </h3>
                                    <p className="text-sm text-nyx-muted line-clamp-2">{note.content}</p>
                                    <div className="text-[10px] text-nyx-muted mt-2 text-right">{formatTime(note.timestamp)}</div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col h-full gap-4 max-w-2xl mx-auto">
                        <input type="text" placeholder="Note Title" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="bg-transparent text-2xl font-bold outline-none placeholder-nyx-muted/50" autoFocus />
                        <textarea placeholder="Write encrypted note..." value={newContent} onChange={e => setNewContent(e.target.value)} className="flex-1 bg-transparent resize-none outline-none font-mono text-sm leading-relaxed placeholder-nyx-muted/50" />
                        <button onClick={handleSave} className="w-full py-3 bg-nyx-accent text-white font-bold rounded-xl">Encrypt & Save</button>
                    </div>
                )}
            </div>
        </div>
    )
}

// --- PREMIUM SECURE CALL INTERFACE ---
const SecureCallInterface = ({ 
    activeChatUser, 
    isVideo, 
    callState,
    onEnd, 
    identity 
}: { 
    activeChatUser: User | null, 
    isVideo: boolean, 
    callState: CallState,
    onEnd: (duration: number) => void,
    identity: PrivateIdentity
}) => {
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [faceBlurActive, setFaceBlurActive] = useState(identity.settings.callFaceBlur);
    const [connectionTime, setConnectionTime] = useState(0);
    const [audioVolume, setAudioVolume] = useState(0); 
    const [videoResolution, setVideoResolution] = useState<'480p' | '720p' | '1080p'>('720p');
    const [showSettings, setShowSettings] = useState(false);
    const [isPiP, setIsPiP] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null); 
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const blurFrameRef = useRef<number | null>(null);

    const isConnected = callState === CallState.CONNECTED;

    useEffect(() => {
        let timer: any;
        if (isConnected) {
            timer = setInterval(() => setConnectionTime(c => c + 1), 1000);
        }
        return () => clearInterval(timer);
    }, [isConnected]);

    // --- REAL-TIME FACE BLUR PROCESSING ---
    useEffect(() => {
        if (!isConnected || !isVideo || !webRTC.peerConnection) return;

        const processBlur = () => {
             if (!localVideoRef.current || !blurCanvasRef.current) return;
             
             const video = localVideoRef.current;
             const canvas = blurCanvasRef.current;
             const ctx = canvas.getContext('2d', { alpha: false });
             
             if (!ctx || video.readyState < 2) {
                 blurFrameRef.current = requestAnimationFrame(processBlur);
                 return;
             }

             // Match dimensions
             if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                 canvas.width = video.videoWidth;
                 canvas.height = video.videoHeight;
             }

             // Draw and Blur
             ctx.filter = 'blur(15px)';
             ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
             
             // Continue loop
             blurFrameRef.current = requestAnimationFrame(processBlur);
        };

        const enableBlur = async () => {
            if (faceBlurActive) {
                // 1. Create Canvas
                if (!blurCanvasRef.current) {
                    blurCanvasRef.current = document.createElement('canvas');
                }
                
                // 2. Start Processing Loop
                processBlur();

                // 3. Capture Stream from Canvas
                const canvasStream = blurCanvasRef.current.captureStream(30);
                const blurredTrack = canvasStream.getVideoTracks()[0];

                // 4. Replace Sender Track
                const senders = webRTC.peerConnection?.getSenders();
                const videoSender = senders?.find(s => s.track?.kind === 'video');
                if (videoSender && blurredTrack) {
                    await videoSender.replaceTrack(blurredTrack);
                }
            } else {
                // RESTORE ORIGINAL TRACK
                if (blurFrameRef.current) cancelAnimationFrame(blurFrameRef.current);
                
                const originalTrack = webRTC.localStream?.getVideoTracks()[0];
                const senders = webRTC.peerConnection?.getSenders();
                const videoSender = senders?.find(s => s.track?.kind === 'video');
                
                if (videoSender && originalTrack) {
                    await videoSender.replaceTrack(originalTrack);
                }
            }
        };

        enableBlur();

        return () => {
            if (blurFrameRef.current) cancelAnimationFrame(blurFrameRef.current);
        };
    }, [faceBlurActive, isConnected, isVideo]);

    // --- STREAM HANDLING ---
    useEffect(() => {
        if (!isConnected) return; 

        const checkLocalStream = () => {
             if (webRTC.localStream && localVideoRef.current && localVideoRef.current.srcObject !== webRTC.localStream) {
                 localVideoRef.current.srcObject = webRTC.localStream;
                 localVideoRef.current.play().catch(e => console.warn("Local play failed", e));
             }
        };
        
        const attachRemoteStream = (stream: MediaStream) => {
            if (remoteVideoRef.current && isVideo) {
                remoteVideoRef.current.srcObject = stream;
                remoteVideoRef.current.play().catch(e => console.error("Video AutoPlay failed", e));
            } 
            if (audioRef.current) {
                audioRef.current.srcObject = stream;
                audioRef.current.play().catch(e => console.error("Audio AutoPlay failed", e));
            }
            
            // Audio Visualizer
            if (!analyserRef.current) {
                 try {
                    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const source = audioCtx.createMediaStreamSource(stream);
                    const analyser = audioCtx.createAnalyser();
                    analyser.fftSize = 64;
                    source.connect(analyser);
                    analyserRef.current = analyser;
                    
                    const updateVolume = () => {
                        const dataArray = new Uint8Array(analyser.frequencyBinCount);
                        analyser.getByteFrequencyData(dataArray);
                        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                        setAudioVolume(avg);
                        animationFrameRef.current = requestAnimationFrame(updateVolume);
                    };
                    updateVolume();
                 } catch(e) { console.error(e); }
            }
        };

        checkLocalStream();
        if (webRTC.remoteStream) attachRemoteStream(webRTC.remoteStream);

        webRTC.onRemoteStreamCallback = attachRemoteStream;
        const interval = setInterval(checkLocalStream, 1000);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            clearInterval(interval);
            webRTC.onRemoteStreamCallback = null;
        };
    }, [isVideo, isConnected]);

    const toggleAudio = () => {
        if(webRTC.localStream) {
            const newState = !isMuted;
            webRTC.localStream.getAudioTracks().forEach(t => t.enabled = !newState);
            setIsMuted(newState);
        }
    };

    const toggleVideo = () => {
        if(webRTC.localStream) {
            const newState = !isVideoOff;
            webRTC.localStream.getVideoTracks().forEach(t => t.enabled = !newState);
            setIsVideoOff(newState);
        }
    };

    const changeResolution = async (res: '480p' | '720p' | '1080p') => {
        if (!webRTC.localStream) return;
        const videoTrack = webRTC.localStream.getVideoTracks()[0];
        if (!videoTrack) return;

        let constraints: any = {};
        switch (res) {
            case '480p': constraints = { width: 640, height: 480 }; break;
            case '720p': constraints = { width: 1280, height: 720 }; break;
            case '1080p': constraints = { width: 1920, height: 1080 }; break;
        }

        try {
            await videoTrack.applyConstraints(constraints);
            setVideoResolution(res);
            setShowSettings(false);
        } catch (e) {
            console.error("Failed to change resolution", e);
            alert("Camera does not support this resolution.");
        }
    };

    const handleEndCall = () => {
        onEnd(connectionTime);
    };

    const formatDuration = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!activeChatUser) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-zinc-900 flex flex-col items-center justify-between text-white overflow-hidden animate-in fade-in duration-300">
            <audio ref={audioRef} autoPlay playsInline className="hidden" />

            {/* BACKGROUND LAYER */}
            <div className="absolute inset-0 z-0">
                {isConnected && isVideo ? (
                    <div className="relative w-full h-full">
                        <video 
                            ref={remoteVideoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-cover" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none"></div>
                        
                        {/* Network Quality Indicator */}
                        <div className="absolute top-20 right-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                            <Activity className="w-3 h-3 text-green-400" />
                            <span className="text-[10px] font-mono text-white/80">{videoResolution}</span>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-zinc-900 to-black"></div>
                        
                        {/* CALLING / CONNECTED VISUALIZATION */}
                        <div 
                            className={`absolute border border-nyx-accent/30 rounded-full transition-all duration-75 ${!isConnected ? 'animate-ping' : ''}`}
                            style={{ 
                                width: `${300 + audioVolume * 5}px`, 
                                height: `${300 + audioVolume * 5}px`,
                                opacity: isConnected ? Math.min(0.5, audioVolume / 100) : 0.3
                            }}
                        ></div>

                        <div className="relative z-10 flex flex-col items-center animate-in zoom-in duration-500">
                            <div 
                                className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-nyx-accent to-nyx-secondary shadow-[0_0_40px_rgba(6,182,212,0.4)] mb-6 transition-transform duration-75"
                                style={{ transform: `scale(${1 + (audioVolume / 200)})` }}
                            >
                                <img src={activeChatUser.avatarUrl} className="w-full h-full rounded-full object-cover border-4 border-black" />
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight">{activeChatUser.username}</h2>
                            <p className="text-nyx-accent font-mono mt-2 animate-pulse flex items-center gap-2">
                                {isConnected ? (
                                    <> <Activity className="w-4 h-4" /> SECURE VOICE ENCRYPTED </>
                                ) : (
                                    <span className="text-white/70">Calling...</span>
                                )}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* PiP LOCAL VIDEO */}
            {isConnected && isVideo && !isVideoOff && (
                <div 
                    className={`absolute z-20 transition-all duration-300 cursor-pointer shadow-2xl border-2 border-white/20 overflow-hidden group
                        ${isPiP ? 'top-4 left-4 w-24 h-32 rounded-lg' : 'bottom-32 right-4 w-32 h-48 rounded-xl'}
                    `}
                    onClick={() => setIsPiP(!isPiP)}
                >
                    <video 
                        ref={localVideoRef} 
                        autoPlay 
                        muted 
                        playsInline 
                        className={`w-full h-full object-cover ${faceBlurActive ? 'blur-md' : ''}`} 
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                    </div>
                </div>
            )}

            {/* TOP BAR - SLIM & PREMIUM */}
            <div className="absolute top-0 left-0 right-0 p-6 z-10 flex justify-between items-start pointer-events-none">
                <div className="flex flex-col pointer-events-auto">
                    <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 shadow-lg">
                        <Lock className="w-3 h-3 text-green-400" />
                        <span className="text-xs font-bold tracking-wider text-white/90">E2EE</span>
                        {isConnected && (
                            <>
                                <div className="w-px h-3 bg-white/20"></div>
                                <span className="font-mono text-xs text-white/80 tracking-widest">
                                    {formatDuration(connectionTime)}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* SETTINGS MENU - ICON ONLY */}
                <div className="relative pointer-events-auto">
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2.5 bg-black/40 backdrop-blur-xl rounded-full hover:bg-white/10 transition border border-white/10 shadow-lg active:scale-95"
                    >
                        <Settings className="w-5 h-5 text-white/90" />
                    </button>
                    
                    {showSettings && (
                        <div className="absolute top-12 right-0 w-48 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl animate-in slide-in-from-top-2 origin-top-right">
                            <h3 className="text-[10px] font-bold text-white/40 mb-2 uppercase tracking-wider px-1">Resolution</h3>
                            <div className="space-y-1">
                                {(['480p', '720p', '1080p'] as const).map(res => (
                                    <button
                                        key={res}
                                        onClick={() => changeResolution(res)}
                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg transition flex items-center justify-between ${videoResolution === res ? 'bg-nyx-accent text-white' : 'hover:bg-white/10 text-white/70'}`}
                                    >
                                        {res}
                                        {videoResolution === res && <Check className="w-3 h-3"/>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* BOTTOM CONTROLS */}
            <div className="absolute bottom-0 left-0 right-0 p-8 z-10 flex justify-center items-end gap-6 pointer-events-auto bg-gradient-to-t from-black/90 via-black/50 to-transparent pb-12">
                
                {/* Face Blur Toggle (Separate Section) */}
                {isConnected && isVideo && (
                    <button 
                        onClick={() => setFaceBlurActive(!faceBlurActive)}
                        className={`absolute bottom-12 left-8 p-3 rounded-full backdrop-blur-md border transition-all duration-300 shadow-lg
                            ${faceBlurActive ? 'bg-nyx-accent text-white border-nyx-accent' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}
                        `}
                        title="Toggle Face Blur"
                    >
                        <ScanFace className="w-5 h-5" />
                    </button>
                )}

                <button 
                    onClick={toggleAudio}
                    className={`p-4 rounded-full backdrop-blur-md border transition-all duration-300 shadow-lg group
                        ${isMuted ? 'bg-white text-black border-white' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}
                    `}
                >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                </button>

                <button 
                    onClick={handleEndCall}
                    className="p-5 bg-red-600 text-white rounded-full shadow-red-500/50 shadow-2xl hover:bg-red-500 hover:scale-110 active:scale-95 transition-all duration-300 border-4 border-red-400/30"
                >
                    <PhoneOff className="w-8 h-8 fill-current" />
                </button>

                <button 
                    onClick={toggleVideo}
                    className={`p-4 rounded-full backdrop-blur-md border transition-all duration-300 shadow-lg group
                        ${isVideoOff ? 'bg-white text-black border-white' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}
                    `}
                >
                    {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                </button>
            </div>
        </div>
    );
};


// --- INCOMING CALL OVERLAY ---
const IncomingCallOverlay = ({ caller, isVideo, onAnswer, onReject, biometricRequired }: { caller: User, isVideo: boolean, onAnswer: () => void, onReject: () => void, biometricRequired: boolean }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center text-white">
            <div className="w-32 h-32 rounded-full border-4 border-nyx-accent/50 p-1 mb-8 animate-[pulse_1.5s_infinite] relative shadow-[0_0_50px_rgba(6,182,212,0.3)]">
                <img src={caller.avatarUrl || 'https://picsum.photos/200'} className="w-full h-full rounded-full object-cover" />
                <div className="absolute -bottom-2 -right-2 bg-nyx-card p-2 rounded-full border border-nyx-border">
                    {isVideo ? <Video className="w-6 h-6 text-nyx-accent"/> : <Phone className="w-6 h-6 text-green-500"/>}
                </div>
            </div>
            <h2 className="text-3xl font-light mb-2">{caller.username}</h2>
            <div className="text-nyx-accent font-bold tracking-widest text-sm mb-12 animate-pulse bg-nyx-accent/10 px-4 py-1 rounded-full border border-nyx-accent/20">
                INCOMING SECURE {isVideo ? 'VIDEO' : 'AUDIO'} CALL...
            </div>
            
            <div className="flex gap-16 items-center">
                <button onClick={onReject} className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center hover:scale-110 transition shadow-[0_0_30px_rgba(220,38,38,0.5)] cursor-pointer">
                    <PhoneOff className="w-8 h-8"/>
                </button>

                <button onClick={onAnswer} className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center hover:scale-110 transition shadow-[0_0_30px_rgba(34,197,94,0.5)] relative cursor-pointer">
                    <Phone className="w-10 h-10 animate-[tada_1s_infinite]"/>
                    {biometricRequired && <div className="absolute -bottom-8 text-[10px] flex items-center gap-1 text-nyx-muted"><Fingerprint className="w-3 h-3"/> Verify</div>}
                </button>
            </div>
        </div>
    )
}

const Onboarding = ({ onComplete, onRestore }: { onComplete: (username: string) => void, onRestore: (identityStr: string) => Promise<void> }) => {
    const [username, setUsername] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSecure, setIsSecure] = useState(true);
    
    // Restore States
    const [isRestoreMode, setIsRestoreMode] = useState(false);
    const [restoreInput, setRestoreInput] = useState('');
    const [restoreStatus, setRestoreStatus] = useState<'idle' | 'processing' | 'error'>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const checkSecurity = () => {
             const secure = window.isSecureContext && !!window.crypto && !!window.crypto.subtle;
             setIsSecure(secure);
        }
        checkSecurity();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) return;
        setIsGenerating(true);
        setTimeout(() => {
            onComplete(username);
        }, 800);
    };

    const handleRestoreSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!restoreInput.trim()) return;
        
        setRestoreStatus('processing');
        try {
            await onRestore(restoreInput);
            // Parent handles redirect
        } catch(e) {
            console.error(e);
            setRestoreStatus('error');
            setTimeout(() => setRestoreStatus('idle'), 2000);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if(e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = async (ev) => {
                 if(ev.target?.result) {
                     // We expect the file to contain the identity JSON.
                     // The restore function expects a Base64 string of that JSON.
                     try {
                         const jsonStr = ev.target.result as string;
                         // Verify it's JSON first
                         JSON.parse(jsonStr); 
                         // Encode to Base64 to match standard input format of deserializeIdentity
                         const b64 = window.btoa(jsonStr);
                         setRestoreInput(b64);
                     } catch(e) {
                         alert("Invalid Key File.");
                     }
                 }
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="h-screen w-screen bg-nyx-bg flex flex-col items-center justify-center p-6 relative overflow-hidden text-nyx-text">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-nyx-accent to-nyx-secondary"></div>
            
            {!isSecure && (
                <div className="absolute top-0 w-full bg-red-600 text-white p-2 text-center text-xs font-bold z-50 animate-pulse">
                    ⚠️ INSECURE CONTEXT (HTTP) DETECTED. ENCRYPTION DISABLED. USE HTTPS.
                </div>
            )}

            <div className="w-full max-w-md bg-nyx-card border border-nyx-border rounded-2xl p-8 shadow-2xl relative z-10 transition-all">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-nyx-bg border border-nyx-border rounded-full flex items-center justify-center mb-4 shadow-lg shadow-nyx-accent/10">
                        {isRestoreMode ? <Key className="w-8 h-8 text-nyx-secondary"/> : <Shield className={`w-8 h-8 ${isSecure ? 'text-nyx-accent' : 'text-red-500'}`} />}
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">{isRestoreMode ? 'Restore Identity' : 'Nyxar Secure'}</h1>
                    <p className="text-nyx-muted text-sm mt-2 text-center">
                        {isRestoreMode ? 'Import your secure identity file or key.' : 'Encrypted. Decentralized. Ephemeral.'}
                    </p>
                </div>

                {isRestoreMode ? (
                    <form onSubmit={handleRestoreSubmit} className="space-y-4 animate-in fade-in slide-in-from-right">
                        <div className="space-y-2">
                             <div className="flex justify-center gap-4 mb-4">
                                 <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 border border-dashed border-nyx-border hover:border-nyx-accent rounded-xl flex flex-col items-center gap-2 text-xs text-nyx-muted hover:text-nyx-text transition">
                                     <FileJson className="w-6 h-6"/>
                                     Upload Key File
                                 </button>
                                 <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileUpload}/>
                             </div>
                             
                             <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-nyx-border" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-nyx-card px-2 text-nyx-muted">Or Paste Key</span>
                                </div>
                            </div>

                             <textarea 
                                value={restoreInput}
                                onChange={e => setRestoreInput(e.target.value)}
                                placeholder="Paste identity string here..."
                                className="w-full h-24 bg-nyx-bg border border-nyx-border rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-nyx-secondary resize-none"
                             />
                        </div>

                        <button 
                            type="submit" 
                            disabled={!restoreInput || restoreStatus === 'processing'}
                            className={`w-full py-3.5 rounded-xl text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2 
                            ${restoreStatus === 'error' ? 'bg-red-500' : 'bg-nyx-secondary hover:bg-violet-600'}`}
                        >
                            {restoreStatus === 'processing' ? <RefreshCw className="w-5 h-5 animate-spin"/> : 
                             restoreStatus === 'error' ? 'Invalid Key' : 'Unlock Account'}
                        </button>

                        <button type="button" onClick={() => setIsRestoreMode(false)} className="w-full py-2 text-sm text-nyx-muted hover:text-nyx-text transition">
                            Cancel & Create New
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in slide-in-from-left">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-nyx-muted uppercase tracking-wider">Identity Alias</label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-3 w-5 h-5 text-nyx-muted" />
                                <input 
                                    type="text" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-nyx-bg border border-nyx-border rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-nyx-accent transition-colors text-sm text-nyx-text"
                                    placeholder="Enter codename..."
                                    autoFocus
                                    maxLength={20}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={!username.trim() || isGenerating}
                            className="w-full bg-nyx-accent hover:bg-nyx-accentHover text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-nyx-accent/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" /> Generating Keys...
                                </>
                            ) : (
                                <>
                                    Initialize Identity <ChevronRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                        
                        <div className="pt-2 text-center">
                            <button type="button" onClick={() => setIsRestoreMode(true)} className="text-xs text-nyx-muted hover:text-nyx-accent transition flex items-center justify-center gap-1 w-full">
                                <Upload className="w-3 h-3"/> Restore Existing Identity
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

const MainApp = () => {
  const [view, setView] = useState<AppView>(AppView.ONBOARDING);
  const [identity, setIdentity] = useState<PrivateIdentity | null>(null);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState<ChatFolder>('all');
  const [users, setUsers] = useState<User[]>([]);
  
  // State initialization...
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);
  const [disappearingMode, setDisappearingMode] = useState<boolean>(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [secureNotes, setSecureNotes] = useState<SecureNote[]>([]);
  const [privacyShadeActive, setPrivacyShadeActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // CALL STATES
  const [incomingCall, setIncomingCall] = useState<User | null>(null);
  const [callState, setCallState] = useState<CallState>(CallState.IDLE);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [activeCallUser, setActiveCallUser] = useState<User | null>(null);
  const incomingOfferRef = useRef<any>(null); // To store offer while ringing
  const currentCallId = useRef<string | null>(null); // NEW: Track Call ID

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<Message[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  
  // RECORDING STATE
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingVolume, setRecordingVolume] = useState<number[]>(new Array(10).fill(10));

  // Security State
  const [isSecureContext, setIsSecureContext] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- REFS FOR SOCKET HANDLERS ---
  const usersRef = useRef(users);
  const activeCallUserRef = useRef(activeCallUser);
  const incomingCallRef = useRef(incomingCall);
  const callStateRef = useRef(callState);
  
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { activeCallUserRef.current = activeCallUser; }, [activeCallUser]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // --- SECURITY CHECK ---
  useEffect(() => {
     const isSecure = window.isSecureContext && !!window.crypto && !!window.crypto.subtle;
     setIsSecureContext(isSecure);
     if(!isSecure) {
         console.error("CRITICAL: APP RUNNING IN INSECURE MODE. REAL ENCRYPTION DISABLED.");
     }
  }, []);

  // --- PWA INSTALL PROMPT LISTENER ---
  useEffect(() => {
    // CHECK GLOBAL VAR FIRST (Captured in index.html)
    if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
        console.log("📲 PWA: Picked up global deferred prompt");
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Update global var too just in case
      (window as any).deferredPrompt = e;
      console.log("📲 PWA Install Triggered (React Listener)");
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    if (outcome === 'accepted') {
        setDeferredPrompt(null);
        (window as any).deferredPrompt = null;
    }
  };


  // --- RESTORE SESSION ON MOUNT ---
  useEffect(() => {
    const restoreSession = async () => {
        // 1. Restore Identity
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // We need to re-import the JWK keys back to CryptoKey objects
                const publicKey = await importPublicKey(parsed.keyPair.publicKey);
                const privateKey = await importPrivateKey(parsed.keyPair.privateKey);
                
                const restoredIdentity: PrivateIdentity = {
                    ...parsed,
                    keyPair: { publicKey, privateKey }
                };
                
                setIdentity(restoredIdentity);
                setView(AppView.MAIN);
                console.log("✅ Session Restored for:", restoredIdentity.username);
            } catch (e) {
                console.error("Failed to restore session:", e);
                localStorage.removeItem(STORAGE_KEY); 
            }
        }

        // 2. Restore Messages (Persistence Fix)
        const storedMsgs = localStorage.getItem(MSG_STORAGE_KEY);
        if (storedMsgs) {
            try {
                const parsedMsgs = JSON.parse(storedMsgs);
                if (Array.isArray(parsedMsgs)) {
                    setDecryptedMessages(parsedMsgs);
                    console.log("✅ Messages Restored:", parsedMsgs.length);
                }
            } catch (e) { console.error("Failed to load messages", e); }
        }
    };
    restoreSession();
  }, []);

  // --- SAVE MESSAGES ON CHANGE ---
  useEffect(() => {
    if (decryptedMessages.length > 0) {
        localStorage.setItem(MSG_STORAGE_KEY, JSON.stringify(decryptedMessages));
    }
  }, [decryptedMessages]);

  // Connect to Socket on Login & Handle Signaling
  useEffect(() => {
    if (identity) {
      let mounted = true;
      let socket: any = null;

      const initSocket = async () => {
          // IMPORTANT: Export Public Key to JWK before sending to server
          // CryptoKey objects are not serializable by socket.io
          const publicKeyJwk = await exportPublicKey(identity.keyPair.publicKey);
          
          if (!mounted) return;

          socket = socketService.connect({
            id: identity.id,
            username: identity.username,
            publicKey: publicKeyJwk, // Transmit JWK
            avatarUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${identity.username}`
          });

          socket.on('connect', () => {
            setIsConnected(true);
            socketService.fetchUsers().then(setUsers);
          });

          socket.on('disconnect', () => setIsConnected(false));
          socket.on('user_joined', () => socketService.fetchUsers().then(setUsers));
          socket.on('user_left', () => socketService.fetchUsers().then(setUsers)); 

          // Encrypted Message Handler
          socket.on('receive_message', async (encryptedMsg: EncryptedMessage) => {
            try {
              const decryptedContent = await decryptMessage(
                { 
                  encryptedKey: encryptedMsg.encryptedKey, 
                  encryptedContent: encryptedMsg.encryptedContent, 
                  iv: encryptedMsg.iv 
                },
                identity.keyPair.privateKey
              );
              const newMsg: Message = { ...encryptedMsg, content: decryptedContent };
              
              setDecryptedMessages(prev => {
                  const updated = [...prev, newMsg];
                  return updated;
              });
              if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            } catch (e) { console.error("Decryption error", e); }
          });

          // SIGNALING HANDLER (Calls)
          socket.on('signal', async ({ senderId, signalData }: { senderId: string, signalData: SignalData }) => {
              // GHOST CALL FIX: Check Timestamp (30s timeout)
              if (Date.now() - signalData.timestamp > 30000) {
                  console.warn("Received stale signal, ignoring.");
                  return;
              }

              if (signalData.type === 'offer') {
                  // INCOMING CALL
                  const caller = usersRef.current.find(u => u.id === senderId); // USE REF
                  if (caller) {
                      setIncomingCall(caller);
                      setIsVideoCall(signalData.isVideo);
                      incomingOfferRef.current = signalData.sdp;
                      currentCallId.current = signalData.callId; // STORE SESSION ID
                      setCallState(CallState.RINGING);
                      ringtoneService.playIncoming(); 
                  }
              } else if (signalData.type === 'answer') {
                  // GHOST CALL FIX: If I am not calling (IDLE) or ID doesn't match, kill it.
                  if (callStateRef.current !== CallState.CALLING || currentCallId.current !== signalData.callId) {
                      console.warn("Received answer for unknown/ended call. Sending BYE.");
                      socketService.sendSignal(senderId, { type: 'bye', callId: signalData.callId, reason: 'cancel', timestamp: Date.now() });
                      return;
                  }

                  // OUTGOING CALL ANSWERED
                  ringtoneService.stop(); 
                  if (signalData.sdp) {
                      await webRTC.handleAnswer(signalData.sdp);
                      setCallState(CallState.CONNECTED);
                  }
              } else if (signalData.type === 'candidate') {
                  // ICE CANDIDATE
                  if (signalData.candidate) {
                      await webRTC.handleCandidate(signalData.candidate);
                  }
              } else if (signalData.type === 'bye') {
                  // CHECK ID match
                  if (signalData.callId && signalData.callId !== currentCallId.current) {
                      return; // Ignore bye for other calls
                  }

                  // CALL ENDED REMOTE
                  endCallCleanup();
                  
                  // DETERMINE LOG MESSAGE BASED ON REASON
                  let logText = "Call ended";
                  if (signalData.reason === 'reject') {
                      logText = "Call Declined";
                  } else if (signalData.reason === 'cancel') {
                      logText = "Missed Call";
                  } else if (signalData.duration !== undefined) {
                      const mins = Math.floor(signalData.duration / 60);
                      const secs = signalData.duration % 60;
                      logText = `Call ended • ${mins}m ${secs}s`;
                  }
                  
                  addSystemMessage(senderId, logText, signalData.isVideo ? 'video' : 'audio');
              }
          });

          // SIGNAL ERROR HANDLER
          socket.on('signal_error', (error: any) => {
              console.warn("Signal Error:", error);
              if (callStateRef.current === CallState.CALLING || callStateRef.current === CallState.RINGING) {
                  endCallCleanup();
                  alert(`Call connection failed: ${error.message || 'User is currently offline'}`);
              }
          });

          // Init WebRTC Ice Candidate Emit
          webRTC.onIceCandidateCallback = (candidate) => {
              const activeUser = activeCallUserRef.current; // USE REF
              const incomingUser = incomingCallRef.current; // USE REF
              
              if (activeUser || incomingUser) {
                  // Send to whoever we are talking to
                  const target = activeUser?.id || incomingUser?.id;
                  if (target) socketService.sendSignal(target, { type: 'candidate', candidate, callId: currentCallId.current, timestamp: Date.now() });
              }
          };
      };

      initSocket();

      return () => { 
        mounted = false;
        socketService.disconnect(); 
      };
    }
  }, [identity?.id]); // Only reconnect if Identity ID changes, not on users update

  const addSystemMessage = (otherUserId: string, text: string, callType: 'audio' | 'video' = 'audio') => {
      if (!identity) return;
      const msg: Message = {
          id: generateUUID(),
          senderId: 'system',
          receiverId: identity.id, // Only visible locally
          content: text,
          timestamp: Date.now(),
          status: 'read',
          type: 'text',
          isSystem: true,
          callType: callType // Track type
      };
      
      const logMsg: Message = {
          ...msg,
          senderId: otherUserId, 
          receiverId: identity.id
      }
      setDecryptedMessages(prev => [...prev, logMsg]);
  };

  // --- CALL LOGIC ---
  const startCall = async (video: boolean) => {
      // SECURE CONTEXT CHECK
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          alert("Calls require HTTPS.");
          return;
      }

      // PERMISSION CHECK BEFORE UI CHANGE
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
          // Stop tracks immediately, we just wanted to verify permission
          stream.getTracks().forEach(t => t.stop());
      } catch (err) {
          console.error("Permission denied", err);
          alert("Camera and microphone permissions are required for calls. Please enable them in your browser settings.");
          return;
      }

      if (!activeChat) return;
      const receiver = users.find(u => u.id === activeChat);
      if (!receiver) return;

      setIsVideoCall(video);
      setActiveCallUser(receiver);
      setCallState(CallState.CALLING);
      currentCallId.current = generateUUID(); // GENERATE UNIQUE CALL ID
      ringtoneService.playOutgoing(); 
      
      try {
          await webRTC.startLocalStream(video);
          const offer = await webRTC.createOffer();
          socketService.sendSignal(receiver.id, { 
              type: 'offer', 
              sdp: offer, 
              isVideo: video, 
              callId: currentCallId.current, // SEND ID
              timestamp: Date.now() 
          });
      } catch (e: any) {
          console.error("Failed to start call", e);
          ringtoneService.stop();
          setCallState(CallState.IDLE);
          setActiveCallUser(null);
          alert("Failed to start call. Please try again.");
      }
  };

  const answerCall = async () => {
      if (!incomingCall || !incomingOfferRef.current) return;
      
      ringtoneService.stop(); 

      setActiveCallUser(incomingCall);
      setIncomingCall(null);
      setCallState(CallState.CONNECTED);
      
      try {
          await webRTC.startLocalStream(isVideoCall);
          const answer = await webRTC.createAnswer(incomingOfferRef.current);
          socketService.sendSignal(incomingCall.id, { 
              type: 'answer', 
              sdp: answer, 
              callId: currentCallId.current, // ECHO ID
              timestamp: Date.now()
          });
      } catch (e) {
          endCallCleanup();
      }
  };

  const rejectCall = () => {
      if (incomingCall) {
          socketService.sendSignal(incomingCall.id, { 
              type: 'bye', 
              isVideo: isVideoCall, 
              reason: 'reject', 
              callId: currentCallId.current, 
              timestamp: Date.now() 
          });
          addSystemMessage(incomingCall.id, "Missed Call", isVideoCall ? 'video' : 'audio');
          ringtoneService.stop();
          setIncomingCall(null);
          setCallState(CallState.IDLE);
      }
  };

  const endCall = (duration: number) => {
      if (activeCallUser) {
          // If we are calling but haven't connected yet (Calling state), it's a Cancel
          // If we are Connected, it's a Hangup
          const reason = callState === CallState.CALLING ? 'cancel' : 'hangup';
          
          socketService.sendSignal(activeCallUser.id, { 
              type: 'bye', 
              isVideo: isVideoCall, 
              duration, 
              reason, 
              callId: currentCallId.current,
              timestamp: Date.now() 
          });
          
          // Local Log
          let logText = "";
          if (reason === 'cancel') {
              logText = "Canceled";
          } else {
              const mins = Math.floor(duration / 60);
              const secs = duration % 60;
              logText = `Call ended • ${mins}m ${secs}s`;
          }
          
          addSystemMessage(activeCallUser.id, logText, isVideoCall ? 'video' : 'audio');
      }
      endCallCleanup();
  };

  const endCallCleanup = () => {
      ringtoneService.stop();
      webRTC.endCall();
      setCallState(CallState.IDLE);
      setActiveCallUser(null);
      setIncomingCall(null);
      currentCallId.current = null;
  };
  
  // --- HANDLERS ---
  const handleCreateIdentity = async (username: string) => {
    try {
        const keyPair = await generateIdentity();
        const publicKey = await exportPublicKey(keyPair.publicKey);
        const privateKey = await exportPrivateKey(keyPair.privateKey);
        
        const newIdentity: PrivateIdentity = {
            id: generateUUID(),
            username,
            keyPair,
            recoveryPhrase: generateRecoveryPhrase(),
            settings: {
                readReceipts: true,
                onlineStatus: true,
                incognitoKeyboard: false,
                burnOnRead: false,
                appDisguise: false,
                decoyNotifications: false,
                shakeToLock: false,
                biometricLock: false,
                torProxy: false,
                meshNetworking: false,
                deadMansSwitch: false,
                deadMansTimerDays: 30,
                ipRelaying: false,
                biometricAnswer: false,
                publicDiscovery: true,
                allowAcousticHandshake: false,
                allowNfcPairing: false,
                allowBleBeacon: false,
                voiceChanger: false,
                metadataScrubbing: true,
                screenPrivacy: false,
                intruderSelfie: false,
                callFaceBlur: false,
                lowBandwidthMode: false,
                wallpaper: 'bg-nyx-bg'
            },
            blockedUsers: []
        };

        const identityToStore = {
             ...newIdentity,
             keyPair: { publicKey, privateKey }
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(identityToStore));

        setIdentity(newIdentity);
        setView(AppView.MAIN);
    } catch (e) {
        console.error("Identity generation failed", e);
        alert("Failed to generate secure identity. Your browser may not support WebCrypto.");
    }
  };

  // --- RESTORE HANDLER ---
  const handleRestoreIdentity = async (identityStr: string) => {
      try {
          const restored = await deserializeIdentity(identityStr);
          
          // Must re-export back to JWK to store in LocalStorage for persistence
          // (Our deserializeIdentity returns active CryptoKeys, but storage needs JSON)
          const pubJwk = await exportPublicKey(restored.keyPair.publicKey);
          const privJwk = await exportPrivateKey(restored.keyPair.privateKey);

          const identityToStore = {
              ...restored,
              keyPair: { publicKey: pubJwk, privateKey: privJwk }
          };

          localStorage.setItem(STORAGE_KEY, JSON.stringify(identityToStore));
          setIdentity(restored);
          setView(AppView.MAIN);
          console.log("✅ Identity Restored Successfully");
      } catch (e) {
          throw e; // Bubble up to form
      }
  };

  const handlePanic = () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(MSG_STORAGE_KEY);
      setIdentity(null);
      setDecryptedMessages([]);
      setUsers([]);
      setActiveChat(null);
      setView(AppView.ONBOARDING);
      window.location.reload(); 
  };

  const handleLogout = () => {
      socketService.disconnect();
      localStorage.removeItem(STORAGE_KEY);
      setIdentity(null);
      setView(AppView.ONBOARDING);
  };
  
  const startRecording = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert("Audio recording is not supported in this browser or context (HTTPS required).");
          return;
      }
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          // Detect supported MIME type
          let mimeType = 'audio/webm;codecs=opus';
          if (!MediaRecorder.isTypeSupported || !MediaRecorder.isTypeSupported(mimeType)) {
              console.log("WebM/Opus not supported, trying MP4/AAC...");
              mimeType = 'audio/mp4'; // Fallback for Safari
              if (!MediaRecorder.isTypeSupported || !MediaRecorder.isTypeSupported(mimeType)) {
                   console.log("MP4 not supported, using default.");
                   mimeType = ''; // Let browser choose default
              }
          }

          const options: any = { audioBitsPerSecond: 128000 };
          if (mimeType) options.mimeType = mimeType;

          const mediaRecorder = new MediaRecorder(stream, options);
          
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
             if(event.data.size > 0) audioChunksRef.current.push(event.data);
          };

          mediaRecorder.start();
          setIsRecording(true);
          setRecordingDuration(0);

          recordIntervalRef.current = setInterval(() => {
              setRecordingDuration(d => d + 1);
              if (analyserRef.current) {
                  const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                  analyserRef.current.getByteFrequencyData(dataArray);
                  const visualData = Array.from(dataArray).slice(0, 10).map(v => Math.max(10, v));
                  setRecordingVolume(visualData);
              }
          }, 100);

      } catch (err) {
          console.error("Microphone error", err);
          alert("Microphone access denied or not available. Please check permissions.");
      }
  };

  const cancelRecording = () => {
      cleanupRecording();
      setIsRecording(false);
      setRecordingDuration(0);
  };

  const sendRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.onstop = () => {
              if (audioChunksRef.current.length === 0) {
                  alert("Recording failed or was too short.");
                  cleanupRecording();
                  setIsRecording(false);
                  return;
              }
              const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
              const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
              const reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = () => {
                  const base64data = reader.result as string;
                  const finalDuration = Math.round(recordingDuration / 10); 
                  sendMessage(base64data, 'audio', undefined, undefined, undefined, finalDuration);
                  cleanupRecording();
                  setIsRecording(false);
                  setRecordingDuration(0);
              };
          };
      }
  };

  const cleanupRecording = () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      if (audioCtxRef.current) audioCtxRef.current.close();
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        try {
          const base64 = await fileToBase64(file);
          const type: MessageType = file.type.startsWith('image/') ? 'image' : 'file';
          sendMessage(base64, type, file.name);
        } catch (err) { console.error("File error", err); }
        setAttachmentMenuOpen(false);
      }
  };

  const handleSendLocation = () => {
      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((position) => {
              const locString = `Location: ${position.coords.latitude}, ${position.coords.longitude}`;
              sendMessage(locString, 'text'); 
              setAttachmentMenuOpen(false);
          }, (err) => {
              alert("Could not fetch location.");
          });
      } else {
          alert("Geolocation not supported.");
      }
  };

  const handleSendPoll = () => {
      const question = prompt("Poll Question:");
      if (question) {
          sendMessage(`POLL: ${question} (Reply with your vote)`, 'text');
          setAttachmentMenuOpen(false);
      }
  };
  
  const sendMessage = async (content: string, type: MessageType = 'text', fileName?: string, pollData?: any, scheduledFor?: number, mediaDuration?: number) => {
      if (!identity || !activeChat) return;
      const receiver = users.find(u => u.id === activeChat);
      if (!receiver) { alert("Receiver offline."); return; }
      try {
          const receiverPublicKey = await importPublicKey(receiver.publicKey);
          const encryptedBundle = await encryptMessage(content, receiverPublicKey);
          const msgId = generateUUID();
          const timestamp = Date.now();
          const encryptedMsg: EncryptedMessage = { 
              id: msgId, senderId: identity.id, receiverId: activeChat, 
              ...encryptedBundle, timestamp, status: 'sent', type, fileName,
              pollData, scheduledFor, isBurnOnRead: identity.settings.burnOnRead,
              isDistortedAudio: identity.settings.voiceChanger && type === 'audio',
              mediaDuration: mediaDuration 
          };
          
          socketService.sendMessage(activeChat, encryptedMsg);
          const myCopy: Message = {
              id: msgId, senderId: identity.id, receiverId: activeChat,
              content, timestamp, status: 'sent', type, fileName, mediaDuration: mediaDuration
          };
          setDecryptedMessages(prev => [...prev, myCopy]);
          setMessageInput('');
      } catch (e) { console.error("Encryption failed", e); alert("Secure handshake failed."); }
  };
  
  // --- MARK MESSAGES READ ON CHAT OPEN ---
  useEffect(() => {
    if (activeChat) {
        setDecryptedMessages(prev => prev.map(msg => 
            (msg.senderId === activeChat && msg.receiverId === identity?.id && msg.status !== 'read') 
            ? { ...msg, status: 'read' } 
            : msg
        ));
    }
  }, [activeChat, decryptedMessages.length]); // Re-run when new messages arrive if chat is open

  const filteredUsers = users.map(user => {
      const userMsgs = decryptedMessages.filter(m => 
          (m.senderId === user.id && m.receiverId === identity?.id) || 
          (m.senderId === identity?.id && m.receiverId === user.id)
      );
      const lastMsg = userMsgs.sort((a,b) => b.timestamp - a.timestamp)[0];
      const unreadCount = userMsgs.filter(m => m.senderId === user.id && m.receiverId === identity?.id && m.status !== 'read').length;
      return { ...user, lastMsg, unreadCount };
  }).filter(user => 
      user.id !== identity?.id && 
      user.username.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
      const timeA = a.lastMsg?.timestamp || 0;
      const timeB = b.lastMsg?.timestamp || 0;
      if (timeA !== timeB) return timeB - timeA;
      return (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0);
  });

  const formatRecordingTime = (ds: number) => {
      const totalSeconds = Math.floor(ds / 10);
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (view === AppView.CALCULATOR) return <CalculatorView onUnlock={() => setView(AppView.MAIN)} onIntruderAttempt={() => {}} />;
  if (view === AppView.VAULT && identity) return <SecureVaultView onBack={() => setView(AppView.MAIN)} notes={secureNotes} onAddNote={(n) => setSecureNotes([...secureNotes, n])} />;
  if (view === AppView.ONBOARDING) return <Onboarding onComplete={handleCreateIdentity} onRestore={handleRestoreIdentity} />;
  if (view === AppView.SETTINGS && identity) return <SettingsView identity={identity} onBack={() => setView(AppView.MAIN)} onUpdateSettings={(s) => setIdentity({...identity, settings: s})} onPanic={handlePanic} onInstallApp={handleInstallApp} canInstallApp={!!deferredPrompt} />;

  // Main UI
  return (
    <div className="flex h-screen bg-nyx-bg text-nyx-text overflow-hidden font-sans relative transition-colors duration-300">
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />

      {/* CALL OVERLAYS */}
      {incomingCall && ( 
          <IncomingCallOverlay 
              caller={incomingCall} 
              isVideo={isVideoCall} 
              onAnswer={answerCall} 
              onReject={rejectCall} 
              biometricRequired={!!identity?.settings.biometricAnswer} 
          /> 
      )}
      {((callState === CallState.CONNECTED || callState === CallState.CALLING) && activeCallUser) && (
          <SecureCallInterface 
              activeChatUser={activeCallUser} 
              isVideo={isVideoCall} 
              callState={callState}
              onEnd={endCall} 
              identity={identity!} 
          />
      )}
      
      {/* Sidebar - RESPONSIVE TOGGLE */}
      <aside className={`flex-col border-r border-nyx-border bg-nyx-sidebar backdrop-blur-xl relative z-20 transition-all duration-300
        ${activeChat ? 'hidden md:flex w-full md:w-80' : 'w-full md:w-80 flex'}
      `}>
        {/* ... Sidebar Header ... */}
        <div className="p-4 border-b border-nyx-border flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-nyx-accent" />
            <span className="font-bold text-lg tracking-tight">Nyxar</span>
            {isConnected ? <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> : <div className="w-2 h-2 rounded-full bg-red-500"></div>}
          </div>
          <div className="flex gap-2">
             <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-red-500/20 text-nyx-muted hover:text-red-500" title="Logout"><LogOut className="w-5 h-5"/></button>
             <button onClick={() => setView(AppView.SETTINGS)} className="p-2 rounded-lg hover:bg-nyx-border text-nyx-muted"><Settings className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-3">
             <div className="relative group">
                 <Search className="w-4 h-4 absolute left-3 top-3 text-nyx-muted" />
                 <input type="text" placeholder="Search contacts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-nyx-bg border border-nyx-border rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-nyx-accent text-nyx-text" />
             </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-nyx-muted text-sm flex flex-col items-center gap-2">
                  <UserIcon className="w-8 h-8 opacity-20"/>
                  {users.length <= 1 ? "Waiting for others to join..." : "No matches found."}
              </div>
          ) : (
              filteredUsers.map((user) => (
                  <div key={user.id} onClick={() => setActiveChat(user.id)} className={`p-3 mx-2 rounded-xl flex items-center gap-3 cursor-pointer transition-all border border-transparent ${activeChat === user.id ? 'bg-nyx-border' : 'hover:bg-nyx-border/50'}`}>
                    <div className="relative">
                      <img src={user.avatarUrl || 'https://picsum.photos/200'} alt={user.username} className={`w-12 h-12 rounded-full object-cover ${!user.isOnline ? 'grayscale opacity-70' : ''}`} />
                      {user.isOnline ? (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-nyx-sidebar"></div>
                      ) : (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-gray-500 rounded-full border-2 border-nyx-sidebar"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={`font-medium truncate flex items-center gap-1 ${!user.isOnline ? 'text-nyx-muted' : 'text-nyx-text'}`}>{user.username}</span>
                        {user.lastMsg && <span className="text-[10px] text-nyx-muted">{formatTime(user.lastMsg.timestamp)}</span>}
                      </div>
                      <div className="flex justify-between items-center">
                          <p className={`text-sm truncate text-xs ${user.unreadCount > 0 ? 'text-nyx-text font-bold' : 'text-nyx-muted'}`}>
                              {user.lastMsg ? (
                                  user.lastMsg.type === 'text' ? user.lastMsg.content : 
                                  user.lastMsg.type === 'image' ? '📷 Photo' : 
                                  user.lastMsg.type === 'audio' ? '🎤 Voice Message' : '📎 File'
                              ) : 'No messages yet'}
                          </p>
                          {user.unreadCount > 0 && (
                              <div className="min-w-[18px] h-[18px] px-1 bg-nyx-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                  {user.unreadCount}
                              </div>
                          )}
                      </div>
                    </div>
                  </div>
              ))
          )}
        </div>
      </aside>

      {/* Chat Area */}
      <main className={`flex-1 flex-col relative bg-nyx-bg transition-colors duration-300 ${identity?.settings.wallpaper}
         ${!activeChat ? 'hidden md:flex' : 'flex'}
      `}>
         {activeChat ? (
             <>
                <header className="h-16 border-b border-nyx-border flex items-center justify-between px-6 bg-nyx-sidebar/90 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                  <div className="flex items-center gap-3">
                     <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2 text-nyx-muted hover:text-nyx-text">
                       <ChevronLeft className="w-6 h-6" />
                     </button>

                     <img src={users.find(u => u.id === activeChat)?.avatarUrl || 'https://picsum.photos/200'} className="w-10 h-10 rounded-full" />
                     <div>
                       <h3 className="font-semibold text-nyx-text">{users.find(u => u.id === activeChat)?.username}</h3>
                       <div className="text-xs text-nyx-muted flex items-center gap-1"><Lock className="w-3 h-3 text-nyx-accent"/> Secure E2EE</div>
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                      <button onClick={() => startCall(false)} className="p-2.5 rounded-full hover:bg-nyx-border text-nyx-muted hover:text-nyx-accent transition-all" title="Secure Audio Call">
                          <Phone className="w-5 h-5"/>
                      </button>
                      <button onClick={() => startCall(true)} className="p-2.5 rounded-full hover:bg-nyx-border text-nyx-muted hover:text-nyx-accent transition-all" title="Secure Video Call">
                          <Video className="w-5 h-5"/>
                      </button>
                      <div className="w-px h-6 bg-nyx-border mx-1"></div>
                      <button className="p-2 rounded-full hover:bg-nyx-border text-nyx-muted transition"><MoreVertical className="w-5 h-5"/></button>
                  </div>
                </header>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                     {(() => {
                        const chatMessages = decryptedMessages
                            .filter(m => (m.senderId === identity?.id && m.receiverId === activeChat) || (m.senderId === activeChat && m.receiverId === identity?.id))
                            .sort((a, b) => a.timestamp - b.timestamp);

                        let lastDateLabel = '';

                        return chatMessages.map((msg, index) => {
                            const isMe = msg.senderId === identity?.id;
                            const isSystem = msg.isSystem;
                            const dateLabel = getMessageDateLabel(msg.timestamp);
                            const showDateSeparator = dateLabel !== lastDateLabel;
                            lastDateLabel = dateLabel;
                            
                            return (
                                <React.Fragment key={msg.id}>
                                    {showDateSeparator && (
                                        <div className="flex justify-center my-6">
                                            <span className="bg-nyx-card/80 backdrop-blur-md border border-nyx-border px-4 py-1 rounded-full text-xs font-bold text-nyx-muted shadow-sm">
                                                {dateLabel}
                                            </span>
                                        </div>
                                    )}

                                    {/* PREMIUM SYSTEM CALL LOG RENDER */}
                                    {/* PREMIUM SYSTEM CALL LOG RENDER */}
                                    {isSystem ? (() => {
                                        const isDeclined = msg.content.toLowerCase().includes("declined");
                                        const isMissed = msg.content.toLowerCase().includes("missed") || msg.content.toLowerCase().includes("canceled");
                                        const isVideo = msg.callType === 'video';
                                        
                                        return (
                                            <div key={msg.id} className="flex justify-center my-6">
                                                <div className="bg-nyx-card/80 backdrop-blur-md border border-nyx-border pl-3 pr-5 py-2 rounded-2xl flex items-center gap-3 shadow-sm hover:shadow-md transition-all">
                                                    <div className={`p-2 rounded-full ${isMissed || isDeclined ? 'bg-red-500/10 text-red-500' : 'bg-nyx-accent/10 text-nyx-accent'}`}>
                                                        {isVideo ? <Video className="w-4 h-4"/> : <Phone className="w-4 h-4"/>}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <div className="text-sm font-semibold text-nyx-text flex items-center gap-1.5">
                                                            <span>{msg.content}</span>
                                                            {isMissed || isDeclined ? 
                                                                (isMe ? <ArrowUpRight className="w-3 h-3 text-red-500"/> : <ArrowDownLeft className="w-3 h-3 text-red-500"/>)
                                                                : 
                                                                <CheckCheck className="w-3 h-3 text-green-500"/>
                                                            }
                                                        </div>
                                                        <div className="text-[10px] text-nyx-muted font-mono flex items-center gap-2">
                                                            {formatTime(msg.timestamp)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })() : (
                                        // MESSAGE CONTENT RENDERING
                                        (() => {
                                            let content;
                                            if (msg.type === 'image' && msg.content.startsWith('data:')) {
                                                content = <img src={msg.content} className="max-w-[200px] rounded-lg cursor-pointer" />;
                                            } else if (msg.type === 'audio' && msg.content.startsWith('data:')) {
                                                const dur = msg.mediaDuration || 0;
                                                const m = Math.floor(dur / 60);
                                                const s = dur % 60;
                                                const durationLabel = `${m}:${s.toString().padStart(2, '0')}`;
                                                content = <VoiceMessagePlayer src={msg.content} durationLabel={durationLabel} isMe={isMe} />;
                                            } else if (msg.type === 'file') {
                                                content = (
                                                    <a href={msg.content} download={msg.fileName || 'document'} className="flex items-center gap-3 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition border border-white/10 group">
                                                        <div className="p-2 bg-nyx-accent/20 rounded-full text-nyx-accent">
                                                            <FileText className="w-6 h-6" />
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden max-w-[150px]">
                                                            <span className="truncate font-bold text-sm">{msg.fileName || 'Encrypted File'}</span>
                                                            <span className="text-[10px] opacity-70 flex items-center gap-1"><Download className="w-3 h-3"/> Download</span>
                                                        </div>
                                                    </a>
                                                );
                                            } else {
                                                content = <p className="whitespace-pre-wrap">{msg.content}</p>;
                                            }

                                            return (
                                                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 mb-2`}>
                                                    <div className={`max-w-[85%] sm:max-w-[70%] px-4 py-3 rounded-2xl text-sm shadow-lg backdrop-blur-md transition-all border
                                                        ${isMe 
                                                            ? 'bg-gradient-to-br from-indigo-600/90 to-blue-600/90 border-blue-400/30 text-white rounded-tr-sm' 
                                                            : 'bg-nyx-card/60 border-nyx-border/50 text-nyx-text rounded-tl-sm'
                                                        }
                                                    `}>
                                                        {content}
                                                        <div className={`text-[10px] mt-1 text-right font-medium ${isMe ? 'text-white/70' : 'text-gray-400'}`}>
                                                            {formatTime(msg.timestamp)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })()
                                    )}
                                </React.Fragment>
                            );
                        })
                     })()}
                     <div ref={messagesEndRef} />
                </div>

                {/* Footer Input Area */}
                <div className="p-4 border-t border-nyx-border bg-nyx-sidebar/90 backdrop-blur relative">
                  {/* ATTACHMENT MENU */}
                  {attachmentMenuOpen && (
                      <div className="absolute bottom-20 left-4 z-50 bg-nyx-card border border-nyx-border rounded-xl shadow-2xl p-2 flex flex-col gap-1 min-w-[180px] animate-in slide-in-from-bottom-2">
                          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 p-3 hover:bg-nyx-bg rounded-lg text-sm text-nyx-text transition">
                              <File className="w-5 h-5 text-blue-500"/> File / Document
                          </button>
                          <button onClick={() => { /* Trigger specific image flow if needed */ fileInputRef.current?.click() }} className="flex items-center gap-3 p-3 hover:bg-nyx-bg rounded-lg text-sm text-nyx-text transition">
                              <ImageIcon className="w-5 h-5 text-purple-500"/> Photo / Video
                          </button>
                          <button onClick={handleSendLocation} className="flex items-center gap-3 p-3 hover:bg-nyx-bg rounded-lg text-sm text-nyx-text transition">
                              <MapPin className="w-5 h-5 text-red-500"/> Location
                          </button>
                          <button onClick={handleSendPoll} className="flex items-center gap-3 p-3 hover:bg-nyx-bg rounded-lg text-sm text-nyx-text transition">
                              <ListChecks className="w-5 h-5 text-green-500"/> Poll
                          </button>
                      </div>
                  )}

                  {/* PREMIUM RECORDING UI OVERLAY */}
                  {isRecording ? (
                      <div className="absolute inset-0 bg-nyx-sidebar z-20 flex items-center px-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
                          {/* Cancel Button */}
                          <button onClick={cancelRecording} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-all duration-300 group">
                              <Trash2 className="w-6 h-6 group-hover:scale-110 transition-transform"/>
                          </button>

                          {/* Recording Status & Visualizer */}
                          <div className="flex-1 flex flex-col items-center justify-center mx-4">
                              <div className="flex items-center gap-2 mb-1">
                                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                  <span className="font-mono text-sm font-bold text-red-500">{formatRecordingTime(recordingDuration)}</span>
                              </div>
                              <div className="h-6 flex items-center gap-0.5 opacity-80">
                                  {recordingVolume.map((vol, i) => (
                                      <div 
                                        key={i} 
                                        className="w-1 bg-nyx-accent rounded-full transition-all duration-75" 
                                        style={{ height: `${Math.min(100, vol * 1.5)}%` }}
                                      ></div>
                                  ))}
                              </div>
                              <div className="text-[10px] text-nyx-muted mt-1 uppercase tracking-widest opacity-60">Slide to Cancel &lt;&lt;&lt;</div>
                          </div>

                          {/* Send Button */}
                          <button onClick={sendRecording} className="w-12 h-12 bg-nyx-accent text-white rounded-full flex items-center justify-center shadow-lg shadow-nyx-accent/30 hover:scale-110 active:scale-95 transition-all duration-300">
                              <Send className="w-6 h-6 ml-1"/>
                          </button>
                      </div>
                  ) : (
                      <div className="flex items-center gap-2 bg-nyx-bg border border-nyx-border rounded-2xl p-2 pl-4 transition-all">
                        <button onClick={() => setAttachmentMenuOpen(!attachmentMenuOpen)} className={`p-2 transition ${attachmentMenuOpen ? 'text-nyx-accent rotate-45' : 'text-nyx-muted hover:text-nyx-accent'}`}><Plus className="w-5 h-5"/></button>
                        <input type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage(messageInput)} placeholder="Type encrypted message..." className="flex-1 bg-transparent focus:outline-none text-sm text-nyx-text" />
                        {messageInput.trim() ? (
                            <button onClick={() => sendMessage(messageInput)} className="p-2 bg-nyx-accent rounded-xl text-white"><Send className="w-5 h-5" /></button>
                        ) : (
                            <button onClick={startRecording} className="p-2 rounded-xl text-nyx-muted hover:bg-nyx-border hover:text-nyx-accent transition"><Mic className="w-5 h-5" /></button>
                        )}
                      </div>
                  )}
                </div>
             </>
         ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-nyx-muted">
                 <Shield className="w-16 h-16 text-nyx-accent mb-4" />
                 <h2 className="text-xl font-bold text-nyx-text">Welcome back, {identity?.username}</h2>
                 <p className="text-sm mt-2">Select a secure contact to start chatting.</p>
            </div>
         )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
