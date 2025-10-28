## Encoder v2 - Node.js Video Transcoding Service

This project provides a scalable video-transcoding service (similar to Elastic Transcoder/Coconut/Qencode) with a REST API, MySQL-backed queue, Kubernetes manifests, and a minimal web dashboard.

### Features
- REST API to submit and monitor jobs
- MySQL for metadata and as the queue backend
- Worker(s) that pick jobs, download sources, transcode with `ffmpeg`, and deliver outputs
- Notification callbacks on job status changes
- Configurable retention cleanup
- Dockerized and Kubernetes-ready; scale API and worker replicas independently

### Requirements
- Node.js 20+
- MySQL 8+
- ffmpeg (installed in the container image)

### Environment
Copy `.env.example` to `.env` and set:

```
NODE_ENV=development
PORT=8080
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=encoder
MYSQL_PASSWORD=encoder_password
MYSQL_DATABASE=encoder
QUEUE_POLL_INTERVAL_MS=1000
QUEUE_VISIBILITY_TIMEOUT_MS=600000
QUEUE_MAX_ATTEMPTS=3
RETENTION_HOURS=168

# AWS Configuration (for S3 support)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

**AWS Credentials:** The application supports multiple AWS credential methods:

1. **Request Payload** (Per-job credentials):
   - Include `access_key_id` and `access_key_secret` directly in the source/destination objects
   - Useful for multi-tenant scenarios where different jobs use different AWS accounts
   - **Security Note**: Credentials are stored in the database as part of the job spec

2. **Environment Variables** (Global credentials):
   ```bash
   AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
   AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```

3. **AWS Credentials File** (`~/.aws/credentials`)

4. **IAM Roles** (Recommended for production on AWS infrastructure)

**Credential Priority:** Request payload > Environment variables > Credentials file > IAM roles

### Install & Run (Local)

**Unified Application (Recommended):**
```
npm install
npm run dev
```

**Legacy Separate API and Worker:**
```
npm install
npm run dev:api
npm run dev:worker
```

### Database Schema (MySQL)
Tables:
- `jobs`: one row per submitted job; stores source JSON, status, timestamps
- `job_outputs`: one row per output rendition; spec JSON, status, result or error
- `queue_jobs`: MySQL-backed FIFO with visibility timeouts and attempts

Schema is auto-created on boot by `initDb()` in `src/db.ts`.

### Queue/Worker Model

**Unified Application:**
- API inserts a `jobs` record and `job_outputs` rows, then enqueues the job id into `queue_jobs`.
- Main application monitors the queue and spawns child processes for each job.
- Child processes handle individual jobs and exit when complete.
- Each child process runs independently, allowing for better resource isolation.

**Legacy Separate Worker:**
- Workers poll `queue_jobs` using `SELECT ... FOR UPDATE SKIP LOCKED`, set a visibility timeout, and process.
- During long-running steps, worker extends visibility to avoid re-delivery.
- On success, outputs are marked `uploaded` and job set to `completed`; on error, `failed`.

### REST API
- `GET /health` — health check
- `POST /jobs` — create a job
  - Request body:
  ```json
  {
    "source": { 
      "kind": "s3", 
      "access_key_id": "AKIAIOSFODNN7EXAMPLE",
      "access_key_secret": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      "region": "us-east-1",
      "bucket": "my-bucket", 
      "path": "uploads/input/video.mp4"
    },
    "outputs": [
      {
        "container": "mp4",
        "videoCodec": "libx264",
        "videoBitrate": "2500k",
        "audioCodec": "aac",
        "audioBitrate": "128k",
        "width": 1280,
        "height": 720,
        "destination": { 
          "kind": "s3", 
          "access_key_id": "AKIAIOSFODNN7EXAMPLE",
          "access_key_secret": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          "region": "us-east-1", 
          "bucket": "my-bucket", 
          "path": "processed/output/video_720p.mp4", 
          "acl": "public-read"
        }
      }
    ],
    "notificationUrl": "https://example.com/webhook"
  }
  ```
  
  **Supported source types:**
  - `http`/`https`: Direct URL download
  - `s3`: S3 object download (supports request-provided credentials)
  - `ftp`: FTP download
  - `inline`: Base64 encoded content
  
  **Supported destination types:**
  - `s3`: Upload to S3 (supports ACL, region, request-provided credentials)
  - `http`: HTTP POST/PUT upload
  - `ftp`: FTP upload
  
  **S3 Configuration:**
  - `path`: Full path within the S3 bucket (e.g., `"processed/videos/720p/video.mp4"`)
  - `access_key_id`/`access_key_secret`: Optional AWS credentials in request payload
  - If credentials not provided in request, falls back to environment variables or IAM roles
  - Response: `202 { id, uuid, status }`
- `GET /jobs` — list latest jobs
- `GET /jobs/:id` — get job with outputs
- `DELETE /jobs/:id` — delete job (cascades outputs and queue rows)
- `GET /workers` — list active worker processes (unified app only)

### Web UI
- Static dashboard served from `/` that polls `/jobs` and displays latest 200 jobs.
- Extend to add filters, pagination, and job detail view as needed.

### Storage Connectors
The application supports multiple storage connectors:

**✅ Implemented:**
- **AWS S3**: Full support for download and upload using AWS SDK v3
  - Automatic content-type detection
  - ACL support for uploads
  - Region configuration
  - Comprehensive error handling and logging
- **HTTP/HTTPS**: Direct URL download and upload
- **Inline**: Base64 encoded content support

**⚠️ Basic Support:**
- **FTP**: Basic FTP support via axios (for simple FTP servers)

**🔧 Extensions:**
For production-grade FTP support, consider adding a dedicated FTP client like `basic-ftp`.

### Docker
Build image:
```
docker build -t your-registry/encoder:v0.1.0 .
```
Run Unified Application:
```
docker run --env-file .env -p 8080:8080 your-registry/encoder:v0.1.0
```

Run Legacy API:
```
docker run --env-file .env -p 8080:8080 your-registry/encoder:v0.1.0 node dist/server.js
```

Run Legacy Worker:
```
docker run --env-file .env your-registry/encoder:v0.1.0 node dist/worker.js
```

### Kubernetes
Manifests under `k8s/`:
- `encoder-app.yaml`: Unified Deployment (2 replicas) + Service (Recommended)
- `encoder-api.yaml`: Legacy API Deployment (2 replicas) + Service
- `encoder-worker.yaml`: Legacy Worker Deployment (2 replicas). Scale workers for throughput.
- `encoder-retention.yaml`: CronJob that deletes completed jobs older than `RETENTION_HOURS`.

Create a Secret with environment variables:
```
kubectl create secret generic encoder-env \
  --from-literal=NODE_ENV=production \
  --from-literal=PORT=8080 \
  --from-literal=MYSQL_HOST=<host> \
  --from-literal=MYSQL_PORT=3306 \
  --from-literal=MYSQL_USER=<user> \
  --from-literal=MYSQL_PASSWORD=<password> \
  --from-literal=MYSQL_DATABASE=<db> \
  --from-literal=QUEUE_POLL_INTERVAL_MS=1000 \
  --from-literal=QUEUE_VISIBILITY_TIMEOUT_MS=600000 \
  --from-literal=QUEUE_MAX_ATTEMPTS=3 \
  --from-literal=RETENTION_HOURS=168 \
  --from-literal=AWS_REGION=us-east-1 \
  --from-literal=AWS_ACCESS_KEY_ID=your_access_key \
  --from-literal=AWS_SECRET_ACCESS_KEY=your_secret_key
```

Apply manifests:

**Unified Application (Recommended):**
```
kubectl apply -f k8s/encoder-app.yaml
kubectl apply -f k8s/encoder-retention.yaml
```

**Legacy Separate API and Worker:**
```
kubectl apply -f k8s/encoder-api.yaml
kubectl apply -f k8s/encoder-worker.yaml
kubectl apply -f k8s/encoder-retention.yaml
```

### Notes on Scalability and Safety
- Scale workers horizontally; MySQL row-level locks prevent double-processing.
- Tune `visibility timeout` to exceed longest expected step; worker periodically extends it.
- Consider isolating queue in a dedicated table, adding dead-letter handling on `attempts >= max_attempts`.
- For large assets, prefer presigned URLs for both download and upload.

### License
MIT


