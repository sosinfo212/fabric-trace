import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { registerTransfertFabricationRoutes } from './transfertFabrication.js';
import { registerComponentChangeRoutes } from './componentChanges.js';
import { registerWasteHorsProdRoutes } from './rebutHorsProd.js';
import { registerUnifiedRebutReportRoutes } from './unifiedRebutReport.js';
import { registerLaboratoireRoutes } from './laboratoire.js';
import { registerPackingRoutes } from './packing.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Increase limit for large CSV imports
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Realtime request logging (timestamp, method, path, status, duration)
app.use((req, res, next) => {
  const start = Date.now();
  const ts = new Date().toISOString();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const statusColor = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    console.log(`${ts} ${req.method} ${req.originalUrl || req.url} ${statusColor}${status}\x1b[0m ${ms}ms`);
  });
  next();
});

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'rootroot',
  database: process.env.DB_DATABASE || 'pcd_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token invalide' });
  }
};

/** Check if the authenticated user has permission for a menu path (admin always has access). */
const hasMenuPermission = async (pool, userId, menuPath) => {
  const [roles] = await pool.execute(
    'SELECT role FROM user_roles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  if (roles.length === 0) return false;
  const role = roles[0].role;
  if (role === 'admin') return true;
  const [perms] = await pool.execute(
    'SELECT 1 FROM role_permissions WHERE role = ? AND menu_path = ? AND can_access = 1',
    [role, menuPath]
  );
  return perms.length > 0;
};

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Check if user exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM profiles WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Create user profile
    await pool.execute(
      'INSERT INTO profiles (id, email, full_name, password_hash) VALUES (?, ?, ?, ?)',
      [userId, email, full_name || null, hashedPassword]
    );

    // Assign default role (operator)
    await pool.execute(
      'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)',
      [uuidv4(), userId, 'operator']
    );

    // Generate JWT
    const token = jwt.sign(
      { id: userId, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: { id: userId, email, full_name },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Get user with password
    const [users] = await pool.execute(
      'SELECT id, email, full_name, password_hash FROM profiles WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const user = users[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      },
      token
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, email, full_name FROM profiles WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Erreur de vérification' });
  }
});

// Fabrication update/delete (registered early so they are always available)
app.put('/api/fab-orders/declaration/fabrication/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      Lot_Jus, Valid_date, effectif_Reel, date_fabrication, End_Fab_date,
      Pf_Qty, Sf_Qty, Set_qty, Tester_qty, Comment_chaine
    } = req.body;
    const updatedBy = req.user?.email || req.user?.id || null;

    const [existing] = await pool.execute(
      'SELECT id FROM fabrication WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }

    const toDT = (v) => (v == null || v === '') ? null : (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) ? toMySQLDateTime(v) : v);
    await pool.execute(
      `UPDATE fabrication SET
        Lot_Jus = ?, Valid_date = ?, effectif_Reel = ?, date_fabrication = ?, End_Fab_date = ?,
        Pf_Qty = ?, Sf_Qty = ?, Set_qty = ?, Tester_qty = ?, Comment_chaine = ?,
        updated_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        Lot_Jus ?? null,
        toDT(Valid_date),
        effectif_Reel ?? null,
        toDT(date_fabrication),
        toDT(End_Fab_date),
        Pf_Qty ?? 0,
        Sf_Qty ?? 0,
        Set_qty ?? 0,
        Tester_qty ?? 0,
        Comment_chaine ?? null,
        updatedBy,
        id
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update fabrication error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la déclaration', details: error.message });
  }
});

app.delete('/api/fab-orders/declaration/fabrication/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute(
      'SELECT id FROM fabrication WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }

    await pool.execute('DELETE FROM fabrication WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete fabrication error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la déclaration', details: error.message });
  }
});

// User Role Routes
app.get('/api/user/role', authenticateToken, async (req, res) => {
  try {
    const [roles] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );

    if (roles.length === 0) {
      return res.json({ role: null });
    }

    res.json({ role: roles[0].role });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du rôle' });
  }
});

// Current user's allowed menu paths (from role_permissions). Sidebar is fully driven by this.
// Returns { menu_paths: string[] }. Empty array if user has no role or role has no allowed paths.
app.get('/api/user/permissions', authenticateToken, async (req, res) => {
  try {
    const [userRoles] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );

    if (userRoles.length === 0) {
      return res.json({ menu_paths: [] });
    }

    const role = userRoles[0].role;

    const [perms] = await pool.execute(
      'SELECT menu_path FROM role_permissions WHERE role = ? AND can_access = 1',
      [role]
    );

    const menu_paths = perms.map((p) => p.menu_path);
    res.json({ menu_paths });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des permissions' });
  }
});

// Profiles Routes (for Chains page)
app.get('/api/profiles', authenticateToken, async (req, res) => {
  try {
    const [profiles] = await pool.execute(
      'SELECT id, email, full_name FROM profiles ORDER BY full_name'
    );
    res.json(profiles);
  } catch (error) {
    console.error('Get profiles error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des profils' });
  }
});

app.get('/api/user-roles', authenticateToken, async (req, res) => {
  try {
    const [roles] = await pool.execute(
      'SELECT user_id, role FROM user_roles'
    );
    res.json(roles);
  } catch (error) {
    console.error('Get user roles error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des rôles' });
  }
});

// Users Routes (admin or role with /admin/users permission)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/users');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const [profiles] = await pool.execute(
      'SELECT id, email, full_name, created_at FROM profiles ORDER BY created_at DESC'
    );

    const [userRoles] = await pool.execute(
      'SELECT user_id, role FROM user_roles'
    );

    const usersWithRoles = profiles.map(profile => {
      const userRole = userRoles.find(r => r.user_id === profile.id);
      return {
        ...profile,
        role: userRole?.role || null
      };
    });

    res.json(usersWithRoles);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/users');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { email, password, full_name, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Check if user exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM profiles WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    await pool.execute(
      'INSERT INTO profiles (id, email, full_name, password_hash) VALUES (?, ?, ?, ?)',
      [userId, email, full_name || null, hashedPassword]
    );

    // Assign role
    await pool.execute(
      'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)',
      [uuidv4(), userId, role || 'operator']
    );

    res.json({ success: true, userId });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' });
  }
});

app.put('/api/users/:id/role', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/users');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { role } = req.body;
    const { id } = req.params;

    // Update or insert role
    const [existing] = await pool.execute(
      'SELECT id FROM user_roles WHERE user_id = ?',
      [id]
    );

    if (existing.length > 0) {
      await pool.execute(
        'UPDATE user_roles SET role = ? WHERE user_id = ?',
        [role, id]
      );
    } else {
      await pool.execute(
        'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)',
        [uuidv4(), id, role]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du rôle' });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/users');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { id } = req.params;
    const { email, full_name, password, role } = req.body;

    const [existing] = await pool.execute(
      'SELECT id, email FROM profiles WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const updates = [];
    const values = [];

    if (email !== undefined) {
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'Email requis' });
      }
      const [duplicate] = await pool.execute(
        'SELECT id FROM profiles WHERE email = ? AND id != ?',
        [email.trim(), id]
      );
      if (duplicate.length > 0) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }
      updates.push('email = ?');
      values.push(email.trim());
    }

    if (full_name !== undefined) {
      updates.push('full_name = ?');
      values.push(full_name === null || full_name === '' ? null : String(full_name).trim());
    }

    if (password !== undefined && password !== null && String(password).trim() !== '') {
      const hashedPassword = await bcrypt.hash(String(password), 10);
      updates.push('password_hash = ?');
      values.push(hashedPassword);
    }

    if (updates.length > 0) {
      values.push(id);
      await pool.execute(
        `UPDATE profiles SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
    }

    if (role !== undefined) {
      const [existingRole] = await pool.execute(
        'SELECT id FROM user_roles WHERE user_id = ?',
        [id]
      );
      if (existingRole.length > 0) {
        await pool.execute(
          'UPDATE user_roles SET role = ? WHERE user_id = ?',
          [role, id]
        );
      } else {
        await pool.execute(
          'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)',
          [uuidv4(), id, role]
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'utilisateur' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/users');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { id } = req.params;

    // Delete role first
    await pool.execute('DELETE FROM user_roles WHERE user_id = ?', [id]);
    // Delete profile
    await pool.execute('DELETE FROM profiles WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur' });
  }
});

// Clients Routes
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const [clients] = await pool.execute(
      'SELECT * FROM clients ORDER BY name'
    );
    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des clients' });
  }
});

app.post('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { name, designation, instruction, instruction_logistique } = req.body;
    const id = uuidv4();

    await pool.execute(
      'INSERT INTO clients (id, name, designation, instruction, instruction_logistique) VALUES (?, ?, ?, ?, ?)',
      [id, name, designation || null, instruction || null, instruction_logistique || null]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du client' });
  }
});

app.put('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, designation, instruction, instruction_logistique } = req.body;

    await pool.execute(
      'UPDATE clients SET name = ?, designation = ?, instruction = ?, instruction_logistique = ?, updated_at = NOW() WHERE id = ?',
      [name, designation || null, instruction || null, instruction_logistique || null, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du client' });
  }
});

app.delete('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM clients WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du client' });
  }
});

// Commandes Routes
app.get('/api/commandes', authenticateToken, async (req, res) => {
  try {
    const [commandes] = await pool.execute(
      `SELECT c.*, cl.name as client_name, cl.id as client_id
       FROM commandes c
       LEFT JOIN clients cl ON c.client_id = cl.id
       ORDER BY c.created_at DESC`
    );
    res.json(commandes);
  } catch (error) {
    console.error('Get commandes error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
});

app.post('/api/commandes', authenticateToken, async (req, res) => {
  try {
    const { num_commande, client_id, date_planifiee, date_debut, date_fin, instruction } = req.body;
    const id = uuidv4();

    await pool.execute(
      'INSERT INTO commandes (id, num_commande, client_id, date_planifiee, date_debut, date_fin, instruction) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, num_commande, client_id, date_planifiee || null, date_debut || null, date_fin || null, instruction || null]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Create commande error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la commande' });
  }
});

app.put('/api/commandes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { num_commande, client_id, date_planifiee, date_debut, date_fin, instruction } = req.body;

    await pool.execute(
      'UPDATE commandes SET num_commande = ?, client_id = ?, date_planifiee = ?, date_debut = ?, date_fin = ?, instruction = ?, updated_at = NOW() WHERE id = ?',
      [num_commande, client_id, date_planifiee || null, date_debut || null, date_fin || null, instruction || null, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update commande error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la commande' });
  }
});

// Rapport Commande – one row per sale order: planned vs declared quantities, overall status
app.get('/api/planning/report', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        fo.sale_order_id,
        MAX(COALESCE(cl.name, fo.client_id)) AS client_name,
        SUM(fo.pf_qty) AS pf_qty,
        SUM(fo.sf_qty) AS sf_qty,
        SUM(fo.set_qty) AS set_qty,
        SUM(fo.tester_qty) AS tester_qty,
        (SELECT COALESCE(SUM(f.Pf_Qty), 0) FROM fabrication f INNER JOIN fab_orders fo2 ON fo2.of_id = f.OFID WHERE fo2.sale_order_id = fo.sale_order_id) AS fabrication_Pf_Qty,
        (SELECT COALESCE(SUM(f.Sf_Qty), 0) FROM fabrication f INNER JOIN fab_orders fo2 ON fo2.of_id = f.OFID WHERE fo2.sale_order_id = fo.sale_order_id) AS fabrication_Sf_Qty,
        (SELECT COALESCE(SUM(f.Set_qty), 0) FROM fabrication f INNER JOIN fab_orders fo2 ON fo2.of_id = f.OFID WHERE fo2.sale_order_id = fo.sale_order_id) AS fabrication_Set_qty,
        (SELECT COALESCE(SUM(f.Tester_qty), 0) FROM fabrication f INNER JOIN fab_orders fo2 ON fo2.of_id = f.OFID WHERE fo2.sale_order_id = fo.sale_order_id) AS fabrication_Tester_qty,
        CASE
          WHEN SUM(CASE WHEN fo.statut_of = 'En cours' THEN 1 ELSE 0 END) > 0 THEN 'En cours'
          WHEN SUM(CASE WHEN fo.statut_of = 'Cloturé' THEN 1 ELSE 0 END) = COUNT(*) THEN 'Cloturé'
          WHEN MIN(fo.statut_of) = MAX(fo.statut_of) THEN MIN(fo.statut_of)
          ELSE 'En cours'
        END AS statut
       FROM fab_orders fo
       LEFT JOIN clients cl ON fo.client_id = cl.id
       GROUP BY fo.sale_order_id
       ORDER BY fo.sale_order_id DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Get planning report error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du rapport commande' });
  }
});

