
// This service handles actual cryptographic operations using the browser's Native Web Crypto API.
// It simulates the "Zero Knowledge" architecture where keys and plaintext never leave the client.
import { PrivateIdentity, UserSettings } from '../types';

// Utilities for ArrayBuffer <-> String conversion
const ab2str = (buf: ArrayBuffer): string => {
  return String.fromCharCode.apply(null, new Uint8Array(buf) as unknown as number[]);
};

const str2ab = (str: string): ArrayBuffer => {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
};

// Base64 helpers
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

// Check if Crypto API is available
const isCryptoAvailable = () => {
  return window.crypto && window.crypto.subtle;
};

// --- MOCK FALLBACKS FOR NON-SECURE CONTEXTS (HTTP/IP) ---
const mockGenerateKey = async (): Promise<CryptoKeyPair> => {
  console.warn("⚠️ INSECURE CONTEXT: Using Mock Keys");
  return { publicKey: {} as CryptoKey, privateKey: {} as CryptoKey };
};

const mockEncrypt = async (content: string): Promise<{ encryptedKey: string; encryptedContent: string; iv: string }> => {
  // Simple Base64 "Encryption" for demo purposes only when SSL is missing
  return {
    encryptedKey: "mock_key",
    encryptedContent: window.btoa(content),
    iv: "mock_iv"
  };
};

const mockDecrypt = async (bundle: any): Promise<string> => {
  return window.atob(bundle.encryptedContent);
};

// 1. Generate Identity
export const generateIdentity = async (): Promise<CryptoKeyPair> => {
  if (!isCryptoAvailable()) return mockGenerateKey();
  
  return window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
};

// 2. Export Key
export const exportPublicKey = async (key: CryptoKey): Promise<JsonWebKey> => {
  if (!isCryptoAvailable()) return { kty: "RSA", alg: "RSA-OAEP-256", ext: true };
  return window.crypto.subtle.exportKey("jwk", key);
};

export const exportPrivateKey = async (key: CryptoKey): Promise<JsonWebKey> => {
    if (!isCryptoAvailable()) return { kty: "RSA", alg: "RSA-OAEP-256", ext: true };
    return window.crypto.subtle.exportKey("jwk", key);
};

// 3. Import Key
export const importPublicKey = async (jwk: JsonWebKey): Promise<CryptoKey> => {
  if (!isCryptoAvailable()) return {} as CryptoKey;
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
};

export const importPrivateKey = async (jwk: JsonWebKey): Promise<CryptoKey> => {
    if (!isCryptoAvailable()) return {} as CryptoKey;
    return window.crypto.subtle.importKey(
      "jwk",
      jwk,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["decrypt"]
    );
  };

// 4. Encrypt Message
export const encryptMessage = async (
  content: string, 
  receiverPublicKey: CryptoKey
): Promise<{ encryptedKey: string; encryptedContent: string; iv: string }> => {
  
  if (!isCryptoAvailable()) {
      return mockEncrypt(content);
  }
  
  // A. Generate Session Key (AES-GCM)
  const sessionKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // B. Encrypt Content
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedContent = new TextEncoder().encode(content);
  
  const encryptedContentBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    sessionKey,
    encodedContent
  );

  // C. Encrypt Session Key with Receiver's Public Key
  const rawSessionKey = await window.crypto.subtle.exportKey("raw", sessionKey);
  const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    receiverPublicKey,
    rawSessionKey
  );

  const bundle = {
    encryptedKey: arrayBufferToBase64(encryptedKeyBuffer),
    encryptedContent: arrayBufferToBase64(encryptedContentBuffer),
    iv: arrayBufferToBase64(iv.buffer)
  };

  return bundle;
};

// 5. Decrypt Message
export const decryptMessage = async (
  bundle: { encryptedKey: string; encryptedContent: string; iv: string },
  recipientPrivateKey: CryptoKey
): Promise<string> => {
  
  if (!isCryptoAvailable()) {
      return mockDecrypt(bundle);
  }

  try {
    // A. Decrypt Session Key using Private Key
    const encryptedKeyBuffer = base64ToArrayBuffer(bundle.encryptedKey);
    const rawSessionKey = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      recipientPrivateKey,
      encryptedKeyBuffer
    );

    // B. Import the Session Key
    const sessionKey = await window.crypto.subtle.importKey(
      "raw",
      rawSessionKey,
      { name: "AES-GCM" },
      true,
      ["decrypt"]
    );

    // C. Decrypt Content
    const iv = base64ToArrayBuffer(bundle.iv);
    const encryptedContentBuffer = base64ToArrayBuffer(bundle.encryptedContent);

    const decryptedContentBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      sessionKey,
      encryptedContentBuffer
    );

    const plaintext = new TextDecoder().decode(decryptedContentBuffer);
    return plaintext;
  } catch (e) {
    console.error("Decryption failed", e);
    throw new Error("Failed to decrypt message. It may be corrupt or for a different identity.");
  }
};

// 6. Generate Mnemonic
export const generateRecoveryPhrase = (): string => {
  const words = ["alpha", "bravo", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa", "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey", "xray", "yankee", "zulu", "nebula", "cipher", "quantum", "void", "star", "prism", "flux"];
  const phrase = [];
  for(let i=0; i<12; i++) {
    const idx = Math.floor(Math.random() * words.length);
    phrase.push(words[idx]);
  }
  return phrase.join(" ");
};

// 7. BACKUP & RESTORE UTILITIES
export const serializeIdentity = async (identity: PrivateIdentity): Promise<string> => {
    // Export Keys to JSON Web Keys (JWK)
    const pubJwk = await exportPublicKey(identity.keyPair.publicKey);
    const privJwk = await exportPrivateKey(identity.keyPair.privateKey);

    const exportObj = {
        ...identity,
        keyPair: {
            publicKey: pubJwk,
            privateKey: privJwk
        },
        version: 1,
        exportedAt: Date.now()
    };

    // Convert to JSON then Base64 for a single "Key String"
    return window.btoa(JSON.stringify(exportObj));
};

export const deserializeIdentity = async (identityString: string): Promise<PrivateIdentity> => {
    try {
        const jsonStr = window.atob(identityString);
        const parsed = JSON.parse(jsonStr);

        // Re-import JWK to CryptoKey objects
        const publicKey = await importPublicKey(parsed.keyPair.publicKey);
        const privateKey = await importPrivateKey(parsed.keyPair.privateKey);

        const restoredIdentity: PrivateIdentity = {
            id: parsed.id,
            username: parsed.username,
            recoveryPhrase: parsed.recoveryPhrase,
            settings: parsed.settings,
            blockedUsers: parsed.blockedUsers || [],
            keyPair: {
                publicKey,
                privateKey
            }
        };

        return restoredIdentity;
    } catch (e) {
        console.error("Failed to restore identity", e);
        throw new Error("Invalid Identity Key File or String");
    }
};
