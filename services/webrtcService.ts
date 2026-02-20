import { SignalData } from '../types';

// Configuration for STUN/TURN servers.
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ]
};

class SecureCallService {
  peerConnection: RTCPeerConnection | null = null;
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  onIceCandidateCallback: ((candidate: RTCIceCandidate) => void) | null = null;

  async startLocalStream(video: boolean): Promise<MediaStream> {
    try {
      // PREMIUM AUDIO CONSTRAINTS
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000, // HD Audio
        sampleSize: 16,
        channelCount: 1 // Mono is better for VoIP reliability, change to 2 for music
      };

      // PREMIUM VIDEO CONSTRAINTS (Attempt 720p/30fps)
      let videoConstraints: boolean | MediaTrackConstraints = video ? {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 30, min: 15 },
        facingMode: "user"
      } : false;

      try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: audioConstraints
          });
          this.localStream = stream;
          return stream;
      } catch (hdError) {
          console.warn("HD Media failed, trying basic constraints...", hdError);
          // Fallback: Basic Constraints to ensure call works on older devices
          videoConstraints = video ? true : false;
          const stream = await navigator.mediaDevices.getUserMedia({
             video: videoConstraints,
             audio: true 
          });
          this.localStream = stream;
          return stream;
      }
    } catch (err) {
      console.error("Failed to access media devices", err);
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
           throw new Error("Camera blocked. Use HTTPS or Localhost.");
      }
      throw new Error("Permission denied or device unavailable");
    }
  }

  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidateCallback) {
        this.onIceCandidateCallback(event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
        console.log("WebRTC Connection State:", this.peerConnection?.connectionState);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", this.peerConnection?.iceConnectionState);
    };

    this.peerConnection.ontrack = (event) => {
      console.log("📡 Remote Track Received:", event.track.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(event.streams[0]);
        }
      }
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        // Add track to peer connection
        const sender = this.peerConnection?.addTrack(track, this.localStream!);
        
        // OPTIMIZED BITRATE (Removed aggressive throttling)
        // We set a higher baseline for "Premium" quality but allow WebRTC to adapt.
        if (sender && sender.getParameters) {
            const params = sender.getParameters();
            if (!params.encodings) {
                params.encodings = [{}];
            }
            if (track.kind === 'video') {
                // Allow up to 1.5 Mbps for 720p Video
                params.encodings[0].maxBitrate = 1500000; 
                params.encodings[0].networkPriority = 'high';
            } else if (track.kind === 'audio') {
                // 64-128 kbps for HD Voice (Opus)
                params.encodings[0].maxBitrate = 128000;  
                params.encodings[0].networkPriority = 'high';
            }
            sender.setParameters(params).catch(e => console.warn("Bitrate adjustment failed (non-critical)", e));
        }
      });
    }
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) this.createPeerConnection();
    const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
    });
    await this.peerConnection!.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(remoteOffer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) this.createPeerConnection();
    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(remoteOffer));
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleCandidate(candidate: RTCIceCandidateInit) {
    if (this.peerConnection) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error adding ice candidate", e);
      }
    }
  }

  endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
      });
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStream = null;
  }
}

export const webRTC = new SecureCallService();