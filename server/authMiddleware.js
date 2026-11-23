// ====================================================================
// TRACECDR SERVER-AUTHORITATIVE AUTHENTICATION MIDDLEWARE
// Validates Supabase JWT tokens against the auth server and verifies roles from database
// ====================================================================

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Standard client for token verification
const supabasePublic = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Admin client for privileged backend queries (only if service key is configured)
const supabaseAdmin = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

function userClient(token) {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

/**
 * Middleware: Verifies Bearer JWT token and extracts authenticated identity & role.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED: Missing or malformed Bearer authorization token.',
      code: 'AUTH_REQUIRED'
    });
  }
  if (!supabasePublic) return res.status(503).json({ error: 'Supabase is not configured on the server.' });

  try {
    // Validate token against Supabase Auth
    const { data: { user }, error: authError } = await supabasePublic.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED: Invalid or expired authentication token.',
        details: authError ? authError.message : 'User not found'
      });
    }

    // Server-authoritative role check from public.profiles table
    let role = 'viewer';
    let username = user.email ? user.email.split('@')[0] : 'user';

    const clientToQuery = userClient(token);
    const { data: profile, error: profileError } = await clientToQuery
      .from('profiles')
      .select('role, username, is_active')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) return res.status(503).json({ error: 'Could not verify user profile: ' + profileError.message });

    if (profile) {
      if (profile.is_active === false) {
        return res.status(403).json({
          error: 'FORBIDDEN: User account has been deactivated by the administrator.'
        });
      }
      role = profile.role || 'analyst';
      username = profile.username || username;
    } else {
      // If profile does not exist in DB yet, assign minimum-privilege 'viewer'
      // user_metadata is untrusted client-controllable data and must NEVER elevate role
      role = 'viewer';
    }

    req.user = {
      id: user.id,
      email: user.email,
      username: username,
      role: role
    };
    req.supabase = clientToQuery;

    next();
  } catch (err) {
    return res.status(500).json({
      error: 'INTERNAL_AUTH_ERROR: Could not verify authorization state.',
      message: err.message
    });
  }
}

/**
 * Role-Based Access Control gate.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `FORBIDDEN: Operation requires one of [${allowedRoles.join(', ')}] role. Current role: '${req.user.role}'.`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    next();
  };
}

module.exports = {
  supabasePublic,
  supabaseAdmin,
  userClient,
  authenticateToken,
  requireRole
};
