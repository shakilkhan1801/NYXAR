
import React, { useState, useEffect, useRef } from 'react';
import { 
  User, LogOut, Key, Settings, 
  Palette, Shield, Bell, HardDrive, HelpCircle, 
  ChevronRight, RefreshCw, Smartphone, Moon, Sun, Monitor,
  ToggleLeft, ToggleRight, Lock, Eye, EyeOff, Image as ImageIcon,
  AlertTriangle, Flame, Keyboard, Calculator, Radio, Eraser, FileText,
  Skull, QrCode, Globe, Ghost, Mic2, UserPlus, Fingerprint, Camera, 
  Wifi, Vibrate, CheckCheck, Trash2, Phone, Zap, PaintBucket, Layout,
  Share2, Bluetooth, Volume2, Copy, Link, Timer, ShieldCheck, Download,
  ChevronLeft, Menu, X, FileJson, Save
} from 'lucide-react';
import { PrivateIdentity, ThemeMode, UserSettings } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { serializeIdentity } from '../services/cryptoService';

type SettingsTab = 'identity' | 'stealth' | 'network' | 'connections' | 'spytools' | 'appearance' | 'danger';

interface SettingsViewProps {
  identity: PrivateIdentity;
  onBack: () => void;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onPanic: () => void;
  onInstallApp: () => void;
  canInstallApp: boolean;
}