// Sérigraphie planning (ordres de pré-fabrication)
app.get('/api/serigraphie/orders', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, OFID, prod_ref, prod_des, client, commande, date_planifie, qte_plan, qte_reel, statut, instruction, comment, Priority, qty_produced
       FROM serigraphie_planning
       ORDER BY created_at DESC, OFID`
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Serigraphie orders list error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des ordres' });
  }
});

app.get('/api/serigraphie/orders/dropdowns', authenticateToken, async (req, res) => {
  try {
    const [clientsRows] = await pool.execute(
      "SELECT DISTINCT COALESCE(NULLIF(TRIM(designation), ''), name) AS client FROM clients ORDER BY client"
    );
    const [productsRows] = await pool.execute('SELECT ref_id, product_name FROM products ORDER BY product_name');
    const [commandesRows] = await pool.execute('SELECT DISTINCT num_commande FROM commandes ORDER BY num_commande');
    res.json({
      clients: (clientsRows || []).map((r) => r.client),
      products: (productsRows || []).map((r) => ({ ref_id: r.ref_id, product_name: r.product_name })),
      commandes: (commandesRows || []).map((r) => r.num_commande),
    });
  } catch (error) {
    console.error('Serigraphie dropdowns error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des listes' });
  }
});

app.get('/api/serigraphie/orders/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, OFID, prod_ref, prod_des, client, commande, date_planifie, qte_plan, qte_reel, statut, instruction, comment, Priority FROM serigraphie_planning WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ordre introuvable' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Serigraphie order get error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'ordre' });
  }
});

app.post('/api/serigraphie/orders/store', authenticateToken, async (req, res) => {
  try {
    const {
      id,
      OFID,
      prod_ref,
      prod_des,
      client,
      commande,
      qte_plan,
      qte_reel,
      statut,
      date_planifie,
      instruction,
      comment,
      priority,
    } = req.body;

    if (!OFID || typeof OFID !== 'string' || !OFID.trim()) {
      return res.status(422).json({ errors: { OFID: ['La référence OF est requise.'] }, message: 'La référence OF est requise.' });
    }
    if (qte_plan == null || (typeof qte_plan !== 'number' && isNaN(Number(qte_plan))) || Number(qte_plan) < 1) {
      return res.status(422).json({ errors: { qte_plan: ['La quantité planifiée est requise (min. 1).'] }, message: 'La quantité planifiée est requise.' });
    }
    const validStatuts = ['Planifié', 'En cours', 'Réalisé', 'Suspendu', 'Préparé', 'Cloturé'];
    if (!statut || !validStatuts.includes(statut)) {
      return res.status(422).json({ errors: { statut: ['Statut invalide.'] }, message: 'Statut invalide.' });
    }
    if (!date_planifie || !String(date_planifie).trim()) {
      return res.status(422).json({ errors: { date_planifie: ['La date planifiée est requise.'] }, message: 'La date planifiée est requise.' });
    }

    const ofidTrim = OFID.trim();
    const qtePlanNum = Number(qte_plan);
    const qteReelNum = qte_reel != null && qte_reel !== '' ? Number(qte_reel) : 0;
    const priorityNum = priority != null && priority !== '' ? Number(priority) : 0;
    const instructionStr = instruction != null ? String(instruction).slice(0, 500) : null;
    const commentStr = comment != null ? String(comment).slice(0, 800) : null;

    if (id) {
      const [existing] = await pool.execute('SELECT id, OFID FROM serigraphie_planning WHERE id = ?', [id]);
      if (existing.length === 0) return res.status(404).json({ error: 'Ordre introuvable' });
      const [duplicate] = await pool.execute(
        'SELECT id FROM serigraphie_planning WHERE OFID = ? AND id != ?',
        [ofidTrim, id]
      );
      if (duplicate.length > 0) {
        return res.status(422).json({
          errors: { OFID: ['Cet OF est déjà inséré, veuillez en choisir un autre.'] },
          message: 'Cet OF est déjà inséré, veuillez en choisir un autre.',
        });
      }
      await pool.execute(
        `UPDATE serigraphie_planning SET OFID=?, prod_ref=?, prod_des=?, client=?, commande=?, qte_plan=?, qte_reel=?, statut=?, date_planifie=?, instruction=?, comment=?, Priority=? WHERE id=?`,
        [ofidTrim, prod_ref || null, prod_des || null, client || null, commande || null, qtePlanNum, qteReelNum, statut, date_planifie, instructionStr, commentStr, priorityNum, id]
      );
    } else {
      const [duplicate] = await pool.execute('SELECT id FROM serigraphie_planning WHERE OFID = ?', [ofidTrim]);
      if (duplicate.length > 0) {
        return res.status(422).json({
          errors: { OFID: ['Cet OF est déjà inséré, veuillez en choisir un autre.'] },
          message: 'Cet OF est déjà inséré, veuillez en choisir un autre.',
        });
      }
      const newId = uuidv4();
      await pool.execute(
        `INSERT INTO serigraphie_planning (id, OFID, prod_ref, prod_des, client, commande, qte_plan, qte_reel, statut, date_planifie, instruction, comment, Priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, ofidTrim, prod_ref || null, prod_des || null, client || null, commande || null, qtePlanNum, qteReelNum, statut, date_planifie, instructionStr, commentStr, priorityNum]
      );
    }
    res.json({ message: 'Commande enregistrée avec succès.' });
  } catch (error) {
    console.error('Serigraphie store error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
  }
});

app.delete('/api/serigraphie/orders/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM serigraphie_planning WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ordre introuvable' });
    res.json({ message: 'Commande supprimée avec succès.' });
  } catch (error) {
    console.error('Serigraphie delete error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

function applyMarginToPlannedQty(ofid, qty) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const isFlacon = ofid && String(ofid).trim().endsWith('/1');
  let rate = 0;
  if (isFlacon) {
    if (n <= 72) rate = 0.4;
    else if (n <= 144) rate = 0.25;
    else if (n <= 216) rate = 0.2;
    else if (n <= 1000) rate = 0.15;
    else if (n <= 20000) rate = 0.1;
  } else {
    if (n <= 48) rate = 0.4;
    else if (n <= 96) rate = 0.25;
    else if (n <= 192) rate = 0.15;
    else if (n <= 480) rate = 0.08;
    else if (n <= 1000) rate = 0.07;
    else if (n <= 5000) rate = 0.03;
    else rate = 0.02;
  }
  return Math.ceil(n * (1 + rate));
}

app.post('/api/serigraphie/orders/import', authenticateToken, async (req, res) => {
  try {
    const { rows: rawRows } = req.body;
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.status(422).json({ error: 'Aucune ligne à importer.' });
    }
    const [productsRows] = await pool.execute('SELECT ref_id, product_name FROM products');
    const productByName = {};
    (productsRows || []).forEach((r) => { productByName[r.ref_id] = r.product_name; });

    let inserted = 0;
    const errors = [];
    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];
      const client = (r.client != null ? String(r.client) : '').trim() || null;
      const commande = (r.commande != null ? String(r.commande) : '').trim() || null;
      const OFID = (r.OFID != null ? String(r.OFID) : '').trim();
      const prod_ref = (r.prod_ref != null ? String(r.prod_ref) : '').trim() || null;
      const date_planifie = (r.date_planifie != null ? String(r.date_planifie) : '').trim() || null;
      let qte_plan = Number(r.qte_plan);
      if (!Number.isFinite(qte_plan) || qte_plan < 0) qte_plan = 0;
      qte_plan = applyMarginToPlannedQty(OFID, qte_plan);
      if (qte_plan < 1) qte_plan = 1;
      const instruction = (r.instruction != null ? String(r.instruction) : '').slice(0, 500) || null;
      const comment = (r.comment != null ? String(r.comment) : '').slice(0, 800) || null;
      const prod_des = (prod_ref && productByName[prod_ref]) ? productByName[prod_ref] : (r.prod_des != null ? String(r.prod_des).slice(0, 500) : null);

      if (!OFID) {
        errors.push(`Ligne ${i + 1}: OFID manquant.`);
        continue;
      }
      const [ex] = await pool.execute('SELECT id FROM serigraphie_planning WHERE OFID = ?', [OFID]);
      if (ex.length > 0) {
        errors.push(`Ligne ${i + 1}: OF ${OFID} déjà existant.`);
        continue;
      }
      const newId = uuidv4();
      await pool.execute(
        `INSERT INTO serigraphie_planning (id, OFID, prod_ref, prod_des, client, commande, qte_plan, qte_reel, statut, date_planifie, instruction, comment, Priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Planifié', ?, ?, ?, 0)`,
        [newId, OFID, prod_ref, prod_des, client, commande, qte_plan, date_planifie, instruction, comment]
      );
      inserted++;
    }
    res.json({ message: `${inserted} ordre(s) importé(s).`, inserted, errors: errors.length ? errors : undefined });
  } catch (error) {
    console.error('Serigraphie import error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'import.' });
  }
});

// ---------- Déclaration Sérigraphie ----------
// List planning rows with total qte_fab per OFID (for index page).
// Use a single path segment (/declaration-list) so no parametric route can match first.
const serigraphieDeclarationListHandler = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.OFID, p.commande, p.client, p.prod_des, p.qte_plan, p.qte_reel, p.statut, p.id AS planning_id,
              COALESCE(d.tot_fab, 0) AS qte_fab
       FROM serigraphie_planning p
       LEFT JOIN (
         SELECT OFID, SUM(qte_fab) AS tot_fab FROM serigraphie_declaration GROUP BY OFID
       ) d ON p.OFID = d.OFID
       ORDER BY p.created_at DESC, p.OFID`
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Serigraphie declaration list error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des déclarations.' });
  }
};
// Debug: unauthenticated ping to confirm /api/serigraphie/* is reachable (remove in prod if desired)
app.get('/api/serigraphie/ping', (req, res) => res.json({ ok: true, path: '/api/serigraphie/ping' }));
app.get('/api/serigraphie/declaration-list', authenticateToken, serigraphieDeclarationListHandler);
app.get('/api/serigraphie/declaration/list', authenticateToken, serigraphieDeclarationListHandler);
app.get('/api/serigraphie/declarations/list', authenticateToken, serigraphieDeclarationListHandler);

// Get declarations by OFID (for declarations modal). ofid = path segment, use decodeURIComponent
app.get('/api/serigraphie/declarations-by-ofid/:ofid', authenticateToken, async (req, res) => {
  try {
    const ofid = decodeURIComponent(req.params.ofid || '');
    if (!ofid) return res.status(400).json({ error: 'OFID manquant.' });
    const [rows] = await pool.execute(
      'SELECT id, OFID, commande, product, client, date_debut, date_fin, qte_fab, Mat_quality AS mat_quality, Mat_prod AS mat_prod, `Comment` AS comment FROM serigraphie_declaration WHERE OFID = ? ORDER BY created_at DESC',
      [ofid]
    );
    res.json(rows);
  } catch (error) {
    console.error('Serigraphie declarations by OFID error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des déclarations.' });
  }
});

// Create declaration + optional quality rows; update planning statut
app.post('/api/serigraphie/declaration', authenticateToken, async (req, res) => {
  try {
    const { OFID, date_debut, date_fin, qte_fab, Mat_prod, Mat_quality, Comment, statut, qty_nc } = req.body;
    if (!OFID || !String(OFID).trim()) return res.status(422).json({ error: 'OFID requis.' });
    const qteFabNum = parseInt(qte_fab, 10);
    if (!Number.isFinite(qteFabNum) || qteFabNum < 0) return res.status(422).json({ error: 'Quantité fabriquée invalide (min 0).' });
    const matProdNum = parseInt(Mat_prod, 10);
    const matQualityNum = parseInt(Mat_quality, 10);
    if (!Number.isFinite(matProdNum) || matProdNum < 0) return res.status(422).json({ error: 'Nombre d\'agents production requis.' });
    if (!Number.isFinite(matQualityNum) || matQualityNum < 0) return res.status(422).json({ error: 'Nombre d\'agents qualité requis.' });
    const validStatuts = ['Planifié', 'En cours', 'Réalisé', 'Suspendu', 'Cloturé', 'Clotûré'];
    const statutVal = statut && validStatuts.includes(statut) ? statut : 'En cours';

    const [planning] = await pool.execute(
      'SELECT id, commande, client, prod_des FROM serigraphie_planning WHERE OFID = ?',
      [String(OFID).trim()]
    );
    if (planning.length === 0) return res.status(404).json({ error: 'OF introuvable dans le planning.' });
    const { commande, client, prod_des } = planning[0];

    await pool.execute(
      'UPDATE serigraphie_planning SET statut = ?, updated_at = NOW() WHERE OFID = ?',
      [statutVal, String(OFID).trim()]
    );
    const dateDebutVal = toMySQLDateTime(date_debut);
    const dateFinVal = toMySQLDateTime(date_fin);
    const [ins] = await pool.execute(
      `INSERT INTO serigraphie_declaration (OFID, commande, product, client, date_debut, date_fin, qte_fab, Mat_prod, Mat_quality, \`Comment\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(OFID).trim(),
        commande || null,
        prod_des || null,
        client || null,
        dateDebutVal,
        dateFinVal,
        qteFabNum,
        matProdNum,
        matQualityNum,
        Comment != null ? String(Comment).slice(0, 2000) : null,
      ]
    );
    const declarationId = ins.insertId;
    const qualityRows = Array.isArray(qty_nc) ? qty_nc : [];
    for (const row of qualityRows) {
      const component = row.component != null ? String(row.component) : '';
      const componentName = row.component_name != null ? String(row.component_name) : '';
      const qtyNc = parseInt(row.qty_nc, 10);
      const def = row.default != null ? String(row.default).slice(0, 255) : null;
      const comment = row.comment != null ? String(row.comment).slice(0, 500) : null;
      if (!component && !componentName && !Number.isFinite(qtyNc)) continue;
      await pool.execute(
        'INSERT INTO seri_quality (ofid, Component_code, Component_name, qty_nc, `default`, comment) VALUES (?, ?, ?, ?, ?, ?)',
        [String(OFID).trim(), component || null, componentName || null, Number.isFinite(qtyNc) ? qtyNc : null, def, comment]
      );
    }
    res.json({ success: true, id: declarationId, message: 'Déclaration enregistrée avec succès.' });
  } catch (error) {
    console.error('Serigraphie declaration create error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la déclaration.' });
  }
});

// Normalize value to MySQL DATE (YYYY-MM-DD); accepts ISO string or YYYY-MM-DD
function toMySQLDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

// Normalize to MySQL DATETIME (YYYY-MM-DD HH:mm:ss); accepts Date, date string, datetime-local (yyyy-MM-ddTHH:mm), or ISO
function toMySQLDateTime(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    const h = String(v.getHours()).padStart(2, '0');
    const min = String(v.getMinutes()).padStart(2, '0');
    const s = String(v.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }
  const s = String(v).trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (dateOnly) return s + ' 00:00:00';
  const dtMatch = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (dtMatch) {
    const [, ymd, h, m, sec] = dtMatch;
    return `${ymd} ${h.padStart(2, '0')}:${m}:${(sec || '00').padStart(2, '0')}`;
  }
  const dateMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return dateMatch ? dateMatch[1] + ' 00:00:00' : null;
}

// Update declaration (Comment is MySQL reserved word – use backticks in SQL)
app.patch('/api/serigraphie/declaration/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID invalide.' });
    const body = req.body || {};
    const date_debut = toMySQLDateTime(body.date_debut);
    const date_fin = toMySQLDateTime(body.date_fin);
    const qte_fab = body.qte_fab != null ? parseInt(body.qte_fab, 10) : null;
    const commentVal = body.Comment != null ? String(body.Comment).slice(0, 2000) : null;
    const mat_quality = body.mat_quality != null ? parseInt(body.mat_quality, 10) : null;
    const mat_prod = body.mat_prod != null ? parseInt(body.mat_prod, 10) : null;

    const [existing] = await pool.execute('SELECT id FROM serigraphie_declaration WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Déclaration introuvable.' });

    await pool.execute(
      `UPDATE serigraphie_declaration SET date_debut=?, date_fin=?, qte_fab=COALESCE(?, qte_fab), \`Comment\`=?, Mat_quality=COALESCE(?, Mat_quality), Mat_prod=COALESCE(?, Mat_prod), updated_at=NOW() WHERE id=?`,
      [date_debut, date_fin, qte_fab, commentVal, mat_quality, mat_prod, id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Serigraphie declaration update error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
});

