// Хранилище медиа инцидентов (видео и кадры) — S3-совместимый бакет Railway.
// Переменные окружения: BUCKET_ENDPOINT, BUCKET_NAME, BUCKET_REGION, BUCKET_ACCESS_KEY_ID, BUCKET_SECRET_ACCESS_KEY,
// BUCKET_URL_STYLE (path | virtual-hosted).
import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { Readable } from "stream"

let client: S3Client | null = null

export function bucketConfigured(): boolean {
  return !!(process.env.BUCKET_ENDPOINT && process.env.BUCKET_NAME && process.env.BUCKET_ACCESS_KEY_ID && process.env.BUCKET_SECRET_ACCESS_KEY)
}

function s3(): S3Client {
  if (client) return client
  client = new S3Client({
    endpoint: process.env.BUCKET_ENDPOINT,
    region: process.env.BUCKET_REGION || "auto",
    forcePathStyle: (process.env.BUCKET_URL_STYLE || "").toLowerCase().startsWith("path"),
    credentials: {
      accessKeyId: process.env.BUCKET_ACCESS_KEY_ID!,
      secretAccessKey: process.env.BUCKET_SECRET_ACCESS_KEY!,
    },
  })
  return client
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key }))
    return true
  } catch {
    return false
  }
}

// Загрузить поток в бакет (многочастная загрузка — подходит для больших видео)
export async function uploadStream(key: string, body: ReadableStream<Uint8Array>, contentType: string | null) {
  const upload = new Upload({
    client: s3(),
    params: {
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      Body: Readable.fromWeb(body as import("stream/web").ReadableStream<Uint8Array>),
      ContentType: contentType || undefined,
    },
    queueSize: 3,
    partSize: 8 * 1024 * 1024,
  })
  await upload.done()
}

// Временная ссылка на просмотр (1 час)
export async function signedMediaUrl(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key }), { expiresIn: 3600 })
}
