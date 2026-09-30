import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

/** Server-only datasets live in the private `benklosky-data` DigitalOcean Space, never on disk. */

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

let client: S3Client | undefined;

function spaces() {
  client ??= new S3Client({
    endpoint: env("SPACES_ENDPOINT"),
    // Spaces ignores the region, but the SDK requires one.
    region: "us-east-1",
    credentials: {
      accessKeyId: env("SPACES_KEY"),
      secretAccessKey: env("SPACES_SECRET"),
    },
    // Spaces rejects the SDK's default CRC checksums.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

export async function readObject(key: string) {
  const response = await spaces().send(
    new GetObjectCommand({ Bucket: env("SPACES_BUCKET"), Key: key }),
  );
  if (!response.Body) throw new Error(`${key} is empty`);
  return response.Body.transformToByteArray();
}

export async function readJson<T>(key: string): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await readObject(key))) as T;
}