const WALLPAPERS = [
  { name: 'Default', url: 'bg-nyx-bg', color: '#0a0a0b' },
  { name: 'Neon City', url: 'bg-[url("https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000&auto=format&fit=crop")]', color: '#4c1d95' },
  { name: 'Cyber Grid', url: 'bg-[url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop")]', color: '#000000' },
  { name: 'Deep Space', url: 'bg-[url("https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000&auto=format&fit=crop")]', color: '#0f172a' },
  { name: 'Abstract Flow', url: 'bg-[url("https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=1000&auto=format&fit=crop")]', color: '#c026d3' },
  { name: 'Dark Matter', url: 'bg-[url("https://images.unsplash.com/photo-1634152962476-4b8a00e1915c?q=80&w=1000&auto=format&fit=crop")]', color: '#18181b' },
  { name: 'Matrix Rain', url: 'bg-[url("https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif")]', color: '#00ff00' },
  { name: 'Royal Silk', url: 'bg-[url("https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=1000&auto=format&fit=crop")]', color: '#ffd700' },
  { name: 'Gradient Bliss', url: 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500', color: '#8b5cf6' },
  { name: 'Midnight Mesh', url: 'bg-gradient-to-tr from-slate-900 via-purple-900 to-slate-900', color: '#020617' }
];

export default function SettingsView({ identity, onBack, onUpdateSettings, onPanic, onInstallApp, canInstallApp }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('identity');
  // State to manage mobile navigation (List vs Content)
  const [showMobileContent, setShowMobileContent] = useState(false);
  const [showInstallSheet, setShowInstallSheet] = useState(false);
  
  const { theme, setTheme } = useTheme();
  const [showPhrase, setShowPhrase] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [duressInput, setDuressInput] = useState(identity.settings.duressPassword || '');
  const [disguisePin, setDisguisePin] = useState(identity.settings.disguisePin || '1234');

  // Connection Feature States
  const [qrSeed, setQrSeed] = useState(Date.now());
  const [burnerLink, setBurnerLink] = useState('');
  const [isAcousticBroadcasting, setIsAcousticBroadcasting] = useState(false);
  const [acousticStatus, setAcousticStatus] = useState('Idle');

  // Export State
  const [exportString, setExportString] = useState('');
  const [showExport, setShowExport] = useState(false);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setShowMobileContent(true); // Switch to content view on mobile
  };

  const handleMobileBack = () => {
    setShowMobileContent(false); // Switch back to menu view on mobile
  };

  const toggleSetting = (key: keyof UserSettings) => {
    const updated = { ...identity.settings, [key]: !identity.settings[key] };
    onUpdateSettings(updated);
  };

  const setWallpaper = (wp: string) => {
    onUpdateSettings({ ...identity.settings, wallpaper: wp });
  };

  const handleDuressChange = (val: string) => {
      setDuressInput(val);
      onUpdateSettings({ ...identity.settings, duressPassword: val });
  };

  const handleDisguisePinChange = (val: string) => {
      setDisguisePin(val);
      onUpdateSettings({ ...identity.settings, disguisePin: val });
  };

  // Export Logic
  const handleExportIdentity = async () => {
      const serialized = await serializeIdentity(identity);
      setExportString(serialized);
      setShowExport(true);
  };

  const copyExportString = () => {
      navigator.clipboard.writeText(exportString);
      alert("Recovery Key copied to clipboard! Save this securely.");
  };

  const downloadExportFile = () => {
      const blob = new Blob([JSON.stringify(JSON.parse(atob(exportString)), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nyxar-identity-${identity.username}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  // Rotating QR Logic
  useEffect(() => {
      const interval = setInterval(() => setQrSeed(Date.now()), 30000); // Change QR every 30s
      return () => clearInterval(interval);
  }, []);

  const generateBurnerLink = () => {
      const token = Math.random().toString(36).substring(7);
      setBurnerLink(`nyx://invite/${token}?exp=${Date.now() + 600000}`);
  };

  const startAcousticHandshake = () => {
      if(!identity.settings.allowAcousticHandshake) return;
      setIsAcousticBroadcasting(true);
      setAcousticStatus('Broadcasting Ultrasonic Token...');
      
      // Simulate High Frequency Audio (Visual & Logic Mock)
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 15000; // Near ultrasonic
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.1;
      osc.start();

      setTimeout(() => {
          osc.stop();
          setIsAcousticBroadcasting(false);
          setAcousticStatus('Broadcast Complete');
      }, 3000);
  };

  // --- Category 1: Privacy & Identity ---
  const renderIdentity = () => (
    <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-12">
      <div className="bg-nyx-card border border-nyx-border rounded-2xl p-6 flex flex-col items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-nyx-accent to-nyx-secondary"></div>
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-nyx-accent to-nyx-secondary flex items-center justify-center text-4xl font-bold text-white shadow-lg shadow-nyx-accent/20">
          {identity.username.charAt(0).toUpperCase()}
        </div>
        <div className="text-center w-full">
          <h2 className="text-2xl font-bold text-nyx-text truncate">{identity.username}</h2>
          <p className="text-nyx-muted font-mono text-xs mt-1 break-all bg-nyx-bg/50 px-2 py-1 rounded inline-block max-w-full truncate">ID: {identity.id}</p>
        </div>
        <div className="flex gap-3 mt-2 flex-wrap justify-center">
            <button onClick={() => setShowQR(true)} className="flex items-center gap-2 px-4 py-2 bg-nyx-bg border border-nyx-border rounded-lg hover:border-nyx-accent hover:text-nyx-accent transition text-sm font-medium">
                <QrCode className="w-4 h-4" /> Safety QR
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-nyx-bg border border-nyx-border rounded-lg hover:border-nyx-secondary hover:text-nyx-secondary transition text-sm font-medium">
                <UserPlus className="w-4 h-4" /> New Burner ID
            </button>
        </div>
      </div>

      <div className="bg-nyx-card border border-nyx-border rounded-2xl overflow-hidden">
         <div className="bg-nyx-sidebar px-4 py-2 border-b border-nyx-border text-xs font-bold text-nyx-muted uppercase tracking-wider">Privacy Controls</div>
         <SettingsToggle label="Read Receipts" desc="Show when you view messages." icon={<Eye className="w-5 h-5"/>} checked={identity.settings.readReceipts} onToggle={() => toggleSetting('readReceipts')} />
         <div className="h-px bg-nyx-border mx-4"></div>
         <SettingsToggle label="Online Status" desc="Reveal when you are active." icon={<Monitor className="w-5 h-5"/>} checked={identity.settings.onlineStatus} onToggle={() => toggleSetting('onlineStatus')} />
         <div className="h-px bg-nyx-border mx-4"></div>
         <SettingsToggle label="Incognito Keyboard" desc="Disable keyboard learning." icon={<Keyboard className="w-5 h-5"/>} checked={identity.settings.incognitoKeyboard} onToggle={() => toggleSetting('incognitoKeyboard')} />
         <div className="h-px bg-nyx-border mx-4"></div>
         <SettingsToggle label="Burn-on-Read" desc="Auto-delete messages 5s after viewing." icon={<Flame className="w-5 h-5 text-orange-500"/>} checked={identity.settings.burnOnRead} onToggle={() => toggleSetting('burnOnRead')} />
      </div>

      {showQR && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
              <div className="bg-white p-6 rounded-2xl max-w-sm w-full text-center relative" onClick={e => e.stopPropagation()}>
                  <h3 className="text-black font-bold text-lg mb-2">Safety Verification</h3>
                  <div className="w-48 h-48 bg-white mx-auto mb-4 rounded-lg flex items-center justify-center overflow-hidden border border-gray-200 shadow-xl">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(identity.id)}`} 
                        alt="Secure ID QR Code" 
                        className="w-full h-full object-contain"
                      />
                  </div>
                  <p className="font-mono text-[10px] text-gray-500 break-all mb-4">ID: {identity.id}</p>
                  <button onClick={() => setShowQR(false)} className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl">Done</button>
              </div>
          </div>
      )}
    </div>
  );

  // --- Category 2: Stealth & Disguise ---
  const renderStealth = () => (
    <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-12">
        <div className="bg-nyx-card border border-nyx-border rounded-2xl overflow-hidden">
            <div className="bg-nyx-sidebar px-4 py-2 border-b border-nyx-border text-xs font-bold text-nyx-muted uppercase tracking-wider">App Camouflage</div>
            <SettingsToggle label="Calculator Disguise" desc="App appears as a working calculator." icon={<Calculator className="w-5 h-5 text-yellow-500"/>} checked={identity.settings.appDisguise} onToggle={() => toggleSetting('appDisguise')} />
            {identity.settings.appDisguise && (
                <div className="p-4 pt-0 bg-nyx-bg/30">
                    <label className="text-xs text-nyx-muted block mb-2">Unlock PIN</label>
                    <input type="text" value={disguisePin} onChange={(e) => handleDisguisePinChange(e.target.value)} className="w-full bg-nyx-bg p-3 rounded-lg border border-nyx-border text-center font-mono tracking-widest text-lg" placeholder="1234" maxLength={4} />
                </div>
            )}
             <div className="h-px bg-nyx-border mx-4"></div>
            <SettingsToggle label="Decoy Notifications" desc="Notifications show 'System Update'." icon={<Bell className="w-5 h-5"/>} checked={identity.settings.decoyNotifications} onToggle={() => toggleSetting('decoyNotifications')} />
        </div>

        <div className="bg-nyx-card border border-nyx-border rounded-2xl overflow-hidden">
             <div className="bg-nyx-sidebar px-4 py-2 border-b border-nyx-border text-xs font-bold text-nyx-muted uppercase tracking-wider">Emergency Triggers</div>
             <SettingsToggle label="Shake to Lock" desc="Vigorously shake device to instantly lock." icon={<Vibrate className="w-5 h-5"/>} checked={identity.settings.shakeToLock} onToggle={() => toggleSetting('shakeToLock')} />
             <div className="h-px bg-nyx-border mx-4"></div>
             
             <div className="p-4">
                 <div className="flex items-center gap-2 mb-2 text-orange-500">
                     <AlertTriangle className="w-5 h-5"/>
                     <span className="font-medium text-sm">Duress Password</span>
                 </div>
                 <p className="text-xs text-nyx-muted mb-3">If forced to unlock, enter this password to open a decoy account with zero data.</p>
                 <input 
                    type="text" 
                    placeholder="Set Fake Password" 
                    value={duressInput}
                    onChange={(e) => handleDuressChange(e.target.value)}
                    className="w-full bg-nyx-bg border border-nyx-border rounded-xl p-3 text-nyx-text focus:border-orange-500 outline-none"
                  />
             </div>
        </div>
    </div>
  );

  // --- Category 3: Network & Security ---
  const renderNetwork = () => (
      <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-12">
           <div className="bg-nyx-card border border-nyx-border rounded-2xl overflow-hidden">
                <div className="bg-nyx-sidebar px-4 py-2 border-b border-nyx-border text-xs font-bold text-nyx-muted uppercase tracking-wider">Connection Security</div>
                <SettingsToggle label="Always-On IP Relaying" desc="Mask IP by routing calls via relay." icon={<Globe className="w-5 h-5 text-nyx-accent"/>} checked={identity.settings.ipRelaying} onToggle={() => toggleSetting('ipRelaying')} />
                <div className="h-px bg-nyx-border mx-4"></div>
                <SettingsToggle label="Tor Proxy Mode" desc="Route traffic through Tor onion network." icon={<Globe className="w-5 h-5 text-purple-500"/>} checked={identity.settings.torProxy} onToggle={() => toggleSetting('torProxy')} />
                <div className="h-px bg-nyx-border mx-4"></div>
                <SettingsToggle label="Offline Mesh" desc="P2P Bluetooth messaging." icon={<Radio className="w-5 h-5 text-blue-500"/>} checked={identity.settings.meshNetworking} onToggle={() => toggleSetting('meshNetworking')} />
                <div className="h-px bg-nyx-border mx-4"></div>
                <SettingsToggle label="Low Bandwidth Mode" desc="Optimize audio for slow connections." icon={<Zap className="w-5 h-5 text-yellow-500"/>} checked={identity.settings.lowBandwidthMode} onToggle={() => toggleSetting('lowBandwidthMode')} />
           </div>

           <div className="bg-nyx-card border border-nyx-border rounded-2xl overflow-hidden">
                <div className="bg-nyx-sidebar px-4 py-2 border-b border-nyx-border text-xs font-bold text-nyx-muted uppercase tracking-wider">Access Control</div>
                <SettingsToggle label="Biometric Lock" desc="Require FaceID/Fingerprint on launch." icon={<Fingerprint className="w-5 h-5 text-nyx-accent"/>} checked={identity.settings.biometricLock} onToggle={() => toggleSetting('biometricLock')} />
                <div className="h-px bg-nyx-border mx-4"></div>
                <SettingsToggle label="Biometric Answer" desc="Require auth to answer incoming calls." icon={<Phone className="w-5 h-5 text-green-500"/>} checked={identity.settings.biometricAnswer} onToggle={() => toggleSetting('biometricAnswer')} />
           </div>
      </div>
  );
  
  // --- Category: Connections & Discovery (NEW) ---
  const renderConnections = () => (
      <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-12">
          {/* NYX UNIQUE ID CARD */}
          <div className="bg-gradient-to-br from-gray-900 to-black border border-nyx-border rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
              <div className="absolute top-0 right-0 p-4 opacity-20">
                  <ShieldCheck className="w-24 h-24 text-nyx-accent"/>
              </div>
              <div className="relative z-10">
                  <h3 className="text-nyx-muted text-xs uppercase tracking-widest font-bold mb-2">Nyxar Unique Identity</h3>
                  <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/10 mb-4 backdrop-blur-md">
                      <div className="font-mono text-xl text-nyx-accent truncate tracking-wider">@Nyx-{identity.id.substring(0,8).toUpperCase()}</div>
                      <button className="ml-auto p-2 hover:bg-white/10 rounded-lg text-white" title="Copy ID">
                          <Copy className="w-5 h-5"/>
                      </button>
                  </div>
                  <div className="flex items-center justify-between">
                      <SettingsToggle label="Public Discovery" desc="Allow finding by exact ID match." icon={<Globe className="w-4 h-4"/>} checked={identity.settings.publicDiscovery || false} onToggle={() => toggleSetting('publicDiscovery')} />
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* DYNAMIC QR */}
              <div className="bg-nyx-card border border-nyx-border rounded-2xl p-6 flex flex-col items-center">
                  <div className="flex items-center gap-2 mb-4 text-nyx-text font-semibold">
                      <RefreshCw className="w-4 h-4 animate-spin-slow"/> Rotating QR Code
                  </div>
                  <div className="bg-white p-2 rounded-xl relative overflow-hidden group">
                      <div className="w-32 h-32 bg-white flex items-center justify-center overflow-hidden">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(identity.id)}`} 
                            alt="Dynamic QR" 
                            className="w-full h-full object-contain"
                          />
                      </div>
                      {/* Scan Line Animation */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-nyx-accent/50 shadow-[0_0_10px_#06b6d4] animate-[scan_2s_linear_infinite] z-20"></div>
                  </div>
                  <p className="text-xs text-nyx-muted mt-3 text-center">Auto-refreshes every 30s. Prevents screenshots.</p>
              </div>

              {/* BURNER LINK */}
              <div className="bg-nyx-card border border-nyx-border rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4 text-nyx-text font-semibold">
                      <Flame className="w-4 h-4 text-orange-500"/> Burner Invite Link
                  </div>
                  <p className="text-xs text-nyx-muted mb-4">Create a link that self-destructs after 10 minutes or 1 use.</p>
                  
                  {burnerLink ? (
                      <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-xl">
                          <div className="text-xs text-orange-400 font-mono break-all mb-2">{burnerLink}</div>
                          <div className="flex gap-2">
                              <button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2"><Copy className="w-3 h-3"/> Copy</button>
                              <button onClick={() => setBurnerLink('')} className="bg-nyx-bg hover:bg-nyx-border text-nyx-text p-2 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-orange-400/70 mt-2 justify-center"><Timer className="w-3 h-3"/> Expires in 09:59</div>
                      </div>
                  ) : (
                      <button onClick={generateBurnerLink} className="w-full py-3 bg-nyx-bg border border-nyx-border hover:border-orange-500/50 hover:text-orange-500 transition rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                          <Link className="w-4 h-4"/> Generate One-Time Link
                      </button>
                  )}
              </div>
          </div>
      </div>
  );

  // --- Category 4: Spy Tools ---
  const renderSpyTools = () => (
      <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-12">
          <div className="bg-nyx-card border border-nyx-border rounded-2xl overflow-hidden">
                <div className="bg-nyx-sidebar px-4 py-2 border-b border-nyx-border text-xs font-bold text-nyx-muted uppercase tracking-wider">Counter-Surveillance</div>
                <SettingsToggle label="Screen Privacy Shade" desc="Obscure screen from shoulder surfers." icon={<Ghost className="w-5 h-5"/>} checked={identity.settings.screenPrivacy} onToggle={() => toggleSetting('screenPrivacy')} />
                <div className="h-px bg-nyx-border mx-4"></div>
                <SettingsToggle label="Intruder Selfie" desc="Snap photo on failed unlock attempt." icon={<Camera className="w-5 h-5"/>} checked={identity.settings.intruderSelfie} onToggle={() => toggleSetting('intruderSelfie')} />
          </div>

          <div className="bg-nyx-card border border-nyx-border rounded-2xl overflow-hidden">
                <div className="bg-nyx-sidebar px-4 py-2 border-b border-nyx-border text-xs font-bold text-nyx-muted uppercase tracking-wider">Obfuscation</div>
                <SettingsToggle label="Voice Changer" desc="Distort audio pitch in voice notes & calls." icon={<Mic2 className="w-5 h-5"/>} checked={identity.settings.voiceChanger} onToggle={() => toggleSetting('voiceChanger')} />
                <div className="h-px bg-nyx-border mx-4"></div>
                <SettingsToggle label="Video Face Blur" desc="Automatically blur face during video calls." icon={<ImageIcon className="w-5 h-5"/>} checked={identity.settings.callFaceBlur} onToggle={() => toggleSetting('callFaceBlur')} />
                <div className="h-px bg-nyx-border mx-4"></div>
                <SettingsToggle label="Metadata Scrubbing" desc="Strip GPS/EXIF from shared media." icon={<Eraser className="w-5 h-5"/>} checked={identity.settings.metadataScrubbing} onToggle={() => toggleSetting('metadataScrubbing')} />
          </div>
      </div>
  );

  // --- Category 5: Appearance ---
  const renderAppearance = () => (
      <div className="space-y-8 animate-in slide-in-from-right duration-300 pb-12">
          <div className="bg-nyx-card border border-nyx-border rounded-2xl p-6">
             <div className="flex items-center gap-3 mb-4">
                 <Layout className="w-5 h-5 text-nyx-accent"/>
                 <h3 className="text-lg font-semibold text-nyx-text">Chat Wallpaper</h3>
             </div>
             <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                 {WALLPAPERS.map((wp, i) => (
                    <div key={i} onClick={() => setWallpaper(wp.url)} className="group cursor-pointer">
                        <div className={`aspect-[9/16] rounded-xl border-2 transition-all relative overflow-hidden bg-cover bg-center ${wp.url} ${identity.settings.wallpaper === wp.url ? 'border-nyx-accent shadow-[0_0_15px_rgba(var(--accent-color),0.3)] scale-105' : 'border-transparent hover:border-nyx-muted'}`} style={{ backgroundColor: wp.color }}>
                            {identity.settings.wallpaper === wp.url && <div className="absolute top-2 right-2 bg-nyx-accent rounded-full p-1"><CheckCheck className="w-3 h-3 text-white"/></div>}
                        </div>
                        <p className="text-center text-xs text-nyx-muted mt-2 group-hover:text-nyx-text transition">{wp.name}</p>
                    </div>
                ))}
             </div>
          </div>

          <div className="bg-nyx-card border border-nyx-border rounded-2xl p-6">
             <div className="flex items-center gap-3 mb-4">
                 <PaintBucket className="w-5 h-5 text-nyx-secondary"/>
                 <h3 className="text-lg font-semibold text-nyx-text">App Theme</h3>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ThemeCard name="Nyxar Dark" mode="nyxar-dark" active={theme === 'nyxar-dark'} colors={['#0a0a0b', '#06b6d4']} onClick={setTheme} />
                <ThemeCard name="Light" mode="light" active={theme === 'light'} colors={['#f8fafc', '#0284c7']} onClick={setTheme} />
                <ThemeCard name="Midnight" mode="midnight" active={theme === 'midnight'} colors={['#0f172a', '#38bdf8']} onClick={setTheme} />
                <ThemeCard name="Cyberpunk" mode="cyberpunk" active={theme === 'cyberpunk'} colors={['#000000', '#00ff41']} onClick={setTheme} />
                <ThemeCard name="Matrix" mode="matrix" active={theme === 'matrix'} colors={['#0d0208', '#00ff00']} onClick={setTheme} />
                <ThemeCard name="Dracula" mode="dracula" active={theme === 'dracula'} colors={['#282a36', '#ff79c6']} onClick={setTheme} />
                <ThemeCard name="Royal Gold" mode="royal" active={theme === 'royal'} colors={['#1a0b2e', '#ffd700']} onClick={setTheme} />
                <ThemeCard name="Sunset" mode="sunset" active={theme === 'sunset'} colors={['#2d1b2e', '#ff8e72']} onClick={setTheme} />
             </div>
          </div>
      </div>
  );

  // --- Category 6: Danger Zone ---
  const renderDanger = () => (
      <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-12">
          {/* EXPORT IDENTITY SECTION (NEW) */}
           <div className="bg-nyx-card border border-nyx-border rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Save className="w-5 h-5 text-nyx-accent" />
                    <h3 className="font-semibold text-nyx-text">Export Identity Backup</h3>
                </div>
              </div>
              <p className="text-xs text-nyx-muted mb-4">
                  Download your identity file or copy your recovery key. <span className="text-red-500 font-bold">WARNING: Anyone with this file becomes YOU.</span>
              </p>
              
              {!showExport ? (
                   <button onClick={handleExportIdentity} className="w-full py-3 bg-nyx-bg border border-nyx-border hover:border-nyx-accent rounded-xl text-sm font-medium transition text-nyx-text">
                       Reveal Export Options
                   </button>
              ) : (
                  <div className="space-y-3 animate-in fade-in">
                      <button onClick={downloadExportFile} className="w-full py-3 bg-nyx-accent text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-nyx-accentHover transition">
                          <FileJson className="w-4 h-4"/> Download .json File
                      </button>
                      <button onClick={copyExportString} className="w-full py-3 bg-nyx-bg border border-nyx-border text-nyx-text rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-nyx-border transition">
                          <Copy className="w-4 h-4"/> Copy Recovery Key String
                      </button>
                      <button onClick={() => setShowExport(false)} className="w-full py-2 text-xs text-nyx-muted hover:text-nyx-text">Cancel</button>
                  </div>
              )}
          </div>

          <div className="bg-red-900/10 border border-red-500/50 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Skull className="w-32 h-32 text-red-500" />
              </div>
              <div className="flex items-center gap-3 text-red-500 mb-4 relative z-10">
                  <Flame className="w-6 h-6" />
                  <h3 className="font-bold text-lg">Panic Button (Nuke)</h3>
              </div>
              <p className="text-sm text-nyx-muted mb-6 relative z-10">
                  <strong>Warning:</strong> This action is irreversible. It will:
                  <ul className="list-disc ml-5 mt-2 space-y-1">
                      <li>Wipe all local keys and messages</li>
                      <li>Shred the database</li>
                      <li>Logout immediately</li>
                  </ul>
              </p>
              <button onClick={() => { if(window.confirm("CONFIRM NUKE? THIS CANNOT BE UNDONE.")) onPanic(); }} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors relative z-10 shadow-lg shadow-red-900/50">
                  <Trash2 className="w-5 h-5" /> EXECUTE NUKE PROTOCOL
              </button>
          </div>
          
           <div className="bg-nyx-card border border-nyx-border rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-nyx-secondary" />
                    <h3 className="font-semibold text-nyx-text">Recovery Phrase</h3>
                </div>
                <button onClick={() => setShowPhrase(!showPhrase)} className="text-xs text-nyx-accent hover:underline">{showPhrase ? 'Hide' : 'Reveal'}</button>
              </div>
              <div className={`p-4 rounded-xl font-mono text-sm border border-dashed transition-all ${showPhrase ? 'bg-black border-nyx-border text-nyx-accent' : 'bg-nyx-bg border-nyx-border text-transparent select-none'}`}>
                {showPhrase ? identity.recoveryPhrase : "•••• •••• •••• •••• •••• ••••"}
              </div>
          </div>
      </div>
  );

  return (
    <div className="flex h-full bg-nyx-bg text-nyx-text overflow-hidden relative">
       {/* Sidebar / Mobile Menu */}
       <div className={`${showMobileContent ? 'hidden' : 'flex'} md:flex w-full md:w-64 border-r border-nyx-border bg-nyx-sidebar flex-col`}>
          <header className="h-16 flex items-center gap-3 px-6 border-b border-nyx-border shrink-0">
             <button onClick={onBack} className="p-2 -ml-2 hover:bg-nyx-border rounded-full transition text-nyx-muted hover:text-nyx-text">
                <LogOut className="w-5 h-5 rotate-180" />
             </button>
             <span className="font-bold text-lg">Settings</span>
          </header>
          
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
             <SettingsNavItem icon={<User className="w-5 h-5"/>} label="Identity & Privacy" active={activeTab === 'identity' && (showMobileContent || window.innerWidth >= 768)} onClick={() => handleTabChange('identity')} />
             <SettingsNavItem icon={<Share2 className="w-5 h-5"/>} label="Connections & Discovery" active={activeTab === 'connections' && (showMobileContent || window.innerWidth >= 768)} onClick={() => handleTabChange('connections')} />
             <SettingsNavItem icon={<EyeOff className="w-5 h-5"/>} label="Stealth & Disguise" active={activeTab === 'stealth' && (showMobileContent || window.innerWidth >= 768)} onClick={() => handleTabChange('stealth')} />
             <SettingsNavItem icon={<Wifi className="w-5 h-5"/>} label="Network & Security" active={activeTab === 'network' && (showMobileContent || window.innerWidth >= 768)} onClick={() => handleTabChange('network')} />
             <SettingsNavItem icon={<Shield className="w-5 h-5"/>} label="Spy Tools" active={activeTab === 'spytools' && (showMobileContent || window.innerWidth >= 768)} onClick={() => handleTabChange('spytools')} />
             <SettingsNavItem icon={<Palette className="w-5 h-5"/>} label="Appearance" active={activeTab === 'appearance' && (showMobileContent || window.innerWidth >= 768)} onClick={() => handleTabChange('appearance')} />
             <div className="pt-4 mt-4 border-t border-nyx-border/50">
                 <SettingsNavItem icon={<AlertTriangle className="w-5 h-5 text-red-500"/>} label="Danger Zone" active={activeTab === 'danger' && (showMobileContent || window.innerWidth >= 768)} onClick={() => handleTabChange('danger')} />
             </div>
             
             {/* Install App Button */}
             <div className="pt-2 border-t border-nyx-border/50">
                {canInstallApp ? (
                    <button onClick={onInstallApp} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium text-nyx-accent hover:bg-nyx-accent/10">
                        <Download className="w-5 h-5" /> Install App
                    </button>
                ) : (
                    <button 
                        onClick={() => setShowInstallSheet(true)} 
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium text-nyx-muted opacity-70 hover:opacity-100 hover:bg-nyx-border"
                    >
                        <Download className="w-5 h-5" /> Install App
                    </button>
                )}
             </div>
          </nav>
       </div>

       {/* Content Area */}
       <div className={`${showMobileContent ? 'block' : 'hidden'} md:block flex-1 overflow-y-auto bg-nyx-bg w-full relative`}>
          {/* Mobile Back Button Header */}
          <div className="md:hidden h-16 border-b border-nyx-border flex items-center px-4 sticky top-0 bg-nyx-bg/95 backdrop-blur-md z-10">
              <button onClick={handleMobileBack} className="p-2 -ml-2 hover:bg-nyx-border rounded-full mr-2">
                  <ChevronLeft className="w-6 h-6 text-nyx-text"/>
              </button>
              <h3 className="font-bold text-lg capitalize">{activeTab.replace(/([A-Z])/g, ' $1').trim()}</h3>
          </div>

          <div className="max-w-2xl mx-auto p-4 md:p-8">
             {activeTab === 'identity' && renderIdentity()}
             {activeTab === 'connections' && renderConnections()}
             {activeTab === 'stealth' && renderStealth()}
             {activeTab === 'network' && renderNetwork()}
             {activeTab === 'spytools' && renderSpyTools()}
             {activeTab === 'appearance' && renderAppearance()}
             {activeTab === 'danger' && renderDanger()}
          </div>
       </div>

       {/* PREMIUM APP-LIKE INSTALL SHEET */}
       {showInstallSheet && (
           <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowInstallSheet(false)}>
               <div className="bg-nyx-card border-t border-nyx-border rounded-t-3xl p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                   <div className="flex justify-center mb-4">
                       <div className="w-12 h-1.5 bg-nyx-border rounded-full opacity-50"></div>
                   </div>
                   
                   <div className="flex items-start justify-between mb-6">
                       <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-gradient-to-br from-nyx-accent to-nyx-secondary rounded-xl flex items-center justify-center shadow-lg shadow-nyx-accent/20">
                               <Shield className="w-8 h-8 text-white"/>
                           </div>
                           <div>
                               <h3 className="text-xl font-bold text-nyx-text">Install Nyxar</h3>
                               <p className="text-sm text-nyx-muted">Add to Home Screen for best security</p>
                           </div>
                       </div>
                       <button onClick={() => setShowInstallSheet(false)} className="p-2 bg-nyx-bg rounded-full hover:bg-nyx-border transition">
                           <X className="w-5 h-5 text-nyx-muted"/>
                       </button>
                   </div>

                   <div className="space-y-4 mb-8">
                       <div className="flex items-center gap-4 p-3 rounded-xl bg-nyx-bg border border-nyx-border">
                           <div className="w-8 h-8 rounded-full bg-nyx-sidebar flex items-center justify-center font-bold text-nyx-accent border border-nyx-border">1</div>
                           <div className="flex-1 text-sm text-nyx-text">Tap the browser menu <span className="inline-block px-1.5 py-0.5 bg-nyx-sidebar rounded text-xs mx-1 border border-nyx-border">⋮</span> or <span className="inline-block px-1.5 py-0.5 bg-nyx-sidebar rounded text-xs mx-1 border border-nyx-border"><Share2 className="w-3 h-3 inline"/></span> button.</div>
                       </div>
                       <div className="flex items-center gap-4 p-3 rounded-xl bg-nyx-bg border border-nyx-border">
                           <div className="w-8 h-8 rounded-full bg-nyx-sidebar flex items-center justify-center font-bold text-nyx-accent border border-nyx-border">2</div>
                           <div className="flex-1 text-sm text-nyx-text">Select <span className="font-bold text-nyx-accent">Install App</span> or <span className="font-bold text-nyx-accent">Add to Home Screen</span>.</div>
                       </div>
                   </div>

                   <button onClick={() => setShowInstallSheet(false)} className="w-full py-4 bg-nyx-accent text-white font-bold rounded-xl shadow-lg shadow-nyx-accent/20 active:scale-95 transition-transform">
                       Got it, I'll do it
                   </button>
               </div>
           </div>
       )}
    </div>
  );
}

function SettingsToggle({ label, desc, icon, checked, onToggle }: { label: string, desc: string, icon: React.ReactNode, checked: boolean, onToggle: () => void }) {
    return (
        <div className="p-4 flex items-center justify-between hover:bg-nyx-bg transition cursor-pointer" onClick={onToggle}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${checked ? 'text-nyx-accent bg-nyx-accent/10' : 'text-nyx-muted bg-nyx-bg'}`}>
                    {icon}
                </div>
                <div>
                    <div className="font-medium text-nyx-text text-sm">{label}</div>
                    <div className="text-xs text-nyx-muted line-clamp-1">{desc}</div>
                </div>
            </div>
            {label && (
                <div className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${checked ? 'bg-nyx-accent' : 'bg-nyx-border'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${checked ? 'left-7' : 'left-1'}`}></div>
                </div>
            )}
        </div>
    )
}

function SettingsNavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${active ? 'bg-nyx-accent text-white shadow-lg shadow-nyx-accent/20' : 'text-nyx-muted hover:bg-nyx-border hover:text-nyx-text'}`}>
      {icon} {label}
    </button>
  );
}

function ThemeCard({ name, mode, active, colors, onClick }: { name: string, mode: ThemeMode, active: boolean, colors: string[], onClick: (m: ThemeMode) => void }) {
  return (
    <div onClick={() => onClick(mode)} className={`border rounded-xl p-3 cursor-pointer transition-all relative overflow-hidden group ${active ? 'border-nyx-accent ring-1 ring-nyx-accent bg-nyx-card' : 'border-nyx-border bg-nyx-bg hover:border-nyx-muted'}`}>
       <div className="flex gap-2 mb-2">
           <div className="w-5 h-5 rounded-full border border-gray-500/20" style={{ backgroundColor: colors[0] }}></div>
           <div className="w-5 h-5 rounded-full border border-gray-500/20" style={{ backgroundColor: colors[1] }}></div>
       </div>
       <span className={`text-sm font-medium ${active ? 'text-nyx-accent' : 'text-nyx-text'}`}>{name}</span>
       {active && <div className="absolute top-2 right-2 text-nyx-accent"><CheckCheck className="w-3 h-3"/></div>}
    </div>
  );
}
