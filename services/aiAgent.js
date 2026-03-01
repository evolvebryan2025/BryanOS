const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
require('dotenv').config();

class AIAgent {
  constructor() {
    this.claude = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  buildPrompt(transcript, client) {
    return `You are Bryan's meeting task extractor. Analyze this meeting transcript and generate a formatted task document.

CLIENT: ${client}
TRANSCRIPT:
${transcript}

OUTPUT FORMAT (follow this EXACTLY):
📄 Bryan Task Document
Bryan x ${client} – ${new Date().toLocaleDateString()}

🚨 PRIORITY #1 — [CATEGORY NAME]
1️⃣ [Task Title] ([ASSIGNEE])
⏱ [timestamp if available]
🗣 Word-for-Word:
[relevant quotes if available]

📌 What You Must Deliver:
- [checklist item 1]
- [checklist item 2]

🔴 Priority Level: [Critical/High/Medium/Low]

[Repeat for all tasks, grouped by priority]

🔴 FINAL PRIORITY ORDER
DO FIRST (URGENT / CRITICAL)
- [task]
DO NEXT (HIGH PRIORITY)
- [task]
DO LATER (MEDIUM/LOW)
- [task]

ASSIGNMENT RULES:
- Prince tasks → Vee (or JOHN if after 9pm)
- Kyle tasks → Lee
- Juan tasks → Adam
- GHL tasks → Adam
- n8n tasks → Vee
- Web App tasks → Jameel
- New client builds → Jameel
- Internal tools → Lee

Extract all action items from the transcript, assign based on rules above, include timestamps and quotes where available in the transcript. Be thorough.`;
  }

  async processWithClaude(transcript, client) {
    const message = await this.claude.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: this.buildPrompt(transcript, client),
      }],
    });

    return message.content[0].text;
  }

  async processWithOpenAI(transcript, client) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: this.buildPrompt(transcript, client),
      }],
    });

    return completion.choices[0].message.content;
  }

  async processTranscript(transcript, client) {
    try {
      console.log('Trying Claude API...');
      const result = await this.processWithClaude(transcript, client);
      console.log('Claude API succeeded');
      return { formatted: result, provider: 'claude' };
    } catch (claudeError) {
      console.log('Claude API failed, falling back to OpenAI:', claudeError.message);

      try {
        const result = await this.processWithOpenAI(transcript, client);
        console.log('OpenAI API succeeded');
        return { formatted: result, provider: 'openai' };
      } catch (openaiError) {
        console.error('Both AI providers failed:', openaiError.message);
        throw new Error('AI processing failed: Both Claude and OpenAI APIs are unavailable');
      }
    }
  }

  parseTaskDocument(formatted) {
    const tasks = [];

    // Extract tasks using regex
    const taskRegex = /(\d️⃣)\s+(.+?)\s+\(([A-Za-z]+)\)/g;
    let match;

    while ((match = taskRegex.exec(formatted)) !== null) {
      const taskTitle = match[2].trim();
      const assignee = match[3].trim();

      // Find priority for this task
      const taskIndex = match.index;
      const beforeTask = formatted.substring(0, taskIndex);
      const lastPriorityMarker = beforeTask.lastIndexOf('Priority Level:');

      let priority = 'Medium';
      if (lastPriorityMarker !== -1) {
        const priorityLine = formatted.substring(lastPriorityMarker, lastPriorityMarker + 50);
        if (priorityLine.includes('Critical')) priority = 'Critical';
        else if (priorityLine.includes('High')) priority = 'High';
        else if (priorityLine.includes('Low')) priority = 'Low';
      }

      // Try to extract timestamp
      const timestampRegex = /⏱\s+([^\n]+)/;
      const timestampMatch = formatted.substring(match.index, match.index + 200).match(timestampRegex);
      const timestamp = timestampMatch ? timestampMatch[1].trim() : '';

      // Try to extract notes (What You Must Deliver section)
      const deliverStart = formatted.indexOf('📌 What You Must Deliver:', match.index);
      const deliverEnd = formatted.indexOf('🔴 Priority Level:', deliverStart);
      let notes = '';

      if (deliverStart !== -1 && deliverEnd !== -1) {
        notes = formatted.substring(deliverStart, deliverEnd).trim();
      }

      // Infer system type from task title
      let system = 'Other';
      if (taskTitle.toLowerCase().includes('ghl')) system = 'GHL';
      else if (taskTitle.toLowerCase().includes('n8n')) system = 'n8n';
      else if (taskTitle.toLowerCase().includes('web') || taskTitle.toLowerCase().includes('app')) system = 'Web App';
      else if (taskTitle.toLowerCase().includes('voice')) system = 'Voice Agent';
      else if (taskTitle.toLowerCase().includes('email')) system = 'Cold Email';

      tasks.push({
        title: taskTitle,
        assignee,
        priority,
        system,
        timestamp,
        notes,
      });
    }

    return tasks;
  }
}

module.exports = AIAgent;
