# Voltage API Examples

This directory contains practical examples and demos for integrating with the Voltage API.

## 📁 Contents

### [api-integration.html](api-integration.html)

An interactive, browser-based demo that showcases how to use the Voltage API. This single-page application allows you to:

- ✅ Check service health status
- 🔐 Authenticate with the API
- 🎬 Submit video encoding jobs
- 📋 List and monitor jobs
- 📊 View statistics
- 🌙 Toggle between light/dark themes

## 🚀 Getting Started

### Prerequisites

1. Voltage instance must be running
2. Default endpoint: `http://localhost:8080`
3. (Optional) API password if authentication is enabled

### Running the Demo

#### Option 1: Direct File Open

Simply open `api-integration.html` in your web browser:

```bash
# On macOS
open examples/api-integration.html

# On Linux
xdg-open examples/api-integration.html

# On Windows
start examples/api-integration.html
```

#### Option 2: Local Web Server

For better CORS support, serve the file via HTTP:

```bash
# Using Python 3
cd examples
python -m http.server 3000

# Using Node.js (http-server)
npx http-server examples -p 3000

# Using PHP
php -S localhost:3000 -t examples
```

Then open: `http://localhost:3000/api-integration.html`

## 💡 Usage Guide

### 1. Configure API Endpoint

- Enter your Voltage API endpoint URL (default: `http://localhost:8080`)
- If authentication is enabled, enter your password

### 2. Check Health

Click "Check Health Status" to verify your Voltage instance is running.

### 3. Authenticate (if required)

If your Voltage instance has authentication enabled:

1. Enter your password
2. Click "Authenticate"
3. Store the returned token (done automatically)

### 4. Submit a Job

1. Navigate to "Submit Job" tab
2. Modify the JSON payload as needed
3. Click "Submit Job"
4. Copy the returned `job_key` for tracking

Example job payload:

```json
{
	"input": {
		"type": "HTTP",
		"url": "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4"
	},
	"outputs": [
		{
			"type": "VIDEO",
			"name": "Video 720p",
			"path": "output_720p.mp4",
			"format": "MP4",
			"width": 1280,
			"height": 720
		}
	]
}
```

### 5. Monitor Jobs

- Go to "List Jobs" tab
- Filter by status (PENDING, PROCESSING, COMPLETED, FAILED)
- Set results per page
- Click "Fetch Jobs"

### 6. View Statistics

Navigate to "Statistics" tab and click "Get Statistics" to see usage metrics.

## 🔧 Customization

### Modifying API Calls

The demo uses vanilla JavaScript with the Fetch API. All API functions are in the `<script>` section:

- `checkHealth()` - Health check
- `authenticate()` - Authentication
- `submitJob()` - Job submission
- `listJobs()` - Fetch jobs
- `getStats()` - Get statistics

### Styling

The demo includes a responsive design with light/dark mode support. Modify CSS custom properties in `:root` to change colors:

```css
:root {
	--accent-color: #007bff; /* Primary color */
	--success-color: #28a745; /* Success messages */
	--error-color: #dc3545; /* Error messages */
}
```

## 🛠️ Integration Examples

### JavaScript/Node.js

```javascript
// Submit a job
const response = await fetch("http://localhost:8080/jobs", {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		Authorization: "Bearer YOUR_TOKEN"
	},
	body: JSON.stringify({
		input: {
			type: "HTTP",
			url: "https://example.com/video.mp4"
		},
		outputs: [
			{
				type: "VIDEO",
				format: "MP4",
				width: 1280,
				height: 720
			}
		]
	})
});

const job = await response.json();
console.log("Job created:", job.data.job_key);
```

### Python

```python
import requests

# Submit a job
response = requests.post(
    'http://localhost:8080/jobs',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_TOKEN'
    },
    json={
        'input': {
            'type': 'HTTP',
            'url': 'https://example.com/video.mp4'
        },
        'outputs': [{
            'type': 'VIDEO',
            'format': 'MP4',
            'width': 1280,
            'height': 720
        }]
    }
)

job = response.json()
print(f"Job created: {job['data']['job_key']}")
```

### cURL

```bash
# Health check
curl http://localhost:8080/status

# Authenticate
curl -X POST http://localhost:8080/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"your_password"}'

# Submit job
curl -X POST http://localhost:8080/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "input": {
      "type": "HTTP",
      "url": "https://example.com/video.mp4"
    },
    "outputs": [{
      "type": "VIDEO",
      "format": "MP4",
      "width": 1280,
      "height": 720
    }]
  }'
```

## 📚 Additional Resources

- [Main README](../README.md) - Full Voltage documentation
- [API Documentation](../README.md#-api-endpoints) - Complete API reference
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute
- [GitHub Repository](https://github.com/radaario/voltage) - Source code

## 🐛 Troubleshooting

### CORS Issues

If you encounter CORS errors:

1. Make sure your Voltage instance allows the origin
2. Use a local web server instead of `file://` protocol
3. Check CORS configuration in your Voltage settings

### Authentication Failed

- Verify your password is correct
- Check if authentication is enabled in Voltage config
- Ensure the token is included in subsequent requests

### Connection Refused

- Verify Voltage instance is running: `curl http://localhost:8080/status`
- Check the correct port is configured
- Ensure no firewall is blocking the connection

## 📝 License

This example is part of the Voltage project and is licensed under the [MIT License](../LICENSE).

---

<div align="center">
  <p>Developed with ⚡ by <a href="https://www.radaar.io/">RADAAR</a></p>
</div>
