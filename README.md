# BryanOS Build Queue System

AI-powered task management system that processes meeting transcripts, auto-creates tasks in Google Sheets, suggests assignees, and sends Telegram notifications.

## Features

- 🤖 **Dual AI Processing** - Claude API with OpenAI fallback
- 📊 **Google Sheets Integration** - All data stored in Google Sheets
- 🎯 **Smart Assignment** - Config-driven assignment rules
- 📱 **Telegram Notifications** - Real-time updates via n8n
- 🔄 **Multi-Client Support** - Works for Kyle, Prince, Juan, and future clients
- ⚙️ **Dynamic Configuration** - Update rules in Google Sheets without code changes

## Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** Plain HTML/CSS/JavaScript
- **Database:** Google Sheets API
- **AI:** Claude API (Anthropic), OpenAI API
- **Notifications:** n8n Webhook → Telegram Bot
- **Deployment:** Any Node.js hosting (Heroku, Railway, DigitalOcean, etc.)

## Quick Start

### Prerequisites

1. **Node.js** (v18+)
2. **Google Cloud project** with Sheets API enabled
3. **API Keys:**
   - Claude API key
   - OpenAI API key
   - Telegram Bot token
4. **n8n workflow** (optional for notifications)

### Installation

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your credentials

# Start server
npm start
```

Server runs on: http://localhost:3000

Open dashboard: http://localhost:3000/build-queue.html

### Setup Google Sheets

Follow the complete guide: [docs/GOOGLE_SHEETS_SETUP.md](docs/GOOGLE_SHEETS_SETUP.md)

**Quick summary:**
1. Create Google Sheet with 5 tabs: Build Queue, Team Members, Clients, Assignment Rules, Systems
2. Share sheet with service account
3. Add GOOGLE_SHEET_ID to .env

## Usage

### 1. Process Meeting Transcript

1. Select client from dropdown
2. Paste raw meeting transcript
3. Click "Process with AI"
4. Review extracted tasks
5. Click "Confirm & Create Tasks"

### 2. Manage Tasks

- **Filter** by client, status, assignee, or priority
- **Update** task status (Not Started → In Progress → Done)
- **Reassign** tasks to different team members
- **Add notes** to tasks

### 3. Configure Assignment Rules

Edit the "Assignment Rules" tab in Google Sheets:

| Rule Type | Condition | Assignee | Priority |
|-----------|-----------|----------|----------|
| Client    | Kyle      | Lee      | 1        |
| System    | GHL       | Adam     | 2        |
| Time      | Prince + after 9pm | JOHN | 1 |
| Default   | New Client | Jameel  | 3        |

Rules are cached for 5 minutes.

## API Endpoints

### POST /api/process-transcript
Process meeting transcript with AI

**Request:**
```json
{
  "transcript": "Kyle mentioned...",
  "client": "Kyle"
}
```

**Response:**
```json
{
  "success": true,
  "formatted": "📄 Bryan Task Document...",
  "tasks": [...]
}
```

### POST /api/tasks/create
Create tasks in Google Sheets

### GET /api/tasks
Get all tasks with optional filters

### PATCH /api/tasks/:taskId
Update task status/assignee

### GET /api/config/team-members
Get active team members

### GET /api/config/clients
Get active clients

## Testing

See [TEST_CHECKLIST.md](TEST_CHECKLIST.md) for complete testing guide.

**Quick test:**
```bash
# Start server
npm start

# Open browser
http://localhost:3000/build-queue.html

# Check that client dropdown populates
```

## Deployment

### Environment Variables for Production

Set these in your hosting provider:

```bash
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=your_key
CLAUDE_API_KEY=your_key
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
N8N_WEBHOOK_URL=https://your-n8n.app/webhook/bryanOS
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
```

### Deploy to Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create bryanos-build-queue

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set CLAUDE_API_KEY=your_key
# ... (set all other vars)

# Deploy
git push heroku build-queue-implementation:main

# Open app
heroku open
```

### Deploy to Railway

1. Connect GitHub repo
2. Add environment variables in Railway dashboard
3. Deploy automatically on push

## Project Structure

```
├── services/
│   ├── googleSheets.js      # Google Sheets API integration
│   ├── aiAgent.js            # Claude/OpenAI dual AI processing
│   ├── assignmentRules.js    # Dynamic assignment logic
│   └── notifications.js      # n8n webhook notifications
├── public/
│   ├── build-queue.html      # Main dashboard
│   ├── css/
│   │   └── build-queue.css   # Styles
│   └── js/
│       └── build-queue.js    # Frontend logic
├── docs/
│   └── GOOGLE_SHEETS_SETUP.md
├── server.js                 # Express API server
├── .env                      # Environment variables (not in git)
├── package.json
└── README.md
```

## Troubleshooting

### "Failed to read Build Queue"
- Check that Google Sheet is shared with service account
- Verify GOOGLE_SHEET_ID is correct

### "Invalid credentials"
- Check GOOGLE_PRIVATE_KEY formatting (must include `\n`)
- Ensure private key is wrapped in quotes

### Client dropdown empty
- Add clients to "Clients" tab in Google Sheet
- Set "Active" column to "Yes"

### AI processing fails
- Check API keys are valid
- Verify network connectivity
- Check server console for detailed error

## Support

For issues or questions:
- Check [TEST_CHECKLIST.md](TEST_CHECKLIST.md)
- Check [docs/GOOGLE_SHEETS_SETUP.md](docs/GOOGLE_SHEETS_SETUP.md)
- Review server console logs

## License

ISC
