import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';

const bucketName = process.env.GCS_BUCKET_NAME;

// Lazily initialize storage client
let storage: Storage | null = null;
if (bucketName) {
  storage = new Storage();
}

/**
 * Maps GCS logical filenames (e.g., 'knowledge_base.json', 'laws_json/constitution_2072.json')
 * to local filesystem paths for offline/fallback development.
 */
function getLocalPath(fileName: string): string {
  if (fileName === 'knowledge_base.json') {
    return path.join(process.cwd(), 'public/knowledge_base.json');
  }
  if (fileName.startsWith('laws_json/')) {
    const actJsonName = fileName.replace('laws_json/', '');
    return path.join(process.cwd(), '../data/laws_json', actJsonName);
  }
  return path.join(process.cwd(), fileName);
}

/**
 * Resolves the GCS File object by checking the requested path and alternative path structures 
 * (e.g., handles if the user uploaded folders with a "data/" prefix).
 */
async function resolveGCSFile(bucket: any, fileName: string): Promise<any> {
  // 1. Direct path check
  const fileDirect = bucket.file(fileName);
  const [existsDirect] = await fileDirect.exists();
  if (existsDirect) {
    return fileDirect;
  }

  // 2. Alternative "data/" folder prefix check
  const altPath = `data/${fileName}`;
  const fileAlt = bucket.file(altPath);
  const [existsAlt] = await fileAlt.exists();
  if (existsAlt) {
    console.log(`[GCS-Helper] Path auto-resolve redirect: "${fileName}" -> GCS: "${altPath}"`);
    return fileAlt;
  }

  // 3. Alternative "public/" prefix checks for the main index
  if (fileName === 'knowledge_base.json') {
    const publicPaths = ['public/knowledge_base.json', 'data/public/knowledge_base.json', 'data/knowledge_base.json'];
    for (const pubPath of publicPaths) {
      const filePub = bucket.file(pubPath);
      const [existsPub] = await filePub.exists();
      if (existsPub) {
        console.log(`[GCS-Helper] Path auto-resolve redirect: "knowledge_base.json" -> GCS: "${pubPath}"`);
        return filePub;
      }
    }
  }

  // 4. Default to standard requested path for creation
  return fileDirect;
}

/**
 * Reads a JSON file from GCS, falling back to local file system if GCS is unconfigured.
 */
export async function readJsonFromGCS<T = any>(fileName: string): Promise<T> {
  if (bucketName && storage) {
    try {
      const bucket = storage.bucket(bucketName);
      const file = await resolveGCSFile(bucket, fileName);
      const [content] = await file.download();
      return JSON.parse(content.toString('utf8')) as T;
    } catch (err: any) {
      if (err.message?.includes('Could not load the default credentials')) {
        console.log(`[GCS-Helper] Local development detected (GCP credentials not found). Safely falling back to local file system.`);
      } else {
        console.error(`[GCS-Helper] Error reading ${fileName} from GCS:`, err.message);
      }
    }
  }

  // Fallback to local filesystem
  const localPath = getLocalPath(fileName);
  if (!fs.existsSync(localPath)) {
    throw new Error(`[GCS-Helper] Local file not found at: ${localPath}`);
  }
  const content = fs.readFileSync(localPath, 'utf8');
  return JSON.parse(content) as T;
}

/**
 * Writes a JSON file to GCS, falling back to local file system if GCS is unconfigured.
 */
export async function writeJsonToGCS(fileName: string, data: any): Promise<void> {
  const jsonString = JSON.stringify(data, null, 2);

  if (bucketName && storage) {
    try {
      const bucket = storage.bucket(bucketName);
      const file = await resolveGCSFile(bucket, fileName);
      console.log(`[GCS-Helper] Writing to GCS bucket "${bucketName}" at path "${file.name}"...`);
      await file.save(jsonString, {
        contentType: 'application/json',
        resumable: false, // best for small files
      });
      console.log(`[GCS-Helper] Successfully saved to GCS path "${file.name}".`);
      return;
    } catch (err: any) {
      console.error(`[GCS-Helper] Error writing to GCS: ${err.message}. Saving to local fallback.`);
    }
  }

  // Fallback to local filesystem
  const localPath = getLocalPath(fileName);
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(localPath, jsonString, 'utf8');
  console.log(`[GCS-Helper] Successfully saved local copy to ${localPath}`);
}

/**
 * Simple helper to check if a file exists in GCS or locally.
 */
export async function fileExistsInGCS(fileName: string): Promise<boolean> {
  if (bucketName && storage) {
    try {
      const bucket = storage.bucket(bucketName);
      const file = await resolveGCSFile(bucket, fileName);
      const [exists] = await file.exists();
      return exists;
    } catch (err: any) {
      console.error(`[GCS-Helper] Error checking GCS file existence:`, err.message);
    }
  }

  const localPath = getLocalPath(fileName);
  return fs.existsSync(localPath);
}