// Delete declaration
app.delete('/api/serigraphie/declaration/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [result] = await pool.execute('DELETE FROM serigraphie_declaration WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Déclaration introuvable.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Serigraphie declaration delete error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});

// Components for product (by product name) – product_components joined with products
app.get('/api/serigraphie/components', authenticateToken, async (req, res) => {
  try {
    const productName = req.query.product_name != null ? String(req.query.product_name).trim() : '';
    if (!productName) return res.json([]);
    const [rows] = await pool.execute(
      `SELECT pc.id, pc.component_name, pc.component_code
       FROM product_components pc
       INNER JOIN products p ON p.id = pc.product_id
       WHERE p.product_name = ?
       ORDER BY pc.component_code, pc.component_name`,
      [productName]
    );
    res.json(rows || []);
  } catch (error) {
    console.error('Serigraphie components error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des composants.' });
  }
});

// Défauts list (defaut_list) for rebut dropdown
app.get('/api/serigraphie/defauts', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, label FROM defaut_list ORDER BY label');
    const seen = new Set();
    const unique = (rows || []).filter((r) => {
      const k = (r.label || '').trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    res.json(unique);
  } catch (error) {
    console.error('Serigraphie defauts error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des défauts.' });
  }
});

// Store rebut (waste)
app.post('/api/serigraphie/rebut', authenticateToken, async (req, res) => {
  try {
    const { OFID, date_declaration, quantite, composant_id, defaut_id, commentaire } = req.body;
    if (!OFID || !String(OFID).trim()) return res.status(422).json({ error: 'OFID requis.' });
    if (!date_declaration || !String(date_declaration).trim()) return res.status(422).json({ error: 'Date de déclaration requise.' });
    const qte = parseInt(quantite, 10);
    if (!Number.isFinite(qte) || qte < 1) return res.status(422).json({ error: 'Quantité requise (min 1).' });
    const [exists] = await pool.execute('SELECT id FROM serigraphie_planning WHERE OFID = ?', [String(OFID).trim()]);
    if (exists.length === 0) return res.status(404).json({ error: 'OF introuvable.' });
    await pool.execute(
      `INSERT INTO serigraphie_rebuts (OFID, date_declaration, quantite, composant_id, defaut_id, commentaire, status) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        String(OFID).trim(),
        String(date_declaration).slice(0, 10),
        qte,
        composant_id || null,
        defaut_id || null,
        commentaire != null ? String(commentaire).slice(0, 2000) : null,
      ]
    );
    res.json({ success: true, message: 'Rebut enregistré avec succès.' });
  } catch (error) {
    console.error('Serigraphie rebut store error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du rebut.' });
  }
});

// Rebuts by OFID (encoded base64 in URL)
app.get('/api/serigraphie/rebuts/:encodedOFID', authenticateToken, async (req, res) => {
  try {
    let ofid = req.params.encodedOFID || '';
    try {
      ofid = Buffer.from(ofid, 'base64').toString('utf8');
    } catch (_) {
      ofid = decodeURIComponent(req.params.encodedOFID || '');
    }
    if (!ofid) return res.status(400).json({ error: 'OFID manquant.' });
    const [rows] = await pool.execute(
      `SELECT r.id, r.OFID, r.date_declaration, r.quantite, r.commentaire,
              r.composant_id, r.defaut_id,
              pc.component_name AS composant_name, pc.component_code AS composant_code,
              dl.label AS defaut_label
       FROM serigraphie_rebuts r
       LEFT JOIN product_components pc ON pc.id = r.composant_id
       LEFT JOIN defaut_list dl ON dl.id = r.defaut_id
       WHERE r.OFID = ?
       ORDER BY r.date_declaration DESC`,
      [ofid]
    );
    res.json(rows || []);
  } catch (error) {
    console.error('Serigraphie rebuts list error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des rebuts.' });
  }
});

// Delete rebut
app.delete('/api/serigraphie/rebut/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [result] = await pool.execute('DELETE FROM serigraphie_rebuts WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Rebut introuvable.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Serigraphie rebut delete error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});

// Create form data: planning row by OFID (base64) + components for product
app.get('/api/serigraphie/declaration/create-form/:encodedOFID', authenticateToken, async (req, res) => {
  try {
    let ofid = req.params.encodedOFID || '';
    try {
      ofid = Buffer.from(ofid, 'base64').toString('utf8');
    } catch (_) {
      ofid = decodeURIComponent(ofid);
    }
    if (!ofid) return res.status(400).json({ error: 'OFID manquant.' });
    const [planning] = await pool.execute(
      'SELECT id, OFID, commande, client, prod_des, qte_plan, qte_reel, instruction, statut FROM serigraphie_planning WHERE OFID = ?',
      [ofid]
    );
    if (planning.length === 0) return res.status(404).json({ error: 'OF introuvable.' });
    const prodDes = planning[0].prod_des || '';
    const [components] = await pool.execute(
      `SELECT pc.id, pc.component_name, pc.component_code
       FROM product_components pc
       INNER JOIN products p ON p.id = pc.product_id
       WHERE p.product_name = ?
       ORDER BY pc.component_code, pc.component_name`,
      [prodDes]
    );
    res.json({ planning: planning[0], components: components || [] });
  } catch (error) {
    console.error('Serigraphie create-form error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement du formulaire.' });
  }
});

app.delete('/api/commandes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM commandes WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete commande error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la commande' });
  }
});

// Products Routes
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const hasPaginationParams = req.query.page !== undefined || req.query.limit !== undefined;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const search = (req.query.search || '').trim();
    const offset = (page - 1) * limit;

    console.log('=== Products API Request ===');
    console.log('Query params:', req.query);
    console.log('Parsed params:', { page, limit, search, offset, hasSearch: !!search, hasPaginationParams });

    // Always use paginated format when pagination params are present
    // If no pagination params, return old format for backward compatibility
    if (!hasPaginationParams) {
      console.log('No pagination params - returning all products (old format)');
      const [products] = await pool.execute('SELECT * FROM products ORDER BY product_name');
      return res.json(products);
    }

    // Use paginated format
    let query = 'SELECT * FROM products';
    let countQuery = 'SELECT COUNT(*) as total FROM products';
    const params = [];

    // LIMIT/OFFSET as literals (some MySQL/drivers reject them as bound params – ER_WRONG_ARGUMENTS)
    const limitNum = Number(limit);
    const offsetNum = Number(offset);
    if (search && search.length > 0) {
      // Use case-insensitive search - MySQL LIKE is case-insensitive by default for utf8mb4_unicode_ci
      const searchCondition = 'WHERE product_name LIKE ? OR ref_id LIKE ?';
      query += ` ${searchCondition} ORDER BY product_name LIMIT ${limitNum} OFFSET ${offsetNum}`;
      countQuery += ` ${searchCondition}`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
      console.log('🔍 SEARCH MODE');
      console.log('Search query:', query);
      console.log('Search params:', params);
      console.log('Search pattern:', searchPattern);
    } else {
      query += ` ORDER BY product_name LIMIT ${limitNum} OFFSET ${offsetNum}`;
      console.log('📋 NO SEARCH - Returning paginated products');
    }

    const queryParams = search && search.length > 0 ? params : [];
    const countParams = search && search.length > 0 ? params : [];

    console.log('Final query:', query);
    console.log('Final query params:', queryParams);
    console.log('Count query:', countQuery);
    console.log('Count params:', countParams);

    const [products] = await pool.execute(query, queryParams);
    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    console.log('✅ Products found:', products.length, 'Total:', total);
    if (products.length > 0 && search) {
      console.log('First product ref_id:', products[0].ref_id);
    }
    console.log('========================');

    // ALWAYS return paginated format when pagination params are present
    res.json({
      data: products || [],
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { ref_id, product_name, image_url } = req.body;
    const id = uuidv4();

    await pool.execute(
      'INSERT INTO products (id, ref_id, product_name, image_url) VALUES (?, ?, ?, ?)',
      [id, ref_id, product_name, image_url || null]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du produit' });
  }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { ref_id, product_name, image_url } = req.body;

    await pool.execute(
      'UPDATE products SET ref_id = ?, product_name = ?, image_url = ?, updated_at = NOW() WHERE id = ?',
      [ref_id, product_name, image_url || null, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM products WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' });
  }
});

// ---------- Laquage (perfume bottle coating workshop) ----------
async function laquageRecalcStatus(pool, laquageId) {
  const [sumRows] = await pool.execute(
    'SELECT COALESCE(SUM(quantite_fabriquee), 0) AS total FROM declarations_laquage WHERE laquage_id = ?',
    [laquageId]
  );
  const total = Number(sumRows[0]?.total ?? 0);
  const [ord] = await pool.execute('SELECT quantite_planifie FROM laquage WHERE id = ?', [laquageId]);
  const quantitePlanifie = Number(ord[0]?.quantite_planifie ?? 0);
  let status = 'Planifié';
  if (total > 0 && total < quantitePlanifie) status = 'En cours';
  if (total >= quantitePlanifie) status = 'Réalisé';
  await pool.execute('UPDATE laquage SET status = ?, updated_at = NOW() WHERE id = ?', [status, laquageId]);
}

app.get('/api/laquage/orders', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT l.*, COALESCE(SUM(d.quantite_fabriquee), 0) AS total_fabriquee
       FROM laquage l
       LEFT JOIN declarations_laquage d ON l.id = d.laquage_id
       GROUP BY l.id
       ORDER BY l.ordre ASC, l.created_at DESC`
    );
    const orders = (rows || []).map((r) => ({
      ...r,
      quantiteFabriqueeTotal: Number(r.total_fabriquee ?? 0),
      tauxRealisation: r.quantite_planifie > 0
        ? Math.round((Number(r.total_fabriquee ?? 0) / r.quantite_planifie) * 10000) / 100
        : 0,
    }));
    res.json({ data: orders });
  } catch (error) {
    console.error('Laquage orders list error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des ordres.' });
  }
});

