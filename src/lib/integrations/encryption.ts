import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
        'Generate a 32-character key and add it to your .env.local file.'
    )
  }
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly ${KEY_LENGTH} characters. ` +
        `Current length: ${key.length}.`
    )
  }
  return Buffer.from(key, 'utf-8')
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (all hex encoded).
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('Cannot encrypt empty or undefined text.')
  }

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf-8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypts a string previously encrypted with `encrypt()`.
 * Expects format: iv:authTag:ciphertext (all hex encoded).
 */
export function decrypt(encrypted: string): string {
  if (!encrypted) {
    throw new Error('Cannot decrypt empty or undefined text.')
  }

  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted data format. Expected iv:authTag:ciphertext (hex encoded).'
    )
  }

  const [ivHex, authTagHex, ciphertext] = parts

  if (ivHex.length !== IV_LENGTH * 2) {
    throw new Error(
      `Invalid IV length. Expected ${IV_LENGTH * 2} hex characters, got ${ivHex.length}.`
    )
  }
  if (authTagHex.length !== AUTH_TAG_LENGTH * 2) {
    throw new Error(
      `Invalid auth tag length. Expected ${AUTH_TAG_LENGTH * 2} hex characters, got ${authTagHex.length}.`
    )
  }

  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext, 'hex', 'utf-8')
  decrypted += decipher.final('utf-8')

  return decrypted
}
