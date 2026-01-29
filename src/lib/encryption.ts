/**
 * AES-256-GCM Encryption Utilities
 *
 * Uses Web Crypto API for secure encryption of sensitive data like router passwords.
 * The encryption key is derived from VITE_ENCRYPTION_KEY environment variable.
 */

// Get encryption key from environment variable
const ENCRYPTION_KEY =
  import.meta.env.VITE_ENCRYPTION_KEY || 'taskaroo-default-key-change-in-production';

// Convert string to ArrayBuffer
function stringToBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer as ArrayBuffer;
}

// Convert ArrayBuffer to string
function bufferToString(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder();
  return decoder.decode(buffer);
}

// Convert ArrayBuffer to base64 string
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 string to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derive a cryptographic key from the encryption key string using PBKDF2
 */
async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  // Import the raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToBuffer(ENCRYPTION_KEY),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive the actual encryption key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string using AES-256-GCM
 *
 * @param plaintext - The string to encrypt
 * @returns Base64 encoded string containing: salt (16 bytes) + iv (12 bytes) + ciphertext + auth tag
 */
export async function encrypt(plaintext: string): Promise<string> {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive the key
  const key = await deriveKey(salt);

  // Encrypt the plaintext
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    stringToBuffer(plaintext)
  );

  // Combine salt + iv + ciphertext into a single buffer
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  // Return as base64
  return bufferToBase64(combined.buffer);
}

/**
 * Decrypt a string that was encrypted with the encrypt function
 *
 * @param encryptedData - Base64 encoded encrypted data
 * @returns The decrypted plaintext string
 */
export async function decrypt(encryptedData: string): Promise<string> {
  try {
    // Decode from base64
    const combined = new Uint8Array(base64ToBuffer(encryptedData));

    // Extract salt, iv, and ciphertext
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);

    // Derive the key using the same salt
    const key = await deriveKey(salt);

    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );

    return bufferToString(plaintext);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if a string appears to be encrypted (basic format check)
 */
export function isEncrypted(data: string): boolean {
  try {
    // Try to decode as base64
    const decoded = atob(data);
    // Encrypted data should be at least 28 bytes (16 salt + 12 iv)
    return decoded.length >= 28;
  } catch {
    return false;
  }
}
