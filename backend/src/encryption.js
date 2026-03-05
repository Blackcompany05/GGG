const crypto = require('crypto');

class EncryptionService {
  constructor(masterKey) {
    // Decode Base64 master key
    this.masterKey = Buffer.from(masterKey, 'base64');
    
    if (this.masterKey.length !== 32) {
      throw new Error('Master key must be 32 bytes (256 bits)');
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {string} plaintext - Data to encrypt
   * @returns {object} Object containing iv, data, and tag (all Base64 encoded)
   */
  encrypt(plaintext) {
    try {
      // Generate random 12-byte IV for GCM
      const iv = crypto.randomBytes(12);
      
      // Create cipher
      const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
      
      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Return Base64 encoded values
      return {
        iv: iv.toString('base64'),
        data: Buffer.from(encrypted, 'hex').toString('base64'),
        tag: tag.toString('base64')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @param {string} iv - Base64 encoded initialization vector
   * @param {string} tag - Base64 encoded authentication tag
   * @returns {string} Decrypted plaintext
   */
  decrypt(encryptedData, iv, tag) {
    try {
      // Decode Base64 inputs
      const ivBuffer = Buffer.from(iv, 'base64');
      const dataBuffer = Buffer.from(encryptedData, 'base64');
      const tagBuffer = Buffer.from(tag, 'base64');
      
      // Validate IV length (should be 12 bytes for GCM)
      if (ivBuffer.length !== 12) {
        throw new Error('Invalid IV length. Expected 12 bytes.');
      }
      
      // Validate tag length (should be 16 bytes)
      if (tagBuffer.length !== 16) {
        throw new Error('Invalid authentication tag length. Expected 16 bytes.');
      }
      
      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, ivBuffer);
      
      // Set authentication tag
      decipher.setAuthTag(tagBuffer);
      
      // Decrypt
      let decrypted = decipher.update(dataBuffer.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Generate a new master key
   * @returns {string} Base64 encoded 32-byte key
   */
  static generateMasterKey() {
    return crypto.randomBytes(32).toString('base64');
  }
}

module.exports = EncryptionService;
