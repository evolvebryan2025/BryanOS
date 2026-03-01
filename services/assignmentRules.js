const GoogleSheetsService = require('./googleSheets');

class AssignmentRulesService {
  constructor() {
    this.sheets = new GoogleSheetsService();
    this.rulesCache = null;
    this.cacheTime = null;
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  async loadRules() {
    const now = Date.now();

    // Use cache if fresh
    if (this.rulesCache && this.cacheTime && (now - this.cacheTime) < this.cacheDuration) {
      return this.rulesCache;
    }

    // Load from sheets
    const rulesData = await this.sheets.readSheet('Assignment Rules');
    const teamData = await this.sheets.readSheet('Team Members');
    const clientData = await this.sheets.readSheet('Clients');

    // Skip header rows
    const rules = rulesData.slice(1).map(row => ({
      type: row[0],
      condition: row[1],
      assignee: row[2],
      priority: parseInt(row[3]) || 999,
    }));

    const teamMembers = teamData.slice(1).map(row => ({
      name: row[0],
      role: row[1],
      specialties: row[2] || '',
      clients: row[3] || '',
      active: row[4] === 'Yes',
      schedule: row[5] || '',
    }));

    const clients = clientData.slice(1).map(row => ({
      name: row[0],
      primaryAssignee: row[1],
      backupAssignee: row[2] || null,
      active: row[3] === 'Yes',
    }));

    this.rulesCache = { rules, teamMembers, clients };
    this.cacheTime = now;

    return this.rulesCache;
  }

  async suggestAssignee(task) {
    const config = await this.loadRules();
    const hour = new Date().getHours();

    // Sort rules by priority
    const sortedRules = config.rules.sort((a, b) => a.priority - b.priority);

    // Priority 1: Client-based rules
    const clientRule = sortedRules.find(r =>
      r.type === 'Client' && r.condition === task.client
    );
    if (clientRule) {
      // Check time-based override for Prince
      if (task.client === 'Prince' && hour >= 21) {
        const nightRule = sortedRules.find(r =>
          r.type === 'Time' && r.condition.includes('Prince')
        );
        if (nightRule) return nightRule.assignee;
      }
      return clientRule.assignee;
    }

    // Priority 2: System-based rules
    const systemRule = sortedRules.find(r =>
      r.type === 'System' && r.condition === task.system
    );
    if (systemRule) return systemRule.assignee;

    // Priority 3: Default fallback
    const defaultRule = sortedRules.find(r => r.type === 'Default');
    return defaultRule ? defaultRule.assignee : 'Lee';
  }

  async getTeamMembers() {
    const config = await this.loadRules();
    return config.teamMembers.filter(m => m.active);
  }

  async getClients() {
    const config = await this.loadRules();
    return config.clients.filter(c => c.active);
  }
}

module.exports = AssignmentRulesService;
