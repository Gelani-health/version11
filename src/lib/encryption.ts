/**
 * AES-256 Encryption Utility for Sensitive Data
 * 
 * Uses AES-256-GCM for authenticated encryption
 * - Provides confidentiality and integrity
 * - Uses environment variable ENCRYPTION_KEY for the secret key
 * - Key must be 32 bytes (256 bits)
 * 
 * Security Features:
 * - AES-GCM provides authenticated encryption (confidentiality + integrity)
 * - Random IV (initialization vector) for each encryption
 * - PBKDF2 key derivation from environment secret
 */

import crypto from 'crypto'

// Configuration
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits
const SALT_LENGTH = 32
const PBKDF2_ITERATIONS = 100000

/**
 * Get the encryption key from environment
 * Derives a proper 32-byte key using PBKDF2
 */
function getEncryptionKey(salt: Buffer): Buffer {
  const secret = process.env.ENCRYPTION_KEY
  
  if (!secret) {
    throw new Error('ENCRYPTION_KEY environment variable is not set. Please set it to a secure random string.')
  }
  
  // Derive a 32-byte key using PBKDF2
  return crypto.pbkdf2Sync(
    secret,
    salt,
    PBKDF2_ITERATIONS,
    32, // 256 bits
    'sha256'
  )
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * 
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format: salt:iv:authTag:ciphertext (all base64)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return ''
  
  try {
    // Generate random salt for key derivation
    const salt = crypto.randomBytes(SALT_LENGTH)
    
    // Derive encryption key
    const key = getEncryptionKey(salt)
    
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH)
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH
    })
    
    // Encrypt
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
    ciphertext += cipher.final('base64')
    
    // Get auth tag
    const authTag = cipher.getAuthTag()
    
    // Return combined format: salt:iv:authTag:ciphertext
    return [
      salt.toString('base64'),
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext
    ].join(':')
  } catch (error) {
    console.error('[Encryption] Encryption failed:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt an encrypted string using AES-256-GCM
 * 
 * @param encryptedData - The encrypted string in format: salt:iv:authTag:ciphertext
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return ''
  
  // Check if data is in the new encrypted format
  const parts = encryptedData.split(':')
  if (parts.length !== 4) {
    // Legacy unencrypted data - return as-is for backward compatibility
    // This allows migration of existing plaintext API keys
    console.warn('[Encryption] Data appears to be unencrypted (legacy format)')
    return encryptedData
  }
  
  try {
    const [saltB64, ivB64, authTagB64, ciphertext] = parts
    
    // Decode components
    const salt = Buffer.from(saltB64, 'base64')
    const iv = Buffer.from(ivB64, 'base64')
    const authTag = Buffer.from(authTagB64, 'base64')
    
    // Derive decryption key
    const key = getEncryptionKey(salt)
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH
    })
    
    // Set auth tag for verification
    decipher.setAuthTag(authTag)
    
    // Decrypt
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8')
    plaintext += decipher.final('utf8')
    
    return plaintext
  } catch (error) {
    console.error('[Encryption] Decryption failed:', error)
    // For security, don't reveal detailed error
    throw new Error('Failed to decrypt data - data may be corrupted or tampered')
  }
}

/**
 * Check if a string is encrypted (has the encrypted format)
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false
  const parts = data.split(':')
  if (parts.length !== 4) return false
  
  // Try to decode each part as base64
  try {
    const [saltB64, ivB64, authTagB64, ciphertext] = parts
    Buffer.from(saltB64, 'base64')
    Buffer.from(ivB64, 'base64')
    Buffer.from(authTagB64, 'base64')
    return ciphertext.length > 0
  } catch {
    return false
  }
}

/**
 * Encrypt API key specifically (with validation)
 * Validates that the key looks like an API key before encrypting
 */
export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return ''
  
  // Don't re-encrypt already encrypted data
  if (isEncrypted(apiKey)) {
    return apiKey
  }
  
  return encrypt(apiKey)
}

/**
 * Decrypt API key specifically (with validation)
 */
export function decryptApiKey(encryptedKey: string): string {
  if (!encryptedKey) return ''
  
  // Handle legacy unencrypted keys
  if (!isEncrypted(encryptedKey)) {
    return encryptedKey
  }
  
  return decrypt(encryptedKey)
}

/**
 * Generate a secure random encryption key for ENCRYPTION_KEY env var
 * Run this once to generate a key for your environment
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64')
}

/**
 * Rotate encryption for all LLM integration API keys
 * Call this when rotating the ENCRYPTION_KEY
 */
export async function rotateApiKeysEncryption(
  oldKey: string,
  newKey: string,
  getAllIntegrations: () => Promise<Array<{ id: string; apiKey: string | null }>>,
  updateIntegration: (id: string, apiKey: string) => Promise<void>
): Promise<{ success: boolean; rotated: number; errors: string[] }> {
  const errors: string[] = []
  let rotated = 0
  
  try {
    // Temporarily set old key for decryption
    const originalKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = oldKey
    
    const integrations = await getAllIntegrations()
    
    // Switch to new key for re-encryption
    process.env.ENCRYPTION_KEY = newKey
    
    for (const integration of integrations) {
      if (!integration.apiKey) continue
      
      try {
        // Decrypt with old key (or handle legacy plaintext)
        const decryptedKey = decryptApiKey(integration.apiKey)
        
        // Re-encrypt with new key
        const newEncryptedKey = encrypt(decryptedKey)
        
        // Update in database
        await updateIntegration(integration.id, newEncryptedKey)
        rotated++
      } catch (error) {
        errors.push(`Failed to rotate key for integration ${integration.id}: ${error}`)
      }
    }
    
    // Restore original key (caller should update env var)
    process.env.ENCRYPTION_KEY = originalKey
    
    return { success: errors.length === 0, rotated, errors }
  } catch (error) {
    return { 
      success: false, 
      rotated, 
      errors: [`Rotation failed: ${error}`] 
    }
  }
}
