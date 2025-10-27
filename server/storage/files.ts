import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const LOCAL_STORAGE_BASE_PATH = path.join(process.cwd(), "uploads", "case-files-storage");

function isObjectStorageConfigured(): boolean {
  return Boolean(process.env.PRIVATE_OBJECT_DIR);
}

interface PutObjectParams {
  key: string;
  buffer: Buffer;
  contentType: string;
}

interface PutObjectResult {
  publicUrl: string;
}

interface DeleteObjectParams {
  key: string;
}

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
]);

const ALLOWED_DOC_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv'
]);

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv'
]);

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
export const MAX_FILES_PER_CASE = 10;

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return { bucketName, objectName };
}

function getPrivateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) {
    throw new Error(
      "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
    );
  }
  return dir;
}

function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts and control characters
  return filename
    .replace(/[\/\\]/g, '-')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^\w\-\.]/g, '');
}

function generateStorageKey(caseId: string, originalFilename: string): string {
  const timestamp = Date.now();
  const random = randomUUID().substring(0, 8);
  const safeFilename = sanitizeFilename(originalFilename);
  return `cases/${caseId}/${timestamp}-${random}-${safeFilename}`;
}

export async function putObject({ key, buffer, contentType }: PutObjectParams): Promise<PutObjectResult> {
  if (!isObjectStorageConfigured()) {
    const targetPath = path.join(LOCAL_STORAGE_BASE_PATH, key);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, buffer);

    const publicUrlPath = ["/uploads/case-files-storage", key]
      .join("/")
      .replace(/\\+/g, "/")
      .replace(/\/+/g, "/");

    return { publicUrl: publicUrlPath };
  }

  const privateObjectDir = getPrivateObjectDir();
  const fullPath = `${privateObjectDir}/${key}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);

  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    contentType,
    metadata: {
      contentType,
    },
  });

  // Generate public URL using Google Cloud Storage's signed URL
  const [publicUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days (max allowed by GCS)
  });

  return { publicUrl };
}

export async function deleteObject({ key }: DeleteObjectParams): Promise<void> {
  if (!isObjectStorageConfigured()) {
    const targetPath = path.join(LOCAL_STORAGE_BASE_PATH, key);
    await rm(targetPath, { force: true });
    return;
  }

  const privateObjectDir = getPrivateObjectDir();
  const fullPath = `${privateObjectDir}/${key}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);

  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.delete();
}

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

export function determineFileKind(mimeType: string): 'image' | 'file' {
  return ALLOWED_IMAGE_TYPES.has(mimeType) ? 'image' : 'file';
}

export { generateStorageKey };
