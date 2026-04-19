import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envServerPath = path.resolve(__dirname, '..', '.env.server');
dotenv.config(existsSync(envServerPath) ? { path: envServerPath } : undefined);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function resolveFirebaseProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  const configPath = path.resolve(__dirname, '..', 'firebase-applet-config.json');
  const json = readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(json);
  if (!parsed.projectId) {
    throw new Error('Missing FIREBASE_PROJECT_ID and firebase-applet-config.json.projectId');
  }
  return parsed.projectId;
}

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

async function buildServer() {
  const firebaseProjectId = resolveFirebaseProjectId();
  const firebaseJwks = createRemoteJWKSet(
    new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
  );

  const awsRegion = requireEnv('AWS_REGION');
  const awsBucket = requireEnv('AWS_S3_BUCKET');
  const awsAccessKeyId = requireEnv('AWS_ACCESS_KEY_ID');
  const awsSecretAccessKey = requireEnv('AWS_SECRET_ACCESS_KEY');
  const signedUrlTtlSeconds = Number(process.env.SIGNED_URL_TTL_SECONDS || 300);
  const publicBaseUrl =
    process.env.AWS_S3_PUBLIC_BASE_URL ||
    `https://${awsBucket}.s3.${awsRegion}.amazonaws.com`;

  const s3 = new S3Client({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    },
  });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/uploads/sign', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing Bearer token' });
      }

      const idToken = authHeader.slice('Bearer '.length).trim();
      const { payload } = await jwtVerify(idToken, firebaseJwks, {
        issuer: `https://securetoken.google.com/${firebaseProjectId}`,
        audience: firebaseProjectId,
      });

      const { uid, photoNum, fileName, contentType } = req.body || {};
      const tokenUid = payload.user_id || payload.sub;
      if (!uid || uid !== tokenUid) {
        return res.status(403).json({ error: 'UID mismatch' });
      }

      const normalizedPhotoNum = photoNum === 2 ? 2 : 1;
      const ext = extensionFromFileName(fileName);
      const safeContentType = String(contentType || 'application/octet-stream').slice(0, 200);
      const key = `profiles/${uid}/photo_${normalizedPhotoNum}_${Date.now()}.${ext}`;

      const command = new PutObjectCommand({
        Bucket: awsBucket,
        Key: key,
        ContentType: safeContentType,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: signedUrlTtlSeconds });
      const fileUrl = `${publicBaseUrl.replace(/\/+$/, '')}/${encodeURI(key)}`;

      return res.json({
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
  });

  return app;
}

const port = Number(process.env.PORT || 4000);
const app = await buildServer();
app.listen(port, () => {
  console.log(`Upload signer listening on http://localhost:${port}`);
});
