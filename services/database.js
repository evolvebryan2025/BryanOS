// ============================================================
// BryanOS 1.0 — Database Service (Supabase)
// Replaces Google Sheets as the data layer
// ============================================================

class DatabaseService {
  constructor(supabaseClient, workspaceId) {
    this.db = supabaseClient;
    this.workspaceId = workspaceId;
  }

  // ============================================================
  // TASKS
  // ============================================================

  async getTasks({ status, priority, clientId, assignedTo, search, page = 1, limit = 50 } = {}) {
    let query = this.db
      .from('tasks')
      .select(`
        *,
        client:clients(id, name),
        system:systems(id, name),
        assignee:users!tasks_assigned_to_fkey(id, full_name, avatar_url),
        creator:users!tasks_created_by_fkey(id, full_name)
      `)
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (clientId) query = query.eq('client_id', clientId);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    if (search) query = query.or(`title.ilike.%${search}%,notes.ilike.%${search}%`);

    // Pagination
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
    return { tasks: data || [], count };
  }

  async getTaskById(taskId) {
    const { data, error } = await this.db
      .from('tasks')
      .select(`
        *,
        client:clients(id, name),
        system:systems(id, name),
        assignee:users!tasks_assigned_to_fkey(id, full_name, avatar_url),
        creator:users!tasks_created_by_fkey(id, full_name),
        comments:task_comments(id, content, created_at, user:users(id, full_name, avatar_url))
      `)
      .eq('id', taskId)
      .single();

    if (error) throw new Error(`Task not found: ${error.message}`);
    return data;
  }

  async createTask(task) {
    const { data, error } = await this.db
      .from('tasks')
      .insert({
        workspace_id: this.workspaceId,
        title: task.title,
        description: task.description || null,
        priority: task.priority || 'medium',
        status: 'not_started',
        client_id: task.clientId || null,
        system_id: task.systemId || null,
        assigned_to: task.assignedTo || null,
        created_by: task.createdBy,
        meeting_timestamp: task.meetingTimestamp || null,
        notes: task.notes || null,
        due_date: task.dueDate || null,
        estimated_hours: task.estimatedHours || null,
      })
      .select(`
        *,
        client:clients(id, name),
        system:systems(id, name),
        assignee:users!tasks_assigned_to_fkey(id, full_name)
      `)
      .single();

    if (error) throw new Error(`Failed to create task: ${error.message}`);
    return data;
  }

  async createTasksBatch(tasks, createdBy) {
    const rows = tasks.map(task => ({
      workspace_id: this.workspaceId,
      title: task.title,
      description: task.description || null,
      priority: task.priority || 'medium',
      status: 'not_started',
      client_id: task.clientId || null,
      system_id: task.systemId || null,
      assigned_to: task.assignedTo || null,
      created_by: createdBy,
      meeting_timestamp: task.meetingTimestamp || null,
      notes: task.notes || null,
    }));

    const { data, error } = await this.db
      .from('tasks')
      .insert(rows)
      .select(`
        *,
        client:clients(id, name),
        system:systems(id, name),
        assignee:users!tasks_assigned_to_fkey(id, full_name)
      `);

    if (error) throw new Error(`Failed to create tasks: ${error.message}`);
    return data;
  }

  async updateTask(taskId, updates) {
    const allowedFields = ['title', 'description', 'priority', 'status', 'assigned_to', 'notes', 'due_date', 'estimated_hours', 'sort_order'];
    const filtered = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    }

    const { data, error } = await this.db
      .from('tasks')
      .update(filtered)
      .eq('id', taskId)
      .select(`
        *,
        client:clients(id, name),
        system:systems(id, name),
        assignee:users!tasks_assigned_to_fkey(id, full_name)
      `)
      .single();

