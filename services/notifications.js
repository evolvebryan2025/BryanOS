const axios = require('axios');
require('dotenv').config();

class NotificationService {
  constructor() {
    this.webhookUrl = process.env.N8N_WEBHOOK_URL;
  }

  async sendTaskNotification(event, task, updatedBy = null) {
    if (!this.webhookUrl) {
      console.log(`Notification skipped (${event}): No webhook URL configured`);
      return { success: false, error: 'No webhook URL configured' };
    }

    try {
      const payload = {
        event,
        task: {
          title: task.task || task.title,
          assignee: task.assignedTo || task.assignee,
          priority: task.priority,
          client: task.client,
          system: task.system,
          status: task.status,
          notes: task.notes,
          completedDate: task.dateCompleted,
        },
        updatedBy,
      };

      const response = await axios.post(this.webhookUrl, payload, {
        timeout: 30000, // 30 second timeout
      });

      console.log(`Notification sent (${event}):`, response.data);
      return response.data;
    } catch (error) {
      console.error('Notification failed:', error.message);
      // Don't throw - notifications are not critical
      return { success: false, error: error.message };
    }
  }

  async notifyTaskCreated(task) {
    return this.sendTaskNotification('task_created', task);
  }

  async notifyTaskUpdated(task, updatedBy) {
    return this.sendTaskNotification('task_updated', task, updatedBy);
  }

  async notifyTaskCompleted(task) {
    return this.sendTaskNotification('task_completed', task);
  }

  async notifyTranscriptProcessed(client, taskCount, provider) {
    if (!this.webhookUrl) {
      console.log('Notification skipped (transcript_processed): No webhook URL configured');
      return { success: false, error: 'No webhook URL configured' };
    }

    try {
      const payload = {
        event: 'transcript_processed',
        client,
        taskCount,
        provider,
        timestamp: new Date().toISOString(),
      };

      const response = await axios.post(this.webhookUrl, payload, {
        timeout: 30000,
      });

      console.log('Notification sent (transcript_processed):', response.data);
      return response.data;
    } catch (error) {
      console.error('Notification failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = NotificationService;
