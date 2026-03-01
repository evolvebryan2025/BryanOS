const { google } = require('googleapis');
require('dotenv').config();

async function setupGoogleSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  console.log('Setting up Google Sheets...');

  // Get existing sheets
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);

  // Create missing sheets
  const requiredSheets = ['Build Queue', 'Team Members', 'Clients', 'Assignment Rules', 'Systems'];
  const sheetsToCreate = requiredSheets.filter(name => !existingSheets.includes(name));

  if (sheetsToCreate.length > 0) {
    console.log('Creating sheets:', sheetsToCreate.join(', '));
    const requests = sheetsToCreate.map(title => ({
      addSheet: { properties: { title } }
    }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
  }

  // Add headers and sample data
  const updates = [
    {
      range: 'Build Queue!A1:L1',
      values: [['Task ID', 'Task', 'Priority', 'Client', 'System', 'Status', 'Assigned To', 'Date Added', 'Date Completed', 'Notes', 'Timestamp', 'Created By']]
    },
    {
      range: 'Team Members!A1:F6',
      values: [
        ['Name', 'Role', 'Specialties', 'Client Assignments', 'Active', 'Schedule'],
        ['Vee', 'Builder', 'GHL, n8n, Web Apps', 'Prince', 'Yes', '1pm-9pm'],
        ['Lee', 'Builder + QA', 'All', 'Kyle', 'Yes', '8am-4pm'],
        ['JOHN', 'Night Builder', 'GHL, n8n', 'Prince (night)', 'Yes', '8pm-2am'],
        ['Adam', 'GHL Specialist', 'GHL', 'Juan', 'Yes', '8pm+'],
        ['Jameel', 'On-Demand', 'Web Apps, n8n', 'New Clients', 'Yes', 'Flexible']
      ]
    },
    {
      range: 'Clients!A1:E4',
      values: [
        ['Client Name', 'Primary Assignee', 'Backup Assignee', 'Active', 'Priority Level'],
        ['Prince', 'Vee', 'JOHN', 'Yes', 'High'],
        ['Kyle', 'Lee', '', 'Yes', 'High'],
        ['Juan', 'Adam', '', 'Yes', 'Medium']
      ]
    },
    {
      range: 'Assignment Rules!A1:D9',
      values: [
        ['Rule Type', 'Condition', 'Assignee', 'Priority'],
        ['Client', 'Prince', 'Vee', '1'],
        ['Client', 'Kyle', 'Lee', '1'],
        ['Client', 'Juan', 'Adam', '1'],
        ['System', 'GHL', 'Adam', '2'],
        ['System', 'n8n', 'Vee', '2'],
        ['System', 'Web App', 'Jameel', '2'],
        ['Time', 'Prince + after 9pm', 'JOHN', '1'],
        ['Default', 'New Client', 'Jameel', '3']
      ]
    },
    {
      range: 'Systems!A1:C6',
      values: [
        ['System Name', 'Default Assignee', 'Active'],
        ['GHL', 'Adam', 'Yes'],
        ['n8n', 'Vee', 'Yes'],
        ['Web App', 'Jameel', 'Yes'],
        ['Voice Agent', 'Lee', 'Yes'],
        ['Cold Email', 'Lee', 'Yes']
      ]
    }
  ];

  console.log('Adding headers and sample data...');
  for (const update of updates) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: update.range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: update.values }
    });
    console.log(`✓ Updated ${update.range.split('!')[0]}`);
  }

  console.log('\n✅ Google Sheets setup complete!');
  console.log('Your sheet is ready at:');
  console.log(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
}

setupGoogleSheets().catch(console.error);