    if (error) throw new Error(`Failed to update task: ${error.message}`);
    return data;
  }

  async deleteTask(taskId) {
    const { error } = await this.db
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw new Error(`Failed to delete task: ${error.message}`);
    return { success: true };
  }

  async deleteTasksBatch(taskIds) {
    const { error } = await this.db
      .from('tasks')
      .delete()
      .in('id', taskIds);

    if (error) throw new Error(`Failed to delete tasks: ${error.message}`);
    return { success: true, deleted: taskIds.length };
  }

  // ============================================================
  // CLIENTS
  // ============================================================

  async getClients() {
    const { data, error } = await this.db
      .from('clients')
      .select(`
        *,
        primary_assignee_user:users!clients_primary_assignee_fkey(id, full_name),
        backup_assignee_user:users!clients_backup_assignee_fkey(id, full_name)
      `)
      .eq('workspace_id', this.workspaceId)
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(`Failed to fetch clients: ${error.message}`);
    return data || [];
  }

  async createClient(client) {
    const { data, error } = await this.db
      .from('clients')
      .insert({
        workspace_id: this.workspaceId,
        name: client.name,
        primary_assignee: client.primaryAssignee || null,
        backup_assignee: client.backupAssignee || null,
        priority_level: client.priorityLevel || 'medium',
        notes: client.notes || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create client: ${error.message}`);
    return data;
  }

  // ============================================================
  // TEAM MEMBERS (workspace members)
  // ============================================================

  async getTeamMembers() {
    const { data, error } = await this.db
      .from('workspace_members')
      .select(`
        *,
        user:users(id, full_name, email, avatar_url)
      `)
      .eq('workspace_id', this.workspaceId)
      .eq('is_active', true)
      .order('role');

    if (error) throw new Error(`Failed to fetch team members: ${error.message}`);
    return data || [];
  }

  // ============================================================
  // SYSTEMS
  // ============================================================

  async getSystems() {
    const { data, error } = await this.db
      .from('systems')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(`Failed to fetch systems: ${error.message}`);
    return data || [];
  }

  // ============================================================
  // ASSIGNMENT RULES
  // ============================================================

  async suggestAssignee(clientId, systemId) {
    const { data, error } = await this.db.rpc('suggest_assignee', {
      ws_id: this.workspaceId,
      p_client_id: clientId || null,
      p_system_id: systemId || null,
    });

    if (error) throw new Error(`Assignment suggestion failed: ${error.message}`);
    return data; // UUID of suggested assignee
  }

  // ============================================================
  // TRANSCRIPTS
  // ============================================================

  async saveTranscript(transcript) {
    const { data, error } = await this.db
      .from('transcripts')
      .insert({
        workspace_id: this.workspaceId,
        client_id: transcript.clientId || null,
        raw_transcript: transcript.rawTranscript,
        formatted_output: transcript.formattedOutput || null,
        ai_provider: transcript.aiProvider || null,
        tasks_extracted: transcript.tasksExtracted || 0,
        processed_by: transcript.processedBy,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to save transcript: ${error.message}`);
    return data;
  }

  // ============================================================
  // TASK COMMENTS
  // ============================================================

  async addComment(taskId, userId, content) {
    const { data, error } = await this.db
      .from('task_comments')
      .insert({ task_id: taskId, user_id: userId, content })
      .select(`*, user:users(id, full_name, avatar_url)`)
      .single();

    if (error) throw new Error(`Failed to add comment: ${error.message}`);
    return data;
  }

  // ============================================================
  // ACTIVITY LOG
  // ============================================================

  async getRecentActivity(limit = 50) {
    const { data, error } = await this.db
      .from('activity_log')
      .select(`
        *,
        user:users(id, full_name, avatar_url)
      `)
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch activity: ${error.message}`);
    return data || [];
  }

  // ============================================================
  // STATS & ANALYTICS
  // ============================================================

  async getWorkspaceStats() {
    const { data, error } = await this.db.rpc('get_workspace_stats', {
      ws_id: this.workspaceId,
    });

    if (error) throw new Error(`Failed to fetch stats: ${error.message}`);
    return data;
  }

  async getTeamVelocity(days = 30) {
    const { data, error } = await this.db.rpc('get_team_velocity', {
      ws_id: this.workspaceId,
      days,
    });

    if (error) throw new Error(`Failed to fetch velocity: ${error.message}`);
    return data || [];
  }

  // ============================================================
  // NOTIFICATION CONFIGS
  // ============================================================

  async getNotificationConfigs() {
    const { data, error } = await this.db
      .from('notification_configs')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('is_active', true);

    if (error) throw new Error(`Failed to fetch notification configs: ${error.message}`);
    return data || [];
  }
}

module.exports = DatabaseService;
