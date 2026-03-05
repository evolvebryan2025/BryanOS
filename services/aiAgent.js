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
1️⃣ [Task Title]
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

CRITICAL INSTRUCTIONS:
1. Extract EVERY action item, bug, feature request, or task mentioned - even implied ones
2. Break down complex tasks into multiple separate tasks if needed
3. Include follow-up tasks, investigations, and validations as separate items
4. Don't combine multiple tasks into one - create separate entries
5. Look for implicit tasks (e.g., "this needs to be fixed" = create a fix task + test task)
6. Include timestamps and quotes where available
7. DO NOT suggest assignees - the system will auto-assign based on rules

Be EXTREMELY thorough - err on the side of creating MORE tasks rather than fewer.`;
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

  buildReferralPrompt(contacts, pitch, offer, senderName) {
    const contactList = contacts.map((c, i) =>
      `${i + 1}. Name: ${c.name}, Relationship: ${c.relationship}, Platform: ${c.platform}`
    ).join('\n');

    return `You are a referral message writer for ${senderName}. Generate personalized referral request messages for each contact below.

SERVICE/PRODUCT: ${pitch}
${offer ? `SPECIAL OFFER FOR REFERRALS: ${offer}` : ''}
SENDER: ${senderName}

CONTACTS:
${contactList}

RULES:
1. Each message must be UNIQUE — no two should feel the same
2. Keep each message under 150 words
3. Match the tone to the platform:
   - WhatsApp/SMS: Casual, friendly, use short sentences
   - Email: Professional but warm, include a subject line on the first line as "Subject: ..."
   - LinkedIn: Networking tone, reference professional value
   - Instagram DM: Brief, personable, emoji-friendly
4. Reference the relationship naturally (e.g., "Since we worked together on..." or "As someone who knows the space...")
5. Include a clear, specific ask: "If you know anyone who could use [service], I'd appreciate an intro"
6. NEVER sound robotic, salesy, or template-like — each should feel genuinely written
7. End with something warm and personal
8. If there's a special offer, mention it naturally (not as a sales pitch)

OUTPUT FORMAT (follow EXACTLY — use this JSON array format):
[
  {
    "name": "Contact Name",
    "platform": "WhatsApp",
    "message": "The full message text here..."
  },
  ...
]

Return ONLY the JSON array, no other text.`;
  }

  async generateReferralMessages(contacts, pitch, offer, senderName) {
    const prompt = this.buildReferralPrompt(contacts, pitch, offer, senderName);

    try {
      console.log('Generating referral messages with Claude...');
      const message = await this.claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = message.content[0].text;
      const messages = JSON.parse(text);
      return { messages, provider: 'claude' };
    } catch (claudeError) {
      console.log('Claude failed for referrals, trying OpenAI:', claudeError.message);

      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4-turbo',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = completion.choices[0].message.content;
        const messages = JSON.parse(text);
        return { messages, provider: 'openai' };
      } catch (openaiError) {
        console.error('Both AI providers failed for referrals:', openaiError.message);
        throw new Error('AI processing failed: Both Claude and OpenAI APIs are unavailable');
      }
    }
  }

  buildDelegationPrompt(tasksByAssignee, clientName, senderName = 'Bryan') {
    const assigneeBlocks = tasksByAssignee.map((group, i) => {
      const taskList = group.tasks.map((t, j) => {
        let taskStr = `  ${j + 1}. "${t.title}" [Priority: ${t.priority}]`;
        if (t.system) taskStr += ` [System: ${t.system}]`;
        if (t.timestamp) taskStr += ` [Timestamp: ${t.timestamp}]`;
        if (t.notes) taskStr += `\n     Deliverables: ${t.notes}`;
        return taskStr;
      }).join('\n');

      return `ASSIGNEE ${i + 1}: ${group.assigneeName}\nTasks:\n${taskList}`;
    }).join('\n\n');

    return `You are a delegation message writer for ${senderName}. Generate clear, actionable delegation messages for each team member below. These messages will be copy-pasted and sent directly via WhatsApp, Slack, or email.

CLIENT CONTEXT: ${clientName}
DATE: ${new Date().toLocaleDateString()}

${assigneeBlocks}

RULES:
1. Write ONE message per assignee that covers ALL their assigned tasks
2. Start with a brief, friendly greeting using their first name
3. Reference the client name naturally (e.g., "From our ${clientName} meeting...")
4. For each task, include:
   - A clear, specific instruction of what needs to be done
   - The priority level (use urgency language for critical/high, normal for medium/low)
   - Any specific deliverables from the notes
   - The timestamp reference if available
5. Order tasks within the message by priority (critical first, then high, medium, low)
6. End with a clear ask: confirm receipt, flag blockers, give ETA
7. Keep the tone direct but respectful — like a team lead giving clear instructions, not a formal email
8. Use line breaks and numbering for readability — these will be sent on messaging apps
9. Do NOT use markdown formatting (no ** or # or [links]) — use plain text only
10. Each message should be 100-300 words depending on task count
11. If a task has deliverables/notes, incorporate those as specific checklist items

OUTPUT FORMAT (follow EXACTLY — return ONLY this JSON array, no other text):
[
  {
    "assigneeName": "Team Member Name",
    "message": "The full message text here..."
  }
]

Return ONLY the JSON array, no other text.`;
  }

  async generateDelegationMessages(tasksByAssignee, clientName, senderName = 'Bryan') {
    const prompt = this.buildDelegationPrompt(tasksByAssignee, clientName, senderName);

    try {
      console.log('Generating delegation messages with Claude...');
      const message = await this.claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = message.content[0].text;
      const delegations = JSON.parse(text);
      return { delegations, provider: 'claude' };
    } catch (claudeError) {
      console.log('Claude failed for delegation, trying OpenAI:', claudeError.message);

      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4-turbo',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = completion.choices[0].message.content;
        const delegations = JSON.parse(text);
        return { delegations, provider: 'openai' };
      } catch (openaiError) {
        console.error('Both AI providers failed for delegation:', openaiError.message);
        throw new Error('AI processing failed: Both Claude and OpenAI APIs are unavailable');
      }
    }
  }

  parseTaskDocument(formatted) {
    const tasks = [];

    // Extract tasks using regex (removed assignee extraction - let assignment rules handle it)
    const taskRegex = /(\d️⃣)\s+(.+?)(?:\s+\([A-Za-z]+\))?$/gm;
    let match;

    while ((match = taskRegex.exec(formatted)) !== null) {
      const taskTitle = match[2].trim();

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
      else if (taskTitle.toLowerCase().includes('antigravity')) system = 'Antigravity';
      else if (taskTitle.toLowerCase().includes('claude')) system = 'Claude Code';

      tasks.push({
        title: taskTitle,
        // assignee removed - let assignment rules engine handle it
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
