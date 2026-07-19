import { AwsClient } from 'aws4fetch'

export function createB2Client(env: {
  B2_ENDPOINT: string
  B2_REGION: string
  B2_BUCKET: string
  B2_ACCESS_KEY_ID: string
  B2_SECRET_ACCESS_KEY: string
}) {
  const { B2_ENDPOINT: endpoint, B2_REGION: region, B2_BUCKET: bucket, B2_ACCESS_KEY_ID: accessKeyId, B2_SECRET_ACCESS_KEY: secretAccessKey } = env
  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region,
  })

  function objectUrl(key: string): string {
    return `${endpoint}/${bucket}/${key}`
  }

  return {
    /**
     * Upload a file to B2. Returns the public URL.
     */
    async upload(key: string, body: string | ArrayBuffer, contentType: string): Promise<string> {
      const url = objectUrl(key)
      const res = await client.fetch(url, {
        method: 'PUT',
        body,
        headers: { 'Content-Type': contentType },
      })
      if (!res.ok) {
        throw new Error(`B2 upload failed: ${res.status} ${res.statusText}`)
      }
      return url
    },

    /**
     * Read a file from B2 as text.
     */
    async getText(key: string): Promise<string> {
      const url = objectUrl(key)
      const res = await client.fetch(url)
      if (!res.ok) {
        throw new Error(`B2 get failed: ${res.status} ${res.statusText}`)
      }
      return res.text()
    },

    /**
     * Delete a file from B2.
     */
    async delete(key: string): Promise<void> {
      const url = objectUrl(key)
      const res = await client.fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        throw new Error(`B2 delete failed: ${res.status} ${res.statusText}`)
      }
    },
  }
}

export type B2Client = ReturnType<typeof createB2Client>
