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

  async deleteRow(sheetName, rowIndex) {
    try {
      // Get sheet metadata to find the sheet ID
      const sheetsMetadata = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheet = sheetsMetadata.data.sheets.find(
        s => s.properties.title === sheetName
      );

      if (!sheet) {
        throw new Error(`Sheet ${sheetName} not found`);
      }

      const sheetId = sheet.properties.sheetId;

      // Delete the row using batchUpdate
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1, // 0-indexed
                  endIndex: rowIndex, // exclusive
                },
              },
            },
          ],
        },
      });

      return { success: true };
    } catch (error) {
      console.error(`Error deleting row ${rowIndex}:`, error.message);
      throw new Error(`Failed to delete row ${rowIndex}`);
    }
  }

  async findRowByTaskId(taskId) {
    const rows = await this.readSheet('Build Queue');
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === String(taskId)) {
        return { rowIndex: i + 1, data: rows[i] };
      }
    }
    return null;
  }

  async getTaskById(taskId) {
    const result = await this.findRowByTaskId(taskId);
    if (!result) return null;

    const row = result.data;
    return {
      id: row[0],
      task: row[1],
      priority: row[2],
      client: row[3],
      system: row[4],
      status: row[5],
      assignedTo: row[6],
      dateAdded: row[7],
      dateCompleted: row[8],
      notes: row[9],
      timestamp: row[10],
      createdBy: row[11],
      _rowIndex: result.rowIndex,
    };
  }
}

module.exports = GoogleSheetsService;