app.get('/api/laquage/next-ofid', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT OFID FROM laquage WHERE OFID REGEXP \'^[0-9]+$\' ORDER BY CAST(OFID AS UNSIGNED) DESC LIMIT 1'
    );
    const next = rows.length > 0 ? (parseInt(rows[0].OFID, 10) || 0) + 1 : 1;
    res.json({ ofid: String(next).padStart(4, '0') });
  } catch (error) {
    console.error('Laquage next OFID error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.post('/api/laquage/orders', authenticateToken, async (req, res) => {
  try {
    const { ordre, client, commande, ofid, designation, dateProduction, quantitePlanifie, status } = req.body;
    if (!client?.trim() || !commande?.trim() || !ofid?.trim() || !designation?.trim()) {
      return res.status(422).json({ error: 'Client, commande, OFID et désignation sont requis.' });
    }
    const qte = parseInt(quantitePlanifie, 10);
    if (!Number.isFinite(qte) || qte < 1) return res.status(422).json({ error: 'Quantité planifiée invalide.' });
    const dateProd = toMySQLDate(dateProduction) || null;
    const stat = ['Planifié', 'En cours', 'Réalisé'].includes(status) ? status : 'Planifié';
    const ordreNum = ordre != null ? parseInt(ordre, 10) : null;
    await pool.execute(
      'INSERT INTO laquage (ordre, client, commande, OFID, designation, date_production, quantite_planifie, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [ordreNum, String(client).trim(), String(commande).trim(), String(ofid).trim(), String(designation).trim(), dateProd, qte, stat]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Laquage create order error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'ordre.' });
  }
});

app.put('/api/laquage/orders/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { ordre, client, commande, ofid, designation, dateProduction, quantitePlanifie, status } = req.body;
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID invalide.' });
    if (!client?.trim() || !commande?.trim() || !ofid?.trim() || !designation?.trim()) {
      return res.status(422).json({ error: 'Client, commande, OFID et désignation sont requis.' });
    }
    const qte = parseInt(quantitePlanifie, 10);
    if (!Number.isFinite(qte) || qte < 1) return res.status(422).json({ error: 'Quantité planifiée invalide.' });
    const dateProd = toMySQLDate(dateProduction) || null;
    const stat = ['Planifié', 'En cours', 'Réalisé'].includes(status) ? status : 'Planifié';
    const ordreNum = ordre != null ? parseInt(ordre, 10) : null;
    await pool.execute(
      'UPDATE laquage SET ordre=?, client=?, commande=?, OFID=?, designation=?, date_production=?, quantite_planifie=?, status=?, updated_at=NOW() WHERE id=?',
      [ordreNum, String(client).trim(), String(commande).trim(), String(ofid).trim(), String(designation).trim(), dateProd, qte, stat, id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Laquage update order error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
});

app.patch('/api/laquage/orders/:id/ordre', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const ordre = req.body?.ordre != null ? parseInt(req.body.ordre, 10) : null;
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID invalide.' });
    await pool.execute('UPDATE laquage SET ordre=?, updated_at=NOW() WHERE id=?', [ordre, id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Laquage update ordre error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.delete('/api/laquage/orders/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID invalide.' });
    await pool.execute('DELETE FROM laquage WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Laquage delete order error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});

app.get('/api/laquage/search/clients', authenticateToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let sql = 'SELECT DISTINCT COALESCE(NULLIF(TRIM(designation), ""), name) AS name FROM clients';
    const params = [];
    if (q.length >= 1) {
      sql += ' WHERE (name LIKE ? OR designation LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY name LIMIT 50';
    const [rows] = await pool.execute(sql, params);
    res.json((rows || []).map((r) => r.name).filter(Boolean));
  } catch (error) {
    console.error('Laquage search clients error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/laquage/search/products', authenticateToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const [rows] = await pool.execute(
      'SELECT product_name FROM products WHERE product_name LIKE ? ORDER BY product_name LIMIT 20',
      [`%${q}%`]
    );
    res.json((rows || []).map((r) => r.product_name).filter(Boolean));
  } catch (error) {
    console.error('Laquage search products error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/laquage/search/commandes', authenticateToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let sql = 'SELECT DISTINCT num_commande FROM commandes WHERE num_commande IS NOT NULL AND num_commande != ""';
    const params = [];
    if (q.length >= 2) {
      sql += ' AND (num_commande LIKE ?)';
      params.push(`%${q}%`);
    }
    sql += ' ORDER BY num_commande LIMIT 50';
    const [rows] = await pool.execute(sql, params);
    res.json((rows || []).map((r) => r.num_commande).filter(Boolean));
  } catch (error) {
    console.error('Laquage search commandes error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/laquage/declarations', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT l.id AS laquage_id, l.client, l.commande, l.OFID, l.designation, l.quantite_planifie, l.status, l.created_at,
        COALESCE(SUM(d.quantite_fabriquee), 0) AS total_fabriquee,
        (SELECT commentaire FROM declarations_laquage WHERE laquage_id = l.id AND commentaire IS NOT NULL AND commentaire != '' ORDER BY created_at DESC LIMIT 1) AS commentaire
       FROM laquage l
       LEFT JOIN declarations_laquage d ON l.id = d.laquage_id
       GROUP BY l.id
       ORDER BY l.created_at DESC`
    );
    res.json({ data: rows || [] });
  } catch (error) {
    console.error('Laquage declarations list error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/laquage/declarations/history/:laquageId', authenticateToken, async (req, res) => {
  try {
    const laquageId = parseInt(req.params.laquageId, 10);
    if (!Number.isFinite(laquageId)) return res.status(400).json({ error: 'ID invalide.' });
    const [rows] = await pool.execute(
      'SELECT id, laquage_id, quantite_fabriquee, `day`, heure_debut, heure_fin, commentaire, created_at FROM declarations_laquage WHERE laquage_id = ? ORDER BY `day` DESC, heure_debut DESC',
      [laquageId]
    );
    res.json(rows || []);
  } catch (error) {
    console.error('Laquage declaration history error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.post('/api/laquage/declarations', authenticateToken, async (req, res) => {
  try {
    const { laquageId, quantiteFabriquee, day, heureDebut, heureFin, commentaire } = req.body;
    const lid = parseInt(laquageId, 10);
    if (!Number.isFinite(lid)) return res.status(422).json({ error: 'laquageId invalide.' });
    const qte = parseInt(quantiteFabriquee, 10);
    if (!Number.isFinite(qte) || qte < 1) return res.status(422).json({ error: 'Quantité fabriquée invalide (min 1).' });
    if (!heureDebut?.match(/^\d{2}:\d{2}$/) || !heureFin?.match(/^\d{2}:\d{2}$/)) {
      return res.status(422).json({ error: 'Heure début et heure fin au format HH:mm requises.' });
    }
    if (heureFin <= heureDebut) return res.status(422).json({ error: 'L\'heure de fin doit être supérieure à l\'heure de début.' });
    const dayVal = toMySQLDate(day) || null;
    await pool.execute(
      'INSERT INTO declarations_laquage (laquage_id, quantite_fabriquee, `day`, heure_debut, heure_fin, commentaire) VALUES (?, ?, ?, ?, ?, ?)',
      [lid, qte, dayVal, heureDebut, heureFin, commentaire?.slice(0, 500) || null]
    );
    await laquageRecalcStatus(pool, lid);
    res.json({ success: true });
  } catch (error) {
    console.error('Laquage create declaration error:', error);
    res.status(500).json({ error: 'Erreur lors de la création.' });
  }
});

app.put('/api/laquage/declarations/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { quantiteFabriquee, day, heureDebut, heureFin, commentaire } = req.body;
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID invalide.' });
    const [existing] = await pool.execute('SELECT laquage_id FROM declarations_laquage WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Déclaration introuvable.' });
    const qte = parseInt(quantiteFabriquee, 10);
    if (!Number.isFinite(qte) || qte < 1) return res.status(422).json({ error: 'Quantité invalide.' });
    if (!heureDebut?.match(/^\d{2}:\d{2}$/) || !heureFin?.match(/^\d{2}:\d{2}$/)) {
      return res.status(422).json({ error: 'Heures au format HH:mm requises.' });
    }
    if (heureFin <= heureDebut) return res.status(422).json({ error: 'Heure fin > heure début.' });
    const dayVal = toMySQLDate(day) || null;
    await pool.execute(
      'UPDATE declarations_laquage SET quantite_fabriquee=?, `day`=?, heure_debut=?, heure_fin=?, commentaire=?, updated_at=NOW() WHERE id=?',
      [qte, dayVal, heureDebut, heureFin, commentaire?.slice(0, 500) || null, id]
    );
    await laquageRecalcStatus(pool, existing[0].laquage_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Laquage update declaration error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.delete('/api/laquage/declarations/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await pool.execute('SELECT laquage_id FROM declarations_laquage WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Déclaration introuvable.' });
    await pool.execute('DELETE FROM declarations_laquage WHERE id = ?', [id]);
    await laquageRecalcStatus(pool, existing[0].laquage_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Laquage delete declaration error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/laquage/rebuts', authenticateToken, async (req, res) => {
  try {
    const [ordres] = await pool.execute(
      'SELECT id, OFID, client, commande, quantite_planifie, created_at FROM laquage ORDER BY created_at DESC'
    );
    const ofids = [...new Set((ordres || []).map((o) => o.OFID))];
    const result = await Promise.all(
      ofids.map(async (ofid) => {
        const o = ordres.find((x) => x.OFID === ofid);
        const [sumRows] = await pool.execute(
          'SELECT COALESCE(SUM(quantite), 0) AS total FROM rebut_laquage WHERE OFID = ?',
          [ofid]
        );
        return { ...o, totalRebut: Number(sumRows[0]?.total ?? 0) };
      })
    );
    res.json({ data: result });
  } catch (error) {
    console.error('Laquage rebuts list error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/laquage/rebuts/history/:ofid', authenticateToken, async (req, res) => {
  try {
    const ofid = decodeURIComponent(req.params.ofid || '');
    if (!ofid) return res.status(400).json({ error: 'OFID manquant.' });
    const [rows] = await pool.execute(
      'SELECT id, OFID, date_declaration, quantite, composant, defaut, commentaire, created_at FROM rebut_laquage WHERE OFID = ? ORDER BY created_at DESC',
      [ofid]
    );
    res.json(rows || []);
  } catch (error) {
    console.error('Laquage rebut history error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.post('/api/laquage/rebuts', authenticateToken, async (req, res) => {
  try {
    const { ofid, quantite, composant, defaut, commentaire } = req.body;
    if (!ofid?.trim()) return res.status(422).json({ error: 'OFID requis.' });
    const qte = parseInt(quantite, 10);
    if (!Number.isFinite(qte) || qte < 1) return res.status(422).json({ error: 'Quantité invalide (min 1).' });
    if (!composant?.trim()) return res.status(422).json({ error: 'Composant requis.' });
    const defautVal = ['Poudre', 'Peinture', 'Temperature', 'Casse'].includes(defaut) ? defaut : 'Poudre';
    const dateDecl = toMySQLDate(req.body.dateDeclaration) || toMySQLDate(new Date().toISOString().slice(0, 10));
    await pool.execute(
      'INSERT INTO rebut_laquage (OFID, date_declaration, quantite, composant, defaut, commentaire) VALUES (?, ?, ?, ?, ?, ?)',
      [String(ofid).trim(), dateDecl, qte, String(composant).trim(), defautVal, commentaire?.slice(0, 500) || null]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Laquage create rebut error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.put('/api/laquage/rebuts/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { quantite, composant, defaut, commentaire } = req.body;
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID invalide.' });
    const qte = parseInt(quantite, 10);
    if (!Number.isFinite(qte) || qte < 1) return res.status(422).json({ error: 'Quantité invalide.' });
    if (!composant?.trim()) return res.status(422).json({ error: 'Composant requis.' });
    const defautVal = ['Poudre', 'Peinture', 'Temperature', 'Casse'].includes(defaut) ? defaut : 'Poudre';
    await pool.execute(
      'UPDATE rebut_laquage SET quantite=?, composant=?, defaut=?, commentaire=?, updated_at=NOW() WHERE id=?',
      [qte, String(composant).trim(), defautVal, commentaire?.slice(0, 500) || null, id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Laquage update rebut error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.delete('/api/laquage/rebuts/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID invalide.' });
    await pool.execute('DELETE FROM rebut_laquage WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Laquage delete rebut error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// ---------- Injection module (perfume bottle injection workshop) ----------
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  console.log('Injection API: registering /api/injection/* routes');
}
const INJECTION_DESIGNATIONS = [
  'CAP TWIST F01 4.5g', 'CAP PUSH PULL 20mm 2g', 'CAP PUSH PULL 24mm 2.3g', 'COLLAR F01 3.4g', 'COLLAR F04 5g', 'COLLAR F05',
  'COLLAR F06 3.2G', 'COLLAR F07 4g', 'COLLAR F08 PUSH PULL 3g', 'COLLAR F08 SPRAY 3g', 'COLLAR Cuba 15mm 2.1g', 'COLLAR Cuba 20mm 2.1g',
  'F01 SPRAY 1.2G', 'INNER F02 11.5g', 'INNER F06 8g', 'INNER F09 5g', 'INNER CUBA 20 COFFRET', 'INNER CUBA 20', 'BASE F01', 'BASE F02', 'BASE F04',
];
const INJECTION_MACHINES = ['PCD093-86T', 'PCD094-86T', 'PCD095-120T', 'PCD096-120T', 'PCD097-120T', 'PCD098-120T', 'PCD099-120T', 'PCD0100-120T', 'PCD0101-120T'];
const INJECTION_DEFAUTS = ['Taches', "Point d'injection", "Bulle d'air", 'Coloration', 'Incomplet', 'Déformation', 'Brillance', 'Bavure', 'Shrinking'];
const INJECTION_CAUSES = ['Réglage', 'Machine', 'Moule', 'Matière'];

app.get('/api/injection/orders', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT i.\`Of\`, i.Designation, i.Quantite, i.Date_planification, i.user_name, i.created_at, i.updated_at,
        COALESCE(SUM(d.Quantite), 0) AS total_fabriquee
       FROM Injection_table i
       LEFT JOIN declaration_injection d ON i.\`Of\` = d.\`Of\`
       GROUP BY i.\`Of\`
       ORDER BY i.Date_planification DESC, i.\`Of\` ASC`
    );
    const orders = (rows || []).map((r) => {
      const total = Number(r.total_fabriquee ?? 0);
      const quantite = Number(r.Quantite ?? 0);
      let status = 'Planifié';
      if (total >= quantite && quantite > 0) status = 'Réalisé';
      else if (total > 0) status = 'En cours';
      const taux = quantite > 0 ? Math.round((total / quantite) * 10000) / 100 : 0;
      return {
        of: r.Of,
        designation: r.Designation,
        quantite,
        date_planification: r.Date_planification,
        user_name: r.user_name,
        created_at: r.created_at,
        updated_at: r.updated_at,
        total_fabriquee: total,
        taux_realisation: taux,
        status,
      };
    });
    res.json({ data: orders });
  } catch (error) {
    console.error('Injection orders error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des ordres.' });
  }
});

app.get('/api/injection/next-of', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT `Of` FROM Injection_table WHERE `Of` REGEXP \'^[0-9]+$\' ORDER BY CAST(`Of` AS UNSIGNED) DESC LIMIT 1'
    );
    const next = rows.length > 0 ? (parseInt(rows[0].Of, 10) || 0) + 1 : 1;
    res.json({ of: String(next).padStart(3, '0') });
  } catch (error) {
    console.error('Injection next OF error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/injection/orders/:of', authenticateToken, async (req, res) => {
  try {
    const of = String(req.params.of || '').trim();
    const [rows] = await pool.execute('SELECT `Of`, Designation, Quantite, Date_planification, user_name, created_at, updated_at FROM Injection_table WHERE `Of` = ?', [of]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ordre introuvable.' });
    const r = rows[0];
    res.json({
      of: r.Of,
      designation: r.Designation,
      quantite: Number(r.Quantite),
      date_planification: r.Date_planification,
      user_name: r.user_name,
      created_at: r.created_at,
      updated_at: r.updated_at,
    });
  } catch (error) {
    console.error('Injection get order error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.post('/api/injection/orders', authenticateToken, async (req, res) => {
  try {
    const { of, designation, quantite, date_planification } = req.body;
    const ofStr = String(of ?? '').trim();
    if (!ofStr) return res.status(422).json({ error: 'L\'OF est requis.' });
    if (!designation?.trim()) return res.status(422).json({ error: 'La désignation est requise.' });
    const qte = parseInt(quantite, 10);
    if (!Number.isFinite(qte) || qte < 1) return res.status(422).json({ error: 'La quantité doit être supérieure à 0.' });
    const dateVal = toMySQLDateTime(date_planification);
    if (!dateVal) return res.status(422).json({ error: 'La date de planification est requise.' });
    const userName = req.user?.email || req.user?.full_name || null;
    await pool.execute(
      'INSERT INTO Injection_table (`Of`, Designation, Quantite, Date_planification, user_name) VALUES (?, ?, ?, ?, ?)',
      [ofStr, String(designation).trim(), qte, dateVal, userName]
    );
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cet OF existe déjà.' });
    console.error('Injection create order error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'ordre.' });
  }
});

app.put('/api/injection/orders/:of', authenticateToken, async (req, res) => {
  try {
    const of = String(req.params.of || '').trim();
    const { designation, quantite, date_planification } = req.body;
    if (!designation?.trim()) return res.status(422).json({ error: 'La désignation est requise.' });
    const qte = parseInt(quantite, 10);
    if (!Number.isFinite(qte) || qte < 1) return res.status(422).json({ error: 'La quantité doit être supérieure à 0.' });
    const dateVal = toMySQLDateTime(date_planification);
    if (!dateVal) return res.status(422).json({ error: 'La date de planification est requise.' });
    const [result] = await pool.execute(
      'UPDATE Injection_table SET Designation=?, Quantite=?, Date_planification=?, updated_at=NOW() WHERE `Of`=?',
      [String(designation).trim(), qte, dateVal, of]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ordre introuvable.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Injection update order error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
});

app.delete('/api/injection/orders/:of', authenticateToken, async (req, res) => {
  try {
    const of = String(req.params.of || '').trim();
    const [result] = await pool.execute('DELETE FROM Injection_table WHERE `Of` = ?', [of]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ordre introuvable.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Injection delete order error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/injection/designations', authenticateToken, async (req, res) => {
  try {
    res.json(INJECTION_DESIGNATIONS);
  } catch (error) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/injection/declarations', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.\`Of\`, i.Designation, i.Quantite, i.Date_planification,
        COALESCE(SUM(d.Quantite), 0) AS total_fabriquee
       FROM Injection_table i
       LEFT JOIN declaration_injection d ON i.\`Of\` = d.\`Of\`
       GROUP BY i.\`Of\`
       ORDER BY i.Date_planification DESC`
    );
    const list = (rows || []).map((r) => {
      const total = Number(r.total_fabriquee ?? 0);
      const quantite = Number(r.Quantite ?? 0);
      let status = 'Planifié';
      if (quantite > 0 && total >= quantite) status = 'Réalisé';
      else if (total > 0) status = 'En cours';
      return {
        of: r.Of,
        designation: r.Designation,
        quantite,
        total_fabriquee: total,
        status,
      };
    });
    res.json({ data: list });
  } catch (error) {
    console.error('Injection declarations list error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/injection/declarations/history/:of', authenticateToken, async (req, res) => {
  try {
    const of = decodeURIComponent(req.params.of || '');
    const [rows] = await pool.execute(
      `SELECT id, \`Of\`, Designation, Quantite, Machine, num_moule, nbr_empreinte, Date_debut, Date_fin, effectif, username, commentaire, created_at
       FROM declaration_injection WHERE \`Of\` = ? ORDER BY Date_debut DESC`,
      [of]
    );
    const list = (rows || []).map((r) => ({
      id: r.id,
      of: r.Of,
      designation: r.Designation,
      quantite: r.Quantite,
      machine: r.Machine,
      num_moule: r.num_moule,
      nbr_empreinte: r.nbr_empreinte,
      date_debut: r.Date_debut,
      date_fin: r.Date_fin,
      effectif: r.effectif,
      username: r.username,
      commentaire: r.commentaire,
      created_at: r.created_at,
    }));
    res.json(list);
  } catch (error) {
    console.error('Injection declaration history error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.post('/api/injection/declarations', authenticateToken, async (req, res) => {
  try {
    const body = req.body;
    const of = String(body.of ?? '').trim();
    if (!of) return res.status(422).json({ error: 'OF requis.' });
    if (!body.designation?.trim()) return res.status(422).json({ error: 'La désignation est requise.' });
    const quantite = parseInt(body.quantite, 10);
    if (!Number.isFinite(quantite) || quantite < 1) return res.status(422).json({ error: 'La quantité doit être supérieure à 0.' });
    if (!body.machine?.trim()) return res.status(422).json({ error: 'La machine est requise.' });
    const dateDebut = toMySQLDateTime(body.date_debut);
    const dateFin = toMySQLDateTime(body.date_fin);
    if (!dateDebut || !dateFin) return res.status(422).json({ error: 'Date début et date fin requises.' });
    if (new Date(dateFin) <= new Date(dateDebut)) return res.status(422).json({ error: 'La date de fin doit être postérieure à la date de début.' });
    const effectif = parseInt(body.effectif, 10);
    if (!Number.isFinite(effectif) || effectif < 1) return res.status(422).json({ error: 'L\'effectif est requis (min 1).' });
    const numMoule = body.num_moule != null && body.num_moule !== '' ? parseInt(body.num_moule, 10) : null;
    const nbrEmpreinte = body.nbr_empreinte != null && body.nbr_empreinte !== '' ? parseInt(body.nbr_empreinte, 10) : null;
    const commentaire = body.commentaire != null ? String(body.commentaire).slice(0, 1000) : null;
    const username = req.user?.email || req.user?.full_name || null;
    await pool.execute(
      `INSERT INTO declaration_injection (\`Of\`, Designation, Quantite, Machine, num_moule, nbr_empreinte, Date_debut, Date_fin, effectif, username, commentaire)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [of, String(body.designation).trim(), quantite, String(body.machine).trim(), numMoule, nbrEmpreinte, dateDebut, dateFin, effectif, username, commentaire]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Injection create declaration error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/injection/declarations/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [rows] = await pool.execute(
      'SELECT id, `Of`, Designation, Quantite, Machine, num_moule, nbr_empreinte, Date_debut, Date_fin, effectif, username, commentaire FROM declaration_injection WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Déclaration introuvable.' });
    const r = rows[0];
    res.json({
      id: r.id,
      of: r.Of,
      designation: r.Designation,
      quantite: r.Quantite,
      machine: r.Machine,
      num_moule: r.num_moule,
      nbr_empreinte: r.nbr_empreinte,
      date_debut: r.Date_debut,
      date_fin: r.Date_fin,
      effectif: r.effectif,
      username: r.username,
      commentaire: r.commentaire,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.put('/api/injection/declarations/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const body = req.body;
    const quantite = parseInt(body.quantite, 10);
    if (!Number.isFinite(quantite) || quantite < 1) return res.status(422).json({ error: 'La quantité doit être supérieure à 0.' });
    if (!body.machine?.trim()) return res.status(422).json({ error: 'La machine est requise.' });
    const dateDebut = toMySQLDateTime(body.date_debut);
    const dateFin = toMySQLDateTime(body.date_fin);
    if (!dateDebut || !dateFin) return res.status(422).json({ error: 'Dates requises.' });
    if (new Date(dateFin) <= new Date(dateDebut)) return res.status(422).json({ error: 'La date de fin doit être postérieure à la date de début.' });
    const effectif = parseInt(body.effectif, 10);
    if (!Number.isFinite(effectif) || effectif < 1) return res.status(422).json({ error: 'L\'effectif est requis.' });
    const numMoule = body.num_moule != null && body.num_moule !== '' ? parseInt(body.num_moule, 10) : null;
    const nbrEmpreinte = body.nbr_empreinte != null && body.nbr_empreinte !== '' ? parseInt(body.nbr_empreinte, 10) : null;
    const commentaire = body.commentaire != null ? String(body.commentaire).slice(0, 1000) : null;
    const [result] = await pool.execute(
      `UPDATE declaration_injection SET Designation=?, Quantite=?, Machine=?, num_moule=?, nbr_empreinte=?, Date_debut=?, Date_fin=?, effectif=?, commentaire=?, updated_at=NOW() WHERE id=?`,
      [String(body.designation).trim(), quantite, String(body.machine).trim(), numMoule, nbrEmpreinte, dateDebut, dateFin, effectif, commentaire, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Déclaration introuvable.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Injection update declaration error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.delete('/api/injection/declarations/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [result] = await pool.execute('DELETE FROM declaration_injection WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Déclaration introuvable.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/injection/machines', authenticateToken, async (req, res) => {
  try {
    res.json(INJECTION_MACHINES);
  } catch (error) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/injection/rebuts', authenticateToken, async (req, res) => {
  try {
    const [orders] = await pool.execute('SELECT `Of`, Designation, Quantite FROM Injection_table ORDER BY Date_planification DESC');
    const list = [];
    for (const row of orders || []) {
      const of = row.Of;
      const [sumRows] = await pool.execute('SELECT COALESCE(SUM(quantite), 0) AS total FROM rebut_inj WHERE `of` = ?', [of]);
      const totalRebut = Number(sumRows[0]?.total ?? 0);
      const quantite = Number(row.Quantite ?? 0);
      const conformity = quantite > 0 ? Math.round(((quantite - totalRebut) / quantite) * 10000) / 100 : 100;
      list.push({
        of,
        designation: row.Designation,
        quantite,
        totalRebut,
        conformity,
      });
    }
    res.json({ data: list });
  } catch (error) {
    console.error('Injection rebuts list error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/injection/rebuts/history/:of', authenticateToken, async (req, res) => {
  try {
    const of = decodeURIComponent(req.params.of || '');
    const [rows] = await pool.execute(
      'SELECT id, `of`, composant, defaut, cause, quantite, username, created_at FROM rebut_inj WHERE `of` = ? ORDER BY created_at DESC',
      [of]
    );
    res.json(rows || []);
  } catch (error) {
    console.error('Injection rebut history error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.post('/api/injection/rebuts', authenticateToken, async (req, res) => {
  try {
    const { of, composant, rebuts } = req.body;
    const ofStr = String(of ?? '').trim();
    if (!ofStr) return res.status(422).json({ error: 'OF requis.' });
    if (!composant?.trim()) return res.status(422).json({ error: 'Composant requis.' });
    if (!Array.isArray(rebuts) || rebuts.length === 0) return res.status(422).json({ error: 'Veuillez ajouter au moins une ligne.' });
    const username = req.user?.email || req.user?.full_name || null;
    let count = 0;
    for (const row of rebuts) {
      const defaut = String(row.defaut ?? '').trim();
      const cause = String(row.cause ?? '').trim();
      const quantite = parseInt(row.quantite, 10);
      if (!defaut || !cause || !Number.isFinite(quantite) || quantite < 1) continue;
      await pool.execute(
        'INSERT INTO rebut_inj (`of`, composant, defaut, cause, quantite, username) VALUES (?, ?, ?, ?, ?, ?)',
        [ofStr, String(composant).trim(), defaut, cause, quantite, username]
      );
      count++;
    }
    if (count === 0) return res.status(422).json({ error: 'Aucune ligne valide (défaut, cause, quantité > 0).' });
    res.json({ success: true, count });
  } catch (error) {
    console.error('Injection create rebuts error:', error);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/injection/rebuts/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [rows] = await pool.execute('SELECT id, `of`, composant, defaut, cause, quantite, username, created_at FROM rebut_inj WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Rebut introuvable.' });
    const r = rows[0];
    res.json({ id: r.id, of: r.of, composant: r.composant, defaut: r.defaut, cause: r.cause, quantite: r.quantite, username: r.username, created_at: r.created_at });
  } catch (error) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.put('/api/injection/rebuts/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { defaut, cause, quantite } = req.body;
    const defautStr = String(defaut ?? '').trim();
    const causeStr = String(cause ?? '').trim();
    const qte = parseInt(quantite, 10);
    if (!defautStr || !causeStr || !Number.isFinite(qte) || qte < 1) return res.status(422).json({ error: 'Défaut, cause et quantité (min 1) requis.' });
    const [result] = await pool.execute('UPDATE rebut_inj SET defaut=?, cause=?, quantite=?, updated_at=NOW() WHERE id=?', [defautStr, causeStr, qte, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Rebut introuvable.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.delete('/api/injection/rebuts/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [result] = await pool.execute('DELETE FROM rebut_inj WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Rebut introuvable.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.get('/api/injection/rebut-options', authenticateToken, async (req, res) => {
  try {
    res.json({ defauts: INJECTION_DEFAUTS, causes: INJECTION_CAUSES });
  } catch (error) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

// Import product components from CSV (MUST be before /api/products/:id/components to avoid route conflict)
app.post('/api/products/components/import', authenticateToken, async (req, res) => {
  try {
    const { rows } = req.body; // Array of { ref_id, component_name, component_code, quantity }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à importer' });
    }

    const results = {
      success: [],
      errors: [],
      skipped: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNumber = i + 2; // +2 because line 1 is header, and arrays are 0-indexed

      // Validate required fields
      if (!row.ref_id || !row.ref_id.trim()) {
        results.errors.push({
          line: lineNumber,
          ref_id: row.ref_id || '',
          error: 'ref_id manquant',
        });
        continue;
      }

      if (!row.component_name || !row.component_name.trim()) {
        results.errors.push({
          line: lineNumber,
          ref_id: row.ref_id,
          error: 'component_name manquant',
        });
        continue;
      }

      // Validate quantity
      const quantity = parseFloat(row.quantity);
      if (isNaN(quantity) || quantity < 0) {
        results.errors.push({
          line: lineNumber,
          ref_id: row.ref_id,
          error: 'quantity invalide (doit être un nombre >= 0)',
        });
        continue;
      }

      let productId = null;
      try {
        // Find product by ref_id
        const [products] = await pool.execute(
          'SELECT id FROM products WHERE ref_id = ?',
          [row.ref_id.trim()]
        );

        if (products.length === 0) {
          results.errors.push({
            line: lineNumber,
            ref_id: row.ref_id,
            error: `Produit avec ref_id "${row.ref_id}" non trouvé`,
          });
          continue;
        }

        productId = products[0].id;

        // Insert component (duplicates are allowed)
        const componentId = uuidv4();
        await pool.execute(
          'INSERT INTO product_components (id, product_id, component_name, component_code, quantity) VALUES (?, ?, ?, ?, ?)',
          [
            componentId,
            productId,
            row.component_name.trim(),
            row.component_code?.trim() || null,
            quantity,
          ]
        );

        results.success.push({
          line: lineNumber,
          ref_id: row.ref_id,
          component_name: row.component_name,
          product_id: productId,
        });
      } catch (error) {
        console.error(`Error importing line ${lineNumber}:`, error);
        // If it's a duplicate key error, still count it as success (duplicates are allowed)
        if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('Duplicate entry')) {
          // Try to get productId if not already set
          if (!productId) {
            const [products] = await pool.execute(
              'SELECT id FROM products WHERE ref_id = ?',
              [row.ref_id.trim()]
            );
            productId = products.length > 0 ? products[0].id : null;
          }
          results.success.push({
            line: lineNumber,
            ref_id: row.ref_id,
            component_name: row.component_name,
            product_id: productId,
          });
        } else {
          results.errors.push({
            line: lineNumber,
            ref_id: row.ref_id,
            error: error.message || 'Erreur lors de l\'importation',
          });
        }
      }
    }

    res.json({
      success: true,
      summary: {
        total: rows.length,
        imported: results.success.length,
        errors: results.errors.length,
        skipped: results.skipped.length,
      },
      details: results,
    });
  } catch (error) {
    console.error('Import components error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'importation des composants' });
  }
});

// Product Components Routes (must be after /api/products/components/import)
app.get('/api/products/:id/components', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [components] = await pool.execute(
      'SELECT * FROM product_components WHERE product_id = ? ORDER BY component_name',
      [id]
    );
    res.json(components);
  } catch (error) {
    console.error('Get components error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des composants' });
  }
});

app.post('/api/products/:id/components', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { component_name, component_code, quantity } = req.body;

    if (!component_name || !quantity) {
      return res.status(400).json({ error: 'component_name et quantity sont requis' });
    }

    const componentId = uuidv4();
    await pool.execute(
      'INSERT INTO product_components (id, product_id, component_name, component_code, quantity) VALUES (?, ?, ?, ?, ?)',
      [componentId, id, component_name, component_code || null, parseFloat(quantity)]
    );

    res.json({ success: true, id: componentId });
  } catch (error) {
    console.error('Create component error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du composant' });
  }
});

app.put('/api/components/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { component_name, component_code, quantity } = req.body;

    await pool.execute(
      'UPDATE product_components SET component_name = ?, component_code = ?, quantity = ?, updated_at = NOW() WHERE id = ?',
      [component_name, component_code || null, quantity, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update component error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du composant' });
  }
});

app.delete('/api/components/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM product_components WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete component error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du composant' });
  }
});

// Chains Routes
app.get('/api/chains', authenticateToken, async (req, res) => {
  try {
    const [chains] = await pool.execute(
      `SELECT c.*, 
              rq.id as responsable_qlty_id, rq.email as responsable_qlty_email, rq.full_name as responsable_qlty_full_name,
              cc.id as chef_de_chaine_id, cc.email as chef_de_chaine_email, cc.full_name as chef_de_chaine_full_name
       FROM chaines c
       LEFT JOIN profiles rq ON c.responsable_qlty_id = rq.id
       LEFT JOIN profiles cc ON c.chef_de_chaine_id = cc.id
       ORDER BY c.num_chaine`
    );
    
    // Format response to match expected structure
    const formattedChains = chains.map(chain => ({
      id: chain.id,
      num_chaine: chain.num_chaine,
      responsable_qlty_id: chain.responsable_qlty_id,
      chef_de_chaine_id: chain.chef_de_chaine_id,
      nbr_operateur: chain.nbr_operateur,
      created_at: chain.created_at,
      updated_at: chain.updated_at,
      responsable_qlty: chain.responsable_qlty_id ? {
        id: chain.responsable_qlty_id,
        email: chain.responsable_qlty_email,
        full_name: chain.responsable_qlty_full_name
      } : null,
      chef_de_chaine: chain.chef_de_chaine_id ? {
        id: chain.chef_de_chaine_id,
        email: chain.chef_de_chaine_email,
        full_name: chain.chef_de_chaine_full_name
      } : null
    }));
    
    res.json(formattedChains);
  } catch (error) {
    console.error('Get chains error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des chaînes' });
  }
});

app.post('/api/chains', authenticateToken, async (req, res) => {
  try {
    const { num_chaine, chef_de_chaine_id, responsable_qlty_id, nbr_operateur } = req.body;
    const id = uuidv4();

    await pool.execute(
      'INSERT INTO chaines (id, num_chaine, chef_de_chaine_id, responsable_qlty_id, nbr_operateur) VALUES (?, ?, ?, ?, ?)',
      [id, num_chaine, chef_de_chaine_id || null, responsable_qlty_id || null, nbr_operateur || 0]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Create chain error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la chaîne' });
  }
});

app.put('/api/chains/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { num_chaine, chef_de_chaine_id, responsable_qlty_id, nbr_operateur } = req.body;

    await pool.execute(
      'UPDATE chaines SET num_chaine = ?, chef_de_chaine_id = ?, responsable_qlty_id = ?, nbr_operateur = ?, updated_at = NOW() WHERE id = ?',
      [num_chaine, chef_de_chaine_id || null, responsable_qlty_id || null, nbr_operateur || 0, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update chain error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la chaîne' });
  }
});

app.delete('/api/chains/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM chaines WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete chain error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la chaîne' });
  }
});

// Defects Routes
app.get('/api/defects/categories', authenticateToken, async (req, res) => {
  try {
    const [categories] = await pool.execute(
      'SELECT * FROM defaut_categories ORDER BY category_name'
    );
    res.json(categories);
  } catch (error) {
    console.error('Get defect categories error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
  }
});

app.get('/api/defects', authenticateToken, async (req, res) => {
  try {
    const [defects] = await pool.execute(
      `SELECT d.*, c.category_name, c.id as category_id
       FROM defaut_list d
       LEFT JOIN defaut_categories c ON d.category_id = c.id
       ORDER BY d.label`
    );
    
    // Format to match expected structure
    const formattedDefects = defects.map((defect) => ({
      id: defect.id,
      category_id: defect.category_id,
      label: defect.label,
      created_at: defect.created_at,
      category: defect.category_name ? {
        id: defect.category_id,
        category_name: defect.category_name
      } : null
    }));
    
    res.json(formattedDefects);
  } catch (error) {
    console.error('Get defects error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des défauts' });
  }
});

app.post('/api/defects/categories', authenticateToken, async (req, res) => {
  try {
    const { category_name, description } = req.body;
    const id = uuidv4();

    await pool.execute(
      'INSERT INTO defaut_categories (id, category_name, description) VALUES (?, ?, ?)',
      [id, category_name, description || null]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Create defect category error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la catégorie' });
  }
});

app.post('/api/defects', authenticateToken, async (req, res) => {
  try {
    const { label, category_id, description } = req.body;
    const id = uuidv4();

    await pool.execute(
      'INSERT INTO defaut_list (id, label, category_id, description) VALUES (?, ?, ?, ?)',
      [id, label, category_id, description || null]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Create defect error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du défaut' });
  }
});

app.put('/api/defects/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name, description } = req.body;

    await pool.execute(
      'UPDATE defaut_categories SET category_name = ?, description = ?, updated_at = NOW() WHERE id = ?',
      [category_name, description || null, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update defect category error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la catégorie' });
  }
});

app.put('/api/defects/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { label, category_id, description } = req.body;

    await pool.execute(
      'UPDATE defaut_list SET label = ?, category_id = ?, description = ?, updated_at = NOW() WHERE id = ?',
      [label, category_id, description || null, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update defect error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du défaut' });
  }
});

app.delete('/api/defects/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM defaut_categories WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete defect category error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie' });
  }
});

app.delete('/api/defects/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM defaut_list WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete defect error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du défaut' });
  }
});

// Quality / Conformity details (Déclaration défaut)
app.get('/api/quality/conformity-totals', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT OFID, SUM(qty_nc) AS total_nc FROM conformity_details GROUP BY OFID'
    );
    const map = {};
    rows.forEach((r) => { map[r.OFID] = r.total_nc || 0; });
    res.json(map);
  } catch (error) {
    console.error('Get conformity totals error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des totaux' });
  }
});

app.get('/api/quality/conformity', authenticateToken, async (req, res) => {
  try {
    const OFID = req.query.OFID;
    if (!OFID || typeof OFID !== 'string') {
      return res.status(400).json({ error: 'OFID requis (query: ?OFID=...)' });
    }
    const [rows] = await pool.execute(
      `SELECT cd.*, dc.category_name AS anomaly_label, dl.label AS defect_label
       FROM conformity_details cd
       LEFT JOIN defaut_categories dc ON cd.category_id = dc.id
       LEFT JOIN defaut_list dl ON cd.defect_id = dl.id
       WHERE cd.OFID = ?
       ORDER BY cd.created_at DESC`,
      [OFID.trim()]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get conformity by OFID error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails conformité' });
  }
});

app.post('/api/quality/conformity', authenticateToken, async (req, res) => {
  try {
    const { OFID, fab_order_id, details, comment: headerComment, total_nc } = req.body;
    const createdBy = req.user?.email || req.user?.id || null;

    if (!OFID || !Array.isArray(details) || details.length === 0) {
      return res.status(400).json({ error: 'OFID et au moins un détail requis' });
    }

    const ofidNormalized = String(OFID).trim();
    for (const d of details) {
      const id = uuidv4();
      const category_id = d.category_id || d.anomaly_id;
      if (!category_id) {
        return res.status(400).json({ error: 'Catégorie défaut (category_id) requise pour chaque ligne' });
      }
      const qty_nc = Math.max(0, parseInt(d.qty_nc, 10) || 0);
      const type_product = ['PF', 'Tester', 'Set'].includes(d.type_product) ? d.type_product : 'PF';
      const resp_defaut = ['Main d\'oeuvre', 'Machine', 'Fournisseur'].includes(d.resp_defaut) ? d.resp_defaut : 'Main d\'oeuvre';

      await pool.execute(
        `INSERT INTO conformity_details (id, OFID, fab_order_id, category_id, defect_id, component_name, qty_nc, type_product, resp_defaut, total_nc, comment, responsable, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          id,
          ofidNormalized,
          fab_order_id || null,
          category_id,
          d.defect_id || null,
          d.component_name || null,
          qty_nc,
          type_product,
          resp_defaut,
          d.total_nc ?? total_nc ?? null,
          d.comment ?? headerComment ?? null,
          createdBy
        ]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Create conformity error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la déclaration défaut' });
  }
});

app.put('/api/quality/conformity/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, defect_id, component_name, qty_nc, type_product, resp_defaut, total_nc, comment } = req.body;

    const [existing] = await pool.execute('SELECT id FROM conformity_details WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Détail conformité non trouvé' });
    }

    const qtyVal = qty_nc !== undefined ? Math.max(0, parseInt(qty_nc, 10) || 0) : undefined;
    const typeVal = type_product && ['PF', 'Tester', 'Set'].includes(type_product) ? type_product : undefined;
    const respVal = resp_defaut && ['Main d\'oeuvre', 'Machine', 'Fournisseur'].includes(resp_defaut) ? resp_defaut : undefined;

    await pool.execute(
      `UPDATE conformity_details SET
        category_id = COALESCE(?, category_id),
        defect_id = ?,
        component_name = ?,
        qty_nc = COALESCE(?, qty_nc),
        type_product = COALESCE(?, type_product),
        resp_defaut = COALESCE(?, resp_defaut),
        total_nc = ?,
        comment = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        category_id ?? null,
        defect_id || null,
        component_name ?? null,
        qtyVal ?? null,
        typeVal ?? null,
        respVal ?? null,
        total_nc ?? null,
        comment ?? null,
        id
      ]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Update conformity error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du détail' });
  }
});

app.delete('/api/quality/conformity/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.execute('SELECT id FROM conformity_details WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Détail conformité non trouvé' });
    }
    await pool.execute('DELETE FROM conformity_details WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete conformity error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// Charts: anomalies summary by date range
app.get('/api/quality/charts/anomalies', authenticateToken, async (req, res) => {
  try {
    const start = req.query.start;
    const end = req.query.end;
    let sql = `SELECT dc.id, dc.category_name AS label, SUM(cd.qty_nc) AS total
       FROM conformity_details cd
       JOIN defaut_categories dc ON cd.category_id = dc.id
       WHERE 1=1`;
    const params = [];
    if (start && typeof start === 'string') {
      sql += ' AND cd.created_at >= ?';
      params.push(start);
    }
    if (end && typeof end === 'string') {
      sql += ' AND cd.created_at <= ?';
      params.push(end);
    }
    sql += ' GROUP BY dc.id, dc.category_name ORDER BY total DESC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Charts anomalies error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des données' });
  }
});

// Charts: conformity over time (daily totals)
app.get('/api/quality/charts/conformity', authenticateToken, async (req, res) => {
  try {
    const start = req.query.start;
    const end = req.query.end;
    let sql = `SELECT DATE(cd.created_at) AS date, SUM(cd.qty_nc) AS total_nc, COUNT(DISTINCT cd.OFID) AS of_count
       FROM conformity_details cd
       WHERE 1=1`;
    const params = [];
    if (start && typeof start === 'string') {
      sql += ' AND cd.created_at >= ?';
      params.push(start);
    }
    if (end && typeof end === 'string') {
      sql += ' AND cd.created_at <= ?';
      params.push(end);
    }
    sql += ' GROUP BY DATE(cd.created_at) ORDER BY date ASC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Charts conformity error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des données' });
  }
});

// Roles Routes (admin or role with /admin/roles permission)
app.get('/api/roles', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/roles');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const [roles] = await pool.execute(
      'SELECT * FROM custom_roles ORDER BY is_system DESC, label'
    );
    res.json(roles);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des rôles' });
  }
});

app.post('/api/roles', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/roles');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { name, label, description } = req.body;
    const id = uuidv4();

    await pool.execute(
      'INSERT INTO custom_roles (id, name, label, description, is_system) VALUES (?, ?, ?, ?, ?)',
      [id, name, label, description || null, false]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du rôle' });
  }
});

app.put('/api/roles/:id', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/roles');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { id } = req.params;
    const { label, description } = req.body;

    await pool.execute(
      'UPDATE custom_roles SET label = ?, description = ?, updated_at = NOW() WHERE id = ?',
      [label, description || null, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du rôle' });
  }
});

app.delete('/api/roles/:id', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/roles');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { id } = req.params;
    await pool.execute('DELETE FROM custom_roles WHERE id = ? AND is_system = 0', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du rôle' });
  }
});

// Permissions Routes (admin or role with /admin/permissions permission)
app.get('/api/permissions', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/permissions');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const [permissions] = await pool.execute(
      'SELECT * FROM role_permissions ORDER BY role, menu_path'
    );
    res.json(permissions);
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des permissions' });
  }
});

app.post('/api/permissions', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/permissions');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const { role, menu_path, can_access } = req.body;
    const id = uuidv4();

    await pool.execute(
      'INSERT INTO role_permissions (id, role, menu_path, can_access) VALUES (?, ?, ?, ?)',
      [id, role, menu_path, can_access ? 1 : 0]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Create permission error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la permission' });
  }
});

app.put('/api/permissions/:id', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/permissions');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const { id } = req.params;
    const { can_access } = req.body;

    await pool.execute(
      'UPDATE role_permissions SET can_access = ? WHERE id = ?',
      [can_access ? 1 : 0, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update permission error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la permission' });
  }
});

app.put('/api/permissions/role/:role', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/permissions');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { role } = req.params;
    const { permissions } = req.body; // Array of { menu_path, can_access }

    // Delete existing permissions for this role
    await pool.execute('DELETE FROM role_permissions WHERE role = ?', [role]);

    // Insert new permissions
    if (permissions && permissions.length > 0) {
      const values = permissions.map((p) => [uuidv4(), role, p.menu_path, p.can_access ? 1 : 0]);
      const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
      const flatValues = values.flat();
      
      await pool.execute(
        `INSERT INTO role_permissions (id, role, menu_path, can_access) VALUES ${placeholders}`,
        flatValues
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Bulk update permissions error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des permissions' });
  }
});

// Fab Orders Routes (simplified - add more as needed)
// Get fabrication history by OFID (must be before /api/fab-orders/declaration - more specific path)
app.get('/api/fab-orders/declaration/fabrication-history', authenticateToken, async (req, res) => {
  try {
    const OFID = req.query.OFID;
    if (!OFID || typeof OFID !== 'string') {
      return res.status(400).json({ error: 'OFID requis (query: ?OFID=...)' });
    }
    const [rows] = await pool.execute(
      `SELECT f.id, f.OFID, f.Lot_Jus, f.Valid_date, f.effectif_Reel, f.date_fabrication, f.End_Fab_date,
       f.Pf_Qty, f.Sf_Qty, f.Set_qty, f.Tester_qty, f.Comment_chaine, f.created_by, f.created_at,
       COALESCE(p.full_name, f.created_by) AS created_by_name
       FROM fabrication f
       LEFT JOIN profiles p ON (p.email = f.created_by OR p.id = f.created_by)
       WHERE f.OFID = ?
       ORDER BY f.created_at DESC`,
      [OFID.trim()]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get fabrication by OFID error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
});

// Get fab orders for declaration page (with joins)
app.get('/api/fab-orders/declaration', authenticateToken, async (req, res) => {
  try {
    const [orders] = await pool.execute(
      `SELECT 
        fo.id,
        fo.of_id,
        fo.product_id,
        fo.prod_ref,
        fo.order_prod,
        fo.chaine_id,
        fo.statut_of,
        fo.sale_order_id,
        fo.lot_set,
        fo.pf_qty,
        fo.tester_qty,
        fo.set_qty,
        cmd.date_planifiee,
        COALESCE(cl.name, fo.client_id) as client_name,
        COALESCE(p.product_name, fo.prod_name) as product_name,
        c.num_chaine
       FROM fab_orders fo
       LEFT JOIN commandes cmd ON fo.sale_order_id = cmd.num_commande
       LEFT JOIN clients cl ON fo.client_id = cl.id
       LEFT JOIN products p ON fo.product_id = p.id
       LEFT JOIN chaines c ON fo.chaine_id = c.id
       ORDER BY cmd.date_planifiee DESC, fo.of_id DESC`
    );
    
    res.json(orders);
  } catch (error) {
    console.error('Get fab orders declaration error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des données' });
  }
});

// Rapport de Fabrication – one row per OF: planned vs declared quantities, duration, statut
app.get('/api/workshop/report', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        fo.id,
        fo.of_id,
        fo.sale_order_id,
        fo.statut_of,
        fo.pf_qty,
        fo.set_qty,
        fo.tester_qty,
        COALESCE(cl.name, fo.client_id) AS client_name,
        COALESCE(p.product_name, fo.prod_name) AS product_name,
        COALESCE(fab.fabrication_Pf_Qty, 0) AS fabrication_Pf_Qty,
        COALESCE(fab.fabrication_Set_qty, 0) AS fabrication_Set_qty,
        COALESCE(fab.fabrication_Tester_qty, 0) AS fabrication_Tester_qty,
        COALESCE(fab.total_minutes, 0) AS total_minutes
       FROM fab_orders fo
       LEFT JOIN clients cl ON fo.client_id = cl.id
       LEFT JOIN products p ON fo.product_id = p.id
       LEFT JOIN (
         SELECT
           f.OFID,
           SUM(f.Pf_Qty) AS fabrication_Pf_Qty,
           SUM(f.Set_qty) AS fabrication_Set_qty,
           SUM(f.Tester_qty) AS fabrication_Tester_qty,
           SUM(CASE
             WHEN f.date_fabrication IS NOT NULL AND f.End_Fab_date IS NOT NULL AND f.End_Fab_date > f.date_fabrication
             THEN TIMESTAMPDIFF(MINUTE, f.date_fabrication, f.End_Fab_date)
             ELSE 0
           END) AS total_minutes
         FROM fabrication f
         GROUP BY f.OFID
       ) fab ON fab.OFID = fo.of_id
       ORDER BY fo.of_id DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Get workshop report error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du rapport de fabrication' });
  }
});

// Clôturer un OF (Rapport de Fabrication)
app.post('/api/workshop/report/updateToCloture/:OFID', authenticateToken, async (req, res) => {
  try {
    const OFID = req.params.OFID;
    if (!OFID || typeof OFID !== 'string') {
      return res.status(400).json({ success: false, message: 'OFID requis' });
    }
    const ofidNorm = OFID.trim();
    const [result] = await pool.execute(
      'UPDATE fab_orders SET statut_of = ? WHERE of_id = ?',
      ['Cloturé', ofidNorm]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ordre de fabrication non trouvé' });
    }
    res.json({ success: true, message: 'OF clôturé avec succès' });
  } catch (error) {
    console.error('Update to cloture error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la clôture de l\'OF' });
  }
});

// Traçabilité fabrication – list all fabrication records with order/client (product name from order only)
app.get('/api/workshop/traceability', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        f.id,
        f.OFID,
        f.Lot_Jus,
        f.Valid_date,
        f.effectif_Reel,
        f.date_fabrication,
        f.End_Fab_date,
        f.Pf_Qty,
        f.Sf_Qty,
        f.Set_qty,
        f.Tester_qty,
        f.Comment_chaine,
        fo.sale_order_id,
        fo.prod_name AS product_name,
        COALESCE(cl.name, fo.client_id) AS client_name
       FROM fabrication f
       INNER JOIN fab_orders fo ON fo.of_id = f.OFID
       LEFT JOIN clients cl ON fo.client_id = cl.id
       ORDER BY f.date_fabrication DESC, f.id DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Get workshop traceability error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la traçabilité' });
  }
});

// Suivi Journalier – list all fabrication records with fab_order/client/product/chaine for daily follow-up
app.get('/api/workshop/daily', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        f.id,
        f.OFID,
        f.date_fabrication,
        f.End_Fab_date,
        f.Pf_Qty,
        f.Sf_Qty,
        f.Set_qty,
        f.Tester_qty,
        f.Comment_chaine,
        fo.chaine_id,
        fo.sale_order_id,
        fo.of_id,
        COALESCE(cl.name, fo.client_id) AS client_name,
        COALESCE(p.product_name, fo.prod_name) AS product_name,
        c.num_chaine,
        COALESCE(chef.full_name, chef.email, '') AS chef_name
       FROM fabrication f
       INNER JOIN fab_orders fo ON fo.of_id = f.OFID
       LEFT JOIN clients cl ON fo.client_id = cl.id
       LEFT JOIN products p ON fo.product_id = p.id
       LEFT JOIN chaines c ON fo.chaine_id = c.id
       LEFT JOIN profiles chef ON c.chef_de_chaine_id = chef.id
       ORDER BY f.date_fabrication DESC, f.End_Fab_date DESC, f.id DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Get workshop daily error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du suivi journalier' });
  }
});

// Fabrication (declaration) – GET by OFID must be registered before any /api/:param route
app.get('/api/fabrication', authenticateToken, async (req, res) => {
  try {
    const OFID = req.query.OFID;
    if (!OFID || typeof OFID !== 'string') {
      return res.status(400).json({ error: 'OFID requis (query: ?OFID=...)' });
    }
    const [rows] = await pool.execute(
      `SELECT f.id, f.OFID, f.Lot_Jus, f.Valid_date, f.effectif_Reel, f.date_fabrication, f.End_Fab_date,
       f.Pf_Qty, f.Sf_Qty, f.Set_qty, f.Tester_qty, f.Comment_chaine, f.created_by, f.created_at,
       COALESCE(p.full_name, f.created_by) AS created_by_name
       FROM fabrication f
       LEFT JOIN profiles p ON (p.email = f.created_by OR p.id = f.created_by)
       WHERE f.OFID = ?
       ORDER BY f.created_at DESC`,
      [OFID.trim()]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get fabrication by OFID error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
});

app.post('/api/fabrication', authenticateToken, async (req, res) => {
  try {
    const {
      OFID, Lot_Jus, Valid_date, effectif_Reel, date_fabrication, End_Fab_date,
      Pf_Qty, Sf_Qty, Set_qty, Tester_qty, Comment_chaine
    } = req.body;
    const createdBy = req.user?.email || req.user?.id || null;

    if (!OFID) {
      return res.status(400).json({ error: 'OFID requis' });
    }

    const ofidNormalized = String(OFID).trim();

    await pool.execute(
      `INSERT INTO fabrication (
        OFID, Lot_Jus, Valid_date, effectif_Reel, date_fabrication, End_Fab_date,
        Pf_Qty, Sf_Qty, Set_qty, Tester_qty, Comment_chaine, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        ofidNormalized,
        Lot_Jus || null,
        Valid_date || null,
        effectif_Reel ?? null,
        date_fabrication || null,
        End_Fab_date || null,
        Pf_Qty ?? 0,
        Sf_Qty ?? 0,
        Set_qty ?? 0,
        Tester_qty ?? 0,
        Comment_chaine || null,
        createdBy
      ]
    );

    // When a fabrication record exists for an OFID, production has started → set fab_order status to "En cours"
    const [updateResult] = await pool.execute(
      `UPDATE fab_orders SET statut_of = 'En cours' WHERE of_id = ?`,
      [ofidNormalized]
    );
    if (updateResult?.affectedRows === 0) {
      console.warn(`[fabrication] No fab_order found with of_id="${ofidNormalized}" – statut_of not updated`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Create fabrication error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la déclaration', details: error.message });
  }
});

app.put('/api/fabrication/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      Lot_Jus, Valid_date, effectif_Reel, date_fabrication, End_Fab_date,
      Pf_Qty, Sf_Qty, Set_qty, Tester_qty, Comment_chaine
    } = req.body;
    const updatedBy = req.user?.email || req.user?.id || null;

    const [existing] = await pool.execute(
      'SELECT id FROM fabrication WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }

    await pool.execute(
      `UPDATE fabrication SET
        Lot_Jus = ?, Valid_date = ?, effectif_Reel = ?, date_fabrication = ?, End_Fab_date = ?,
        Pf_Qty = ?, Sf_Qty = ?, Set_qty = ?, Tester_qty = ?, Comment_chaine = ?,
        updated_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        Lot_Jus ?? null,
        Valid_date || null,
        effectif_Reel ?? null,
        date_fabrication || null,
        End_Fab_date || null,
        Pf_Qty ?? 0,
        Sf_Qty ?? 0,
        Set_qty ?? 0,
        Tester_qty ?? 0,
        Comment_chaine ?? null,
        updatedBy,
        id
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update fabrication error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la déclaration', details: error.message });
  }
});

app.delete('/api/fabrication/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute(
      'SELECT id FROM fabrication WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }

    await pool.execute('DELETE FROM fabrication WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete fabrication error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la déclaration', details: error.message });
  }
});

app.get('/api/fab-orders', authenticateToken, async (req, res) => {
  try {
    const [orders] = await pool.execute(
      `SELECT fo.*, c.num_chaine, c.responsable_qlty_id,
       COALESCE(rq.full_name, rq.email) as responsable_qlty_name
       FROM fab_orders fo
       LEFT JOIN chaines c ON fo.chaine_id = c.id
       LEFT JOIN profiles rq ON c.responsable_qlty_id = rq.id
       ORDER BY fo.creation_date_of DESC`
    );
    
    // Format to match expected structure
    const formattedOrders = orders.map((order) => ({
      ...order,
      chaines: order.num_chaine ? {
        id: order.chaine_id,
        num_chaine: order.num_chaine,
        responsable_qlty_name: order.responsable_qlty_name || null
      } : null
    }));
    
    res.json(formattedOrders);
  } catch (error) {
    console.error('Get fab orders error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
});

app.get('/api/fab-orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [orders] = await pool.execute(
      `SELECT fo.*, c.num_chaine, cl.name as client_name, p.product_name
       FROM fab_orders fo
       LEFT JOIN chaines c ON fo.chaine_id = c.id
       LEFT JOIN clients cl ON fo.client_id = cl.id
       LEFT JOIN products p ON fo.product_id = p.id
       WHERE fo.id = ?`,
      [id]
    );
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    
    const order = orders[0];
    const formattedOrder = {
      ...order,
      chaines: order.num_chaine ? {
        id: order.chaine_id,
        num_chaine: order.num_chaine
      } : null
    };
    
    res.json(formattedOrder);
  } catch (error) {
    console.error('Get fab order error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
  }
});

app.post('/api/fab-orders', authenticateToken, async (req, res) => {
  try {
    const {
      of_id, product_id, prod_ref, prod_name, chaine_id, sale_order_id, client_id,
      date_fabrication, pf_qty, sf_qty, set_qty, tester_qty, lot_set,
      instruction, comment, statut_of
    } = req.body;
    const id = uuidv4();

    await pool.execute(
      `INSERT INTO fab_orders (
        id, of_id, product_id, prod_ref, prod_name, chaine_id, sale_order_id, client_id,
        date_fabrication, pf_qty, sf_qty, set_qty, tester_qty, lot_set,
        instruction, comment, statut_of
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, of_id, product_id || null, prod_ref || null, prod_name || null, chaine_id, sale_order_id, client_id,
        date_fabrication || null, pf_qty || 0, sf_qty || 0, set_qty || 0, tester_qty || 0, lot_set || '',
        instruction || null, comment || null, statut_of || 'Planifié'
      ]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Create fab order error:', error);
    console.error('Error details:', error.message, error.code);
    res.status(500).json({ error: 'Erreur lors de la création de la commande', details: error.message });
  }
});

const VALID_STATUT_OF = ['Planifié', 'En cours', 'Réalisé', 'Cloturé', 'Suspendu'];

function safeStr(v) {
  if (v == null || v === '') return null;
  return typeof v === 'object' ? (v.id != null ? String(v.id) : null) : String(v);
}

app.put('/api/fab-orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Build dynamic UPDATE query based on provided fields
    const fields = [];
    const values = [];

    if (updateData.of_id !== undefined) {
      fields.push('of_id = ?');
      values.push(safeStr(updateData.of_id) ?? updateData.of_id);
    }
    if (updateData.prod_ref !== undefined) {
      fields.push('prod_ref = ?');
      values.push(safeStr(updateData.prod_ref));
    }
    if (updateData.prod_name !== undefined) {
      fields.push('prod_name = ?');
      values.push(safeStr(updateData.prod_name));
    }
    if (updateData.product_id !== undefined) {
      fields.push('product_id = ?');
      values.push(safeStr(updateData.product_id));
    }
    if (updateData.chaine_id !== undefined) {
      const chaineId = safeStr(updateData.chaine_id) ?? updateData.chaine_id;
      if (!chaineId) {
        return res.status(400).json({ error: 'Chaîne requise' });
      }
      const [chaines] = await pool.execute('SELECT id FROM chaines WHERE id = ?', [chaineId]);
      if (chaines.length === 0) {
        return res.status(400).json({ error: 'Chaîne invalide' });
      }
      fields.push('chaine_id = ?');
      values.push(chaineId);
    }
    if (updateData.sale_order_id !== undefined) {
      fields.push('sale_order_id = ?');
      values.push(safeStr(updateData.sale_order_id) ?? updateData.sale_order_id);
    }
    if (updateData.client_id !== undefined) {
      fields.push('client_id = ?');
      values.push(safeStr(updateData.client_id) ?? updateData.client_id);
    }
    if (updateData.date_fabrication !== undefined) {
      fields.push('date_fabrication = ?');
      values.push(toMySQLDateTime(updateData.date_fabrication));
    }
    if (updateData.pf_qty !== undefined) {
      fields.push('pf_qty = ?');
      values.push(parseInt(updateData.pf_qty, 10) || 0);
    }
    if (updateData.sf_qty !== undefined) {
      fields.push('sf_qty = ?');
      values.push(parseInt(updateData.sf_qty, 10) || 0);
    }
    if (updateData.set_qty !== undefined) {
      fields.push('set_qty = ?');
      values.push(parseInt(updateData.set_qty, 10) || 0);
    }
    if (updateData.tester_qty !== undefined) {
      fields.push('tester_qty = ?');
      values.push(parseInt(updateData.tester_qty, 10) || 0);
    }
    if (updateData.lot_set !== undefined) {
      fields.push('lot_set = ?');
      values.push(safeStr(updateData.lot_set) ?? '');
    }
    if (updateData.instruction !== undefined) {
      fields.push('instruction = ?');
      values.push(updateData.instruction === '' ? null : (updateData.instruction || null));
    }
    if (updateData.comment !== undefined) {
      fields.push('comment = ?');
      values.push(updateData.comment === '' ? null : (updateData.comment || null));
    }
    if (updateData.statut_of !== undefined) {
      const statut = VALID_STATUT_OF.includes(updateData.statut_of) ? updateData.statut_of : 'Planifié';
      fields.push('statut_of = ?');
      values.push(statut);
    }
    if (updateData.order_prod !== undefined) {
      fields.push('order_prod = ?');
      values.push(safeStr(updateData.order_prod));
    }

    // Always update updated_at
    fields.push('updated_at = NOW()');

    if (fields.length <= 1) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    // Add id for WHERE clause
    values.push(id);

    const query = `UPDATE fab_orders SET ${fields.join(', ')} WHERE id = ?`;
    
    const [result] = await pool.execute(query, values);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ordre de fabrication non trouvé' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update fab order error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: 'Référence invalide (clé étrangère)' });
    }
    if (error.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || error.code === 'ER_INVALID_CHARACTER_STRING') {
      return res.status(400).json({ error: 'Valeur invalide pour un champ', details: error.message });
    }

    res.status(500).json({
      error: 'Erreur lors de la mise à jour de la commande',
      details: error.message,
      code: error.code
    });
  }
});

app.delete('/api/fab-orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM fab_orders WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete fab order error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la commande' });
  }
});

// Backups Routes (admin or role with /admin/backups permission)
app.post('/api/backups/export', authenticateToken, async (req, res) => {
  try {
    const allowed = await hasMenuPermission(pool, req.user.id, '/admin/backups');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { tables } = req.body;
    const tablesToExport = tables || ['profiles', 'user_roles', 'custom_roles', 'role_permissions'];
    
    let sqlOutput = `-- Database Export\n-- Generated: ${new Date().toISOString()}\n\n`;
    
    for (const tableName of tablesToExport) {
      const [rows] = await pool.execute(`SELECT * FROM ${tableName}`);
      
      if (rows.length > 0) {
        sqlOutput += `-- Table: ${tableName}\n`;
        sqlOutput += `DELETE FROM ${tableName};\n`;
        
        for (const row of rows) {
          const columns = Object.keys(row).join(', ');
          const values = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
            return v;
          }).join(', ');
          sqlOutput += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
        }
        sqlOutput += '\n';
      }
    }
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(sqlOutput);
  } catch (error) {
    console.error('Export database error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export de la base de données' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Audit Log Middleware ────────────────────────────────────────────────────
// Intercepts all mutating HTTP methods and writes a row to audit_logs after the
// route handler finishes (only on success and for authenticated requests).
app.use((req, res, next) => {
  const method = req.method;
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();

  // Skip auth and health routes
  const url = req.originalUrl || req.url;
  if (url.startsWith('/api/auth') || url === '/api/health') return next();

  const originalJson = res.json.bind(res);
  res.json = function (data) {
    if (res.statusCode < 400 && req.user) {
      const action =
        method === 'POST'   ? 'CREATE' :
        method === 'DELETE' ? 'DELETE' : 'UPDATE';

      // Extract a readable table name from the URL path
      const pathParts = url.replace('/api/', '').split('/').filter(Boolean);
      const tableName = pathParts[0] || 'unknown';

      // Record ID: prefer URL param, then response body id
      const recordId =
        req.params?.id ||
        (data && (data.id || data.insertId)) ||
        null;

      pool.execute(
        `INSERT INTO audit_logs (user_id, user_email, action, table_name, record_id, new_data, ip_address, endpoint)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user?.id   || null,
          req.user?.email || null,
          action,
          tableName,
          recordId ? String(recordId) : null,
          req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : null,
          req.ip || req.socket?.remoteAddress || null,
          url,
        ]
      ).catch(err => console.error('[AuditLog] DB error:', err));
    }
    return originalJson(data);
  };
  next();
});

// ─── Audit Log Routes ────────────────────────────────────────────────────────
// GET /api/audit-logs  — fetch with optional filters + pagination
app.get('/api/audit-logs', authenticateToken, async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 50,
      action,
      table_name,
      user_id,
      search,
      date_from,
      date_to,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params     = [];

    if (action)     { conditions.push('action = ?');          params.push(action); }
    if (table_name) { conditions.push('table_name = ?');      params.push(table_name); }
    if (user_id)    { conditions.push('user_id = ?');         params.push(user_id); }
    if (search)     { conditions.push('user_email LIKE ?');   params.push(`%${search}%`); }
    if (date_from)  { conditions.push('created_at >= ?');     params.push(date_from); }
    if (date_to)    { conditions.push('created_at <= ?');     params.push(date_to + ' 23:59:59'); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.execute(
      `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM audit_logs ${where}`,
      params
    );

    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('GET /api/audit-logs error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des logs' });
  }
});

// GET /api/audit-logs/tables — distinct table names for filter dropdown
app.get('/api/audit-logs/tables', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT DISTINCT table_name FROM audit_logs ORDER BY table_name'
    );
    res.json(rows.map(r => r.table_name));
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// Transfert Fabrication (Atelier <-> Magasin)
registerTransfertFabricationRoutes(app, pool, authenticateToken);
registerComponentChangeRoutes(app, pool, authenticateToken);
registerWasteHorsProdRoutes(app, pool, authenticateToken);
registerUnifiedRebutReportRoutes(app, pool, authenticateToken);
registerLaboratoireRoutes(app, pool, authenticateToken);
registerPackingRoutes(app, pool, authenticateToken);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Fabrication: GET/POST /api/fabrication, PUT/DELETE /api/fab-orders/declaration/fabrication/:id');
});
