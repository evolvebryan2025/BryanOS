# Google Sheets Setup Guide

## Overview

This guide walks you through setting up Google Sheets integration for the Build Queue System. You'll create a Google Sheet with 5 tabs that store tasks, team members, clients, assignment rules, and systems.

---

## Step 1: Create Google Cloud Project

1. Go to: https://console.cloud.google.com
2. Click "Select a project" → "New Project"
3. Name: "Build Queue"
4. Click "Create"

## Step 2: Enable Google Sheets API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click on it → Click "Enable"

## Step 3: Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Name: "build-queue-bot"
4. Service account ID: "build-queue-bot"
5. Click "Create and Continue"
6. Role: "Editor"
7. Click "Continue" → "Done"

## Step 4: Generate Service Account Key

1. On the Credentials page, click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Choose "JSON"
5. Click "Create"
6. Save the downloaded JSON file as `google-credentials.json` in your project folder

## Step 5: Extract Credentials to .env

Open the `google-credentials.json` file and copy:
- `client_email` → GOOGLE_SERVICE_ACCOUNT_EMAIL in .env
- `private_key` → GOOGLE_PRIVATE_KEY in .env (keep the quotes and \\n)

## Step 6: Create Google Sheet

1. Go to: https://sheets.google.com
2. Create a new spreadsheet
3. Name it: "Build Queue System" (or any name you prefer)
4. Copy the Sheet ID from the URL:
   - URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
   - Copy `SHEET_ID_HERE` → GOOGLE_SHEET_ID in .env

---

## Step 7: Create Sheet Tabs

Create 5 tabs in your spreadsheet with the following structure:

### Tab 1: "Build Queue"

**Header row (Row 1):**
```
Task ID | Task | Priority | Client | System | Status | Assigned To | Date Added | Date Completed | Notes | Timestamp | Created By
```

**What it stores:** All tasks created by the system

---

### Tab 2: "Team Members"

**Header row (Row 1):**
```
Name | Role | Specialties | Client Assignments | Active | Schedule
```

**Example data (Row 2+):**
```
Vee | Builder | GHL, n8n, Web Apps | Prince | Yes | 1pm-9pm
Lee | Builder + QA | All | Kyle | Yes | 8am-4pm
JOHN | Night Builder | GHL, n8n | Prince (night) | Yes | 8pm-2am
Adam | GHL Specialist | GHL | Juan | Yes | 8pm+
Jameel | On-Demand | Web Apps, n8n | New Clients | Yes | Flexible
```

**What it stores:** Your team members and their availability

---

### Tab 3: "Clients"

**Header row (Row 1):**
```
Client Name | Primary Assignee | Backup Assignee | Active | Priority Level
```

**Example data (Row 2+):**
```
Prince | Vee | JOHN | Yes | High
Kyle | Lee |  | Yes | High
Juan | Adam |  | Yes | Medium
```

**What it stores:** Your clients and their default assignees

---

### Tab 4: "Assignment Rules"

**Header row (Row 1):**
```
Rule Type | Condition | Assignee | Priority
```

**Example data (Row 2+):**
```
Client | Prince | Vee | 1
Client | Kyle | Lee | 1
Client | Juan | Adam | 1
System | GHL | Adam | 2
System | n8n | Vee | 2
System | Web App | Jameel | 2
System | Voice Agent | Lee | 2
Time | Prince + after 9pm | JOHN | 1
Default | New Client | Jameel | 3
```

**How it works:**
- **Rule Type:** Client, System, Time, or Default
- **Condition:** The condition to match (client name, system type, or time constraint)
- **Assignee:** Who gets assigned when the condition matches
- **Priority:** Lower numbers = higher priority (1 is highest)

**Assignment Logic:**
1. Check Client rules first (priority 1)
2. If no client match, check System rules (priority 2)
3. If no system match, use Default rule (priority 3)
4. Time-based rules override client rules when time matches

---

### Tab 5: "Systems"

**Header row (Row 1):**
```
System Name | Default Assignee | Active
```

**Example data (Row 2+):**
```
GHL | Adam | Yes
n8n | Vee | Yes
Web App | Jameel | Yes
Voice Agent | Lee | Yes
Cold Email | Lee | Yes
```

**What it stores:** Available system types and their default assignees

---

## Step 8: Share Sheet with Service Account

**IMPORTANT:** The service account needs permission to read/write to your sheet.

1. In your Google Sheet, click **"Share"** button (top right)
2. Paste the service account email (from GOOGLE_SERVICE_ACCOUNT_EMAIL in your .env)
   - Example: `build-queue-bot@glowing-hearth-456103-h5.iam.gserviceaccount.com`
3. Set permission to **"Editor"**
4. **Uncheck "Notify people"** (the bot doesn't need email notifications)
5. Click **"Share"**

---

## Step 9: Test Connection

Run the server and test the connection:

```bash
node server.js
```

Open your browser to:
```
http://localhost:3000/build-queue.html
```

If the client dropdown populates with your clients (Prince, Kyle, Juan), the connection is working!

---

## Troubleshooting

### Error: "Failed to read Build Queue"

**Cause:** Service account doesn't have access to the sheet

**Fix:**
1. Check that you shared the sheet with the service account email
2. Verify the GOOGLE_SHEET_ID is correct in .env
3. Make sure permission is set to "Editor" not "Viewer"

### Error: "Invalid credentials"

**Cause:** GOOGLE_PRIVATE_KEY is malformed

**Fix:**
1. Make sure the private key in .env is wrapped in quotes
2. Keep the `\n` characters (they represent newlines)
3. Don't add or remove any line breaks from the key itself

### Clients dropdown is empty

**Cause:** No clients in the "Clients" tab or sheet not shared

**Fix:**
1. Add at least one client to the "Clients" tab
2. Verify "Active" column is set to "Yes"
3. Check that the service account has access

---

## Done!

Your Google Sheets integration is now ready. The Build Queue system will:
- ✅ Read clients and team members from your sheet
- ✅ Create tasks in the "Build Queue" tab
- ✅ Auto-assign based on rules in "Assignment Rules" tab
- ✅ Update task statuses when you change them in the UI

You can update the rules, team members, and clients directly in Google Sheets - the system will pick up changes within 5 minutes (due to caching).
