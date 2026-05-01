import crypto from 'crypto';

// Simple JWT implementation (Node 20+)
export class JWTManager {
  constructor(secret) {
    if (!secret || secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters');
    }
    this.secret = secret;
  }

  sign(payload, expiresIn = '7d') {
    const now = Math.floor(Date.now() / 1000);
    const expireSeconds = this.parseExpiry(expiresIn);

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const claims = {
      ...payload,
      iat: now,
      exp: now + expireSeconds,
    };

    const encoded = {
      header: Buffer.from(JSON.stringify(header)).toString('base64url'),
      payload: Buffer.from(JSON.stringify(claims)).toString('base64url'),
    };

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${encoded.header}.${encoded.payload}`)
      .digest('base64url');

    return `${encoded.header}.${encoded.payload}.${signature}`;
  }

  verify(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signatureB64 !== expectedSignature) {
      throw new Error('Invalid signature');
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return payload;
  }

  parseExpiry(expiresIn) {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error('Invalid expiry format');

    const [, value, unit] = match;
    const v = parseInt(value);

    switch (unit) {
      case 's': return v;
      case 'm': return v * 60;
      case 'h': return v * 60 * 60;
      case 'd': return v * 24 * 60 * 60;
      default: throw new Error('Invalid expiry unit');
    }
  }
}

export function createJWTManager(secret) {
  return new JWTManager(secret);
}
