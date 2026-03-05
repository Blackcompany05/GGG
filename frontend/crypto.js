/**
 * Client-side AES-256-GCM Encryption/Decryption Service
 * Uses WebCrypto API for secure encryption
 */

class ClientEncryptionService {
    /**
     * Convert Base64 string to ArrayBuffer
     */
    static base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Convert ArrayBuffer to Base64 string
     */
    static arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Import Base64 encoded master key to CryptoKey
     */
    static async importKey(masterKeyBase64) {
        const keyBuffer = this.base64ToArrayBuffer(masterKeyBase64);
        
        return await window.crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt plaintext using AES-256-GCM
     */
    static async encrypt(plaintext, cryptoKey) {
        try {
            // Generate random 12-byte IV
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            // Encode plaintext to bytes
            const encoder = new TextEncoder();
            const data = encoder.encode(plaintext);
            
            // Encrypt using AES-GCM
            const encryptedData = await window.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                cryptoKey,
                data
            );
            
            // Extract GCM tag (last 16 bytes) from encryptedData
            const encryptedBytes = new Uint8Array(encryptedData);
            const tagBytes = encryptedBytes.slice(-16);
            const ciphertextBytes = encryptedBytes.slice(0, -16);
            
            // Return Base64 encoded values
            return {
                iv: this.arrayBufferToBase64(iv),
                data: this.arrayBufferToBase64(ciphertextBytes.buffer),
                tag: this.arrayBufferToBase64(tagBytes.buffer)
            };
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt ciphertext using AES-256-GCM
     */
    static async decrypt(encryptedDataBase64, ivBase64, cryptoKey, tagBase64 = null) {
        try {
            // Decode Base64 inputs
            const iv = new Uint8Array(this.base64ToArrayBuffer(ivBase64));
            const encryptedData = new Uint8Array(this.base64ToArrayBuffer(encryptedDataBase64));
            
            // If tag is provided separately, append it to encryptedData
            let dataToDecrypt;
            if (tagBase64) {
                const tag = new Uint8Array(this.base64ToArrayBuffer(tagBase64));
                dataToDecrypt = new Uint8Array([...encryptedData, ...tag]);
            } else {
                dataToDecrypt = encryptedData;
            }
            
            // Decrypt using AES-GCM
            const decryptedData = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                cryptoKey,
                dataToDecrypt
            );
            
            // Decode to string
            const decoder = new TextDecoder();
            return decoder.decode(decryptedData);
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Generate a new master key
     */
    static async generateMasterKey() {
        const key = await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        
        const exported = await window.crypto.subtle.exportKey('raw', key);
        return this.arrayBufferToBase64(exported);
    }

    /**
     * Get random bytes as Base64
     */
    static getRandomBytes(length) {
        const bytes = window.crypto.getRandomValues(new Uint8Array(length));
        return this.arrayBufferToBase64(bytes);
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClientEncryptionService;
}
