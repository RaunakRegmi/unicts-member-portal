const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const config = require('../config/env');

// S3-compatible object storage when configured; otherwise a local ./uploads
// directory with HMAC-signed, expiring URLs so the "private bucket + signed
// URL" access model holds in development too.

let s3 = null;
if (config.s3.enabled) {
  const { S3Client } = require('@aws-sdk/client-s3');
  s3 = new S3Client({
    region: config.s3.region,
    endpoint: config.s3.endpoint || undefined,
    forcePathStyle: Boolean(config.s3.endpoint),
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
    },
  });
}

function makeKey(folder, originalName = '') {
  const ext = path
    .extname(originalName)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, '')
    .slice(0, 10);
  return `${folder}/${crypto.randomUUID()}${ext}`;
}

function safeLocalPath(key) {
  const filePath = path.resolve(config.uploadsDir, key);
  if (!filePath.startsWith(path.resolve(config.uploadsDir) + path.sep)) {
    throw new Error('Invalid storage key');
  }
  return filePath;
}

async function putObject(key, buffer, contentType) {
  if (s3) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  } else {
    const filePath = safeLocalPath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
  }
  return key;
}

async function getObjectBuffer(key) {
  if (s3) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const res = await s3.send(
      new GetObjectCommand({ Bucket: config.s3.bucket, Key: key })
    );
    const chunks = [];
    for await (const chunk of res.Body) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  return fs.readFile(safeLocalPath(key));
}

async function deleteObject(key) {
  if (!key) return;
  if (s3) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await s3.send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key }));
  } else {
    await fs.unlink(safeLocalPath(key)).catch((err) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }
}

function signLocal(key, expiresAtSec) {
  return crypto
    .createHmac('sha256', config.fileSigningSecret)
    .update(`${key}:${expiresAtSec}`)
    .digest('hex');
}

async function getSignedUrl(key, { expiresIn = 300 } = {}) {
  if (!key) return null;
  if (s3) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl: presign } = require('@aws-sdk/s3-request-presigner');
    return presign(s3, new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }), {
      expiresIn,
    });
  }
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  const sig = signLocal(key, exp);
  return `${config.apiUrl}/api/files/${key
    .split('/')
    .map(encodeURIComponent)
    .join('/')}?exp=${exp}&sig=${sig}`;
}

function verifyLocalSignature(key, exp, sig) {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) return false;
  const expected = signLocal(key, expNum);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  makeKey,
  putObject,
  getObjectBuffer,
  deleteObject,
  getSignedUrl,
  verifyLocalSignature,
  isLocalMode: () => !s3,
};
