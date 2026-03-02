const { supabaseAdmin, createUserClient } = require('../services/supabase');

// Auth middleware — validates JWT, attaches user + workspace client to req
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Verify the JWT with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user info and scoped client to request
    req.user = user;
    req.supabase = createUserClient(token);

    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// Workspace middleware — validates workspace access, attaches workspace to req
// Must be used AFTER requireAuth
function requireWorkspace(req, res, next) {
  const workspaceId = req.headers['x-workspace-id'] || req.query.workspace_id;

  if (!workspaceId) {
    return res.status(400).json({ error: 'Missing workspace ID (x-workspace-id header)' });
  }

  req.workspaceId = workspaceId;
  // RLS will enforce actual access — if user isn't a member, queries return empty
  next();
}

// Role check middleware factory
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user || !req.workspaceId) {
      return res.status(403).json({ error: 'Missing auth or workspace context' });
    }

    try {
      const { data: member, error } = await req.supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', req.workspaceId)
        .eq('user_id', req.user.id)
        .single();

      if (error || !member) {
        return res.status(403).json({ error: 'Not a member of this workspace' });
      }

      if (!allowedRoles.includes(member.role)) {
        return res.status(403).json({
          error: `Requires role: ${allowedRoles.join(' or ')}. You have: ${member.role}`,
        });
      }

      req.userRole = member.role;
      next();
    } catch (err) {
      console.error('Role check error:', err.message);
      return res.status(500).json({ error: 'Failed to verify permissions' });
    }
  };
}

module.exports = { requireAuth, requireWorkspace, requireRole };
