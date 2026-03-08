/**
 * Auth admin: password (bcrypt), TOTP (otplib), JWT (jose).
 * Dipendenze: bcryptjs, otplib, jose.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { generateSecret, verify, generateURI } from 'otplib';
import * as jose from 'jose';
import { sql } from './db.mjs';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.ADMIN_SECRET || 'change-me';
const ISSUER = 'comtra-admin';
const SESSION_EXP = '24h'; // sessione dopo login (standard admin)
const TEMP_TOKEN_EXP = '5m';
const MAGIC_LINK_EXP = '15m'; // link nel messaggio email

function getSecretKey() {
  return crypto.createSecretKey(Buffer.from(JWT_SECRET, 'utf-8'));
}

export async function getAdminByEmail(email) {
  if (!sql || !email || typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const result = await sql`
    SELECT id, email, password_hash, totp_secret, created_at, updated_at
    FROM admin_users
    WHERE LOWER(email) = ${normalized}
    LIMIT 1
  `;
  return result.rows?.[0] ?? null;
}

export async function verifyPassword(plainPassword, passwordHash) {
  if (!plainPassword || !passwordHash) return false;
  return bcrypt.compare(plainPassword, passwordHash);
}

export async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

/** Genera secret TOTP (Base32) per 2FA */
export function createTotpSecret() {
  return generateSecret();
}

/** Verifica codice a 6 cifre contro secret TOTP */
export async function verifyTotp(secret, token) {
  if (!secret || !token) return false;
  const code = String(token).replace(/\s/g, '').trim();
  if (code.length !== 6) return false;
  return verify({ secret, token: code });
}

/** URI per QR code (Google Authenticator, ecc.) */
export function getTotpUri({ secret, email, issuer = 'Comtra Admin' }) {
  return generateURI({ issuer, label: email, secret });
}

/** Token temporaneo per step 2FA (dopo login, prima di verify/confirm) */
export async function createTempToken(payload) {
  const key = getSecretKey();
  return new jose.SignJWT({ ...payload, purpose: '2fa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setExpirationTime(TEMP_TOKEN_EXP)
    .sign(key);
}

/** Token per setup 2FA (contiene pendingSecret; usato solo in confirm-2fa) */
export async function createSetupToken(payload) {
  const key = getSecretKey();
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setExpirationTime(TEMP_TOKEN_EXP)
    .sign(key);
}

/** Verifica temp token e ritorna payload */
export async function verifyTempToken(token) {
  if (!token) return null;
  try {
    const key = getSecretKey();
    const { payload } = await jose.jwtVerify(token, key, { issuer: ISSUER });
    return payload;
  } catch {
    return null;
  }
}

/** Token di sessione (dopo login + 2FA completato) */
export async function createSessionToken(payload) {
  const key = getSecretKey();
  return new jose.SignJWT({ ...payload, purpose: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setExpirationTime(SESSION_EXP)
    .sign(key);
}

/** Verifica JWT sessione; ritorna payload o null */
export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const key = getSecretKey();
    const { payload } = await jose.jwtVerify(token, key, { issuer: ISSUER });
    if (payload.purpose !== 'session') return null;
    return payload;
  } catch {
    return null;
  }
}

/** Token per magic link (incluso nel link email); scadenza 15 min */
export async function createMagicLinkToken(payload) {
  const key = getSecretKey();
  return new jose.SignJWT({ ...payload, purpose: 'magic-link' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setExpirationTime(MAGIC_LINK_EXP)
    .sign(key);
}

/** Verifica token magic link; ritorna payload o null */
export async function verifyMagicLinkToken(token) {
  if (!token) return null;
  try {
    const key = getSecretKey();
    const { payload } = await jose.jwtVerify(token, key, { issuer: ISSUER });
    if (payload.purpose !== 'magic-link') return null;
    return payload;
  } catch {
    return null;
  }
}

export async function updateUserTotp(userId, totpSecret) {
  if (!sql) return false;
  const now = new Date().toISOString();
  await sql`
    UPDATE admin_users
    SET totp_secret = ${totpSecret}, updated_at = ${now}
    WHERE id = ${userId}
  `;
  return true;
}
