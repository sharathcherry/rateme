import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

function sanitizeFileName(fileName) {
  return String(fileName || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

function extensionFromFileName(fileName) {
  const sanitized = sanitizeFileName(fileName);
  const pieces = sanitized.split('.');
  if (pieces.length < 2) return 'bin';
  const ext = pieces.pop().toLowerCase();
  return ext || 'bin';
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify required environment variables
    if (!process.env.AWS_REGION || !process.env.AWS_S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error('Missing AWS env vars');
      return res.status(500).json({
        error: 'Server misconfigured: Missing AWS credentials',
      });
    }

    if (!firebaseProjectId) {
      console.error('Missing FIREBASE_PROJECT_ID');
      return res.status(500).json({
        error: 'Server misconfigured: Missing Firebase project ID',
      });
    }

    // Verify Bearer token
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }

    const idToken = authHeader.slice('Bearer '.length).trim();
    
    // Verify JWT
    let payload;
    try {
      const verified = await jwtVerify(idToken, firebaseJwks, {
        issuer: `https://securetoken.google.com/${firebaseProjectId}`,
        audience: firebaseProjectId,
      });
      payload = verified.payload;
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { uid, photoNum, fileName, contentType } = req.body || {};
    const tokenUid = payload.user_id || payload.sub;
    
    if (!uid || uid !== tokenUid) {
      return res.status(403).json({ error: 'UID mismatch' });
    }

    // Prepare S3 upload
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const normalizedPhotoNum = photoNum === 2 ? 2 : 1;
    const ext = extensionFromFileName(fileName);
    const safeContentType = String(contentType || 'application/octet-stream').slice(0, 200);
    const key = `profiles/${uid}/photo_${normalizedPhotoNum}_${Date.now()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      ContentType: safeContentType,
    });

    const signedUrlTtlSeconds = Number(process.env.SIGNED_URL_TTL_SECONDS || 300);
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: signedUrlTtlSeconds });
    
    const publicBaseUrl =
      process.env.AWS_S3_PUBLIC_BASE_URL ||
      `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    
    const fileUrl = `${publicBaseUrl.replace(/\/+$/, '')}/${encodeURI(key)}`;

    return res.status(200).json({
      uploadUrl,
      fileUrl,
      method: 'PUT',
      headers: {
        'Content-Type': safeContentType,
      },
    });
  } catch (error) {
    console.error('Signing error:', error);
    return res.status(500).json({
      error: 'Failed to generate signed upload URL',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
