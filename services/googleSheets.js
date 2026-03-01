const { google } = require('googleapis');
require('dotenv').config();

class GoogleSheetsService {
  constructor() {
    this.auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
  }

  async readSheet(sheetName, range = 'A:Z') {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${range}`,
      });
      return response.data.values || [];
    } catch (error) {
      console.error(`Error reading ${sheetName}:`, error.message);
      throw new Error(`Failed to read ${sheetName}`);
    }
  }

  async appendRows(sheetName, rows) {
    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: rows,
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Error appending to ${sheetName}:`, error.message);
      throw new Error(`Failed to append to ${sheetName}`);
    }
  }

  async updateRow(sheetName, rowIndex, values) {
    try {
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Error updating row ${rowIndex}:`, error.message);
      throw new Error(`Failed to update row ${rowIndex}`);
    }
  }

  async getTaskById(taskId) {
    const rows = await this.readSheet('Build Queue');
    const taskRow = rows.find(row => row[0] === String(taskId));
    if (!taskRow) return null;

    return {
      id: taskRow[0],
      task: taskRow[1],
      priority: taskRow[2],
      client: taskRow[3],
      system: taskRow[4],
      status: taskRow[5],
      assignedTo: taskRow[6],
      dateAdded: taskRow[7],
      dateCompleted: taskRow[8],
      notes: taskRow[9],
      timestamp: taskRow[10],
      createdBy: taskRow[11],
    };
  }
}

module.exports = GoogleSheetsService;
