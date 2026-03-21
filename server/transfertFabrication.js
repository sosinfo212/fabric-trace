/**
 * Transfert Fabrication API: movements between Atelier and Magasin.
 * Uses mysql2 pool. Menu paths: /transfer/movements, /transfer/report.
 */

import XLSX from 'xlsx';

/** Get current user's full_name and role from DB */
async function getCurrentUserInfo(pool, userId) {
  const [[profile], [roleRow]] = await Promise.all([
    pool.execute('SELECT full_name FROM profiles WHERE id = ?', [userId]),
    pool.execute('SELECT role FROM user_roles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]),
  ]);
  const fullName = profile?.full_name ?? null;
  const role = roleRow?.[0]?.role ?? null;
  return { fullName, role };
}

/** Map DB row to API shape (camelCase) */
function rowToTransfert(row) {
  if (!row) return null;
  return {
    id: row.id,
    numComm: row.Num_comm,
    client: row.client,
    product: row.product,
    prodRef: row.prod_ref,
    qtyBox: row.Qty_Box,
    unitPerbox: row.unit_perbox,
    qtyUnit: row.qty_unit,
    totalQty: row.total_qty,
    numPal: row.Num_pal,
    mouvement: row.mouvement,
    statut: row.statut,
    comment: row.comment,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Start of today and tomorrow (server time) for MySQL */
function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start.toISOString().slice(0, 19).replace('T', ' '), end.toISOString().slice(0, 19).replace('T', ' ')];
}

/** Check menu access for transfer module */
async function canAccessTransfer(pool, userId) {
  const [movements, report] = await Promise.all([
    pool.execute('SELECT 1 FROM role_permissions WHERE role = (SELECT role FROM user_roles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1) AND menu_path = ? AND can_access = 1', [userId, '/transfer/movements']),
    pool.execute('SELECT 1 FROM role_permissions WHERE role = (SELECT role FROM user_roles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1) AND menu_path = ? AND can_access = 1', [userId, '/transfer/report']),
  ]);
  const hasMovements = movements[0].length > 0;
  const hasReport = report[0].length > 0;
  const [adminRow] = await pool.execute('SELECT 1 FROM user_roles WHERE user_id = ? AND role = ?', [userId, 'admin']);
  const isAdmin = adminRow.length > 0;
  return { canMovements: isAdmin || hasMovements, canReport: isAdmin || hasReport };
}

function registerTransfertFabricationRoutes(app, pool, authenticateToken) {
  // ---------- GET /api/transfert-fabrication/today ----------
  app.get('/api/transfert-fabrication/today', authenticateToken, async (req, res) => {
    try {
      const [start, end] = getTodayRange();
      const [rows] = await pool.execute(
        `SELECT * FROM transfert_fabrication WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC`,
        [start, end]
      );
      res.json({ data: rows.map(rowToTransfert) });
    } catch (err) {
      console.error('Transfert today error:', err);
      res.status(500).json({ error: 'Erreur lors de la récupération des transferts du jour.' });
    }
  });

  // ---------- GET /api/transfert-fabrication/status-check ----------
  app.get('/api/transfert-fabrication/status-check', authenticateToken, async (req, res) => {
    try {
      const [start, end] = getTodayRange();
      const [rows] = await pool.execute(
        `SELECT id, statut FROM transfert_fabrication WHERE created_at >= ? AND created_at < ?`,
        [start, end]
      );
      res.json({ data: rows.map((r) => ({ id: r.id, statut: r.statut })) });
    } catch (err) {
      console.error('Status check error:', err);
      res.status(500).json({ error: 'Erreur status-check.' });
    }
  });

  // ---------- GET /api/transfert-fabrication/sale-orders ----------
  // Load from commandes.num_commande; client = clients.designation via commandes.client_id
  app.get('/api/transfert-fabrication/sale-orders', authenticateToken, async (req, res) => {
    try {
      const search = (req.query.search || '').trim();
      let sql = `
        SELECT c.num_commande AS id,
               MAX(COALESCE(NULLIF(TRIM(cl.designation), ''), cl.name)) AS designation
        FROM commandes c
        LEFT JOIN clients cl ON cl.id = c.client_id
        WHERE c.num_commande IS NOT NULL AND TRIM(c.num_commande) != ''
      `;
      const params = [];
      if (search) {
        sql += ` AND c.num_commande LIKE ?`;
        params.push(`%${search}%`);
      }
      sql += ` GROUP BY c.num_commande ORDER BY c.num_commande LIMIT 50`;
      const [rows] = await pool.execute(sql, params);
      const data = rows.map((r) => {
        const designation = r.designation ?? null;
        const text = designation ? `${r.id} — ${designation}` : r.id;
        return { id: r.id, text, designation };
      });
      res.json({ data });
    } catch (err) {
      console.error('Sale orders error:', err);
      res.status(500).json({ error: 'Erreur lors de la récupération des commandes.' });
    }
  });

  // ---------- GET /api/transfert-fabrication/products ----------
  app.get('/api/transfert-fabrication/products', authenticateToken, async (req, res) => {
    try {
      const search = (req.query.search || '').trim();
      let sql = `SELECT id, product_name, ref_id FROM products WHERE product_name IS NOT NULL AND TRIM(product_name) != ''`;
      const params = [];
      if (search) {
        sql += ` AND (product_name LIKE ? OR ref_id LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }
      sql += ` ORDER BY product_name LIMIT 100`;
      const [rows] = await pool.execute(sql, params);
      res.json({
        data: rows.map((r) => ({
          id: r.product_name,
          text: r.ref_id ? `${r.product_name} [${r.ref_id}]` : r.product_name,
          refId: r.ref_id,
        })),
      });
    } catch (err) {
      console.error('Products error:', err);
      res.status(500).json({ error: 'Erreur lors de la récupération des produits.' });
    }
  });

  // ---------- POST /api/transfert-fabrication (create) ----------
  app.post('/api/transfert-fabrication', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const { fullName, role } = await getCurrentUserInfo(pool, userId);
      const userName = fullName || req.user.email || userId;

      const body = req.body || {};
      const numComm = (body.numComm ?? body.Num_comm ?? '').toString().trim();
      const client = (body.client ?? '').toString().trim();
      const product = (body.product ?? '').toString().trim();
      const prodRef = (body.prodRef ?? body.prod_ref ?? null) != null ? String(body.prodRef ?? body.prod_ref).trim() || null : null;
      const qtyBox = Math.max(0, parseInt(body.qtyBox ?? body.Qty_Box, 10) || 0);
      const unitPerbox = body.unitPerbox != null || body.unit_perbox != null ? parseInt(body.unitPerbox ?? body.unit_perbox, 10) : null;
      const qtyUnit = Math.max(0, parseInt(body.qtyUnit ?? body.qty_unit, 10) || 0);
      const totalQty = body.totalQty != null || body.total_qty != null ? parseInt(body.totalQty ?? body.total_qty, 10) : (qtyBox * (unitPerbox || 0) + qtyUnit);
      const numPal = Math.max(1, parseInt(body.numPal ?? body.Num_pal, 10) || 1);
      const mouvement = (body.mouvement ?? 'A->M').toString().trim();
      const statut = (body.statut ?? 'Envoyé').toString().trim();
      const comment = (body.comment ?? '').toString().trim() || null;

      if (!numComm || !client || !product) {
        return res.status(422).json({ error: 'N° Commande, Client et Produit sont requis.' });
      }

      if (role === 'agent_logistique' && mouvement !== 'A->M') {
        return res.status(422).json({ error: 'Les agents logistique ne peuvent créer que des transferts A->M.' });
      }
      if (role === 'agent_magasin' && mouvement !== 'M->A') {
        return res.status(422).json({ error: 'Les agents magasin ne peuvent créer que des transferts M->A.' });
      }

      const [start] = getTodayRange();
      const thirtySecAgo = new Date(Date.now() - 30000).toISOString().slice(0, 19).replace('T', ' ');
      const [dup] = await pool.execute(
        `SELECT id FROM transfert_fabrication WHERE Num_comm = ? AND client = ? AND product = ? AND (prod_ref = ? OR (prod_ref IS NULL AND ? IS NULL)) AND Num_pal = ? AND mouvement = ? AND created_by = ? AND created_at >= ? LIMIT 1`,
        [numComm, client, product, prodRef, prodRef, numPal, mouvement, userName, thirtySecAgo]
      );
      if (dup.length > 0) {
        return res.status(409).json({ error: 'Un transfert identique a déjà été créé dans les 30 dernières secondes.', duplicateId: dup[0].id });
      }

      await pool.execute(
        `INSERT INTO transfert_fabrication (Num_comm, client, product, prod_ref, Qty_Box, unit_perbox, qty_unit, total_qty, Num_pal, mouvement, statut, comment, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [numComm, client, product, prodRef, qtyBox, unitPerbox, qtyUnit, totalQty, numPal, mouvement, statut, comment, userName, userName]
      );
      const [[inserted]] = await pool.execute('SELECT * FROM transfert_fabrication ORDER BY id DESC LIMIT 1');
      res.status(201).json({ data: rowToTransfert(inserted) });
    } catch (err) {
      console.error('Create transfert error:', err);
      res.status(500).json({ error: 'Erreur lors de la création du transfert.' });
    }
  });

  // ---------- GET /api/transfert-fabrication/list (all for report) ----------
  app.get('/api/transfert-fabrication/list', authenticateToken, async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT * FROM transfert_fabrication ORDER BY created_at DESC');
      res.json({ data: rows.map(rowToTransfert) });
    } catch (err) {
      console.error('List transferts error:', err);
      res.status(500).json({ error: 'Erreur lors de la récupération des transferts.' });
    }
  });

  // ---------- POST /api/transfert-fabrication/process-excel (must be before :id) ----------
  app.post('/api/transfert-fabrication/process-excel', authenticateToken, async (req, res) => {
    try {
      const filters = req.body || {};
      const dateFilter = filters.dateFilter ? String(filters.dateFilter).trim() : null;
      const globalSearch = (filters.globalSearch || '').toString().trim().toLowerCase();
      const movementFilters = Array.isArray(filters.movementFilters) ? filters.movementFilters : [];
      const statusFilters = Array.isArray(filters.statusFilters) ? filters.statusFilters : [];

      let sql = 'SELECT * FROM transfert_fabrication WHERE 1=1';
      const params = [];
      if (dateFilter) {
        sql += ' AND DATE(created_at) = ?';
        params.push(dateFilter);
      }
      const [rows] = await pool.execute(sql, params);
      let list = rows.map(rowToTransfert);

      if (globalSearch) {
        list = list.filter(
          (t) =>
            (t.client && t.client.toLowerCase().includes(globalSearch)) ||
            (t.product && t.product.toLowerCase().includes(globalSearch)) ||
            (t.numComm && t.numComm.toLowerCase().includes(globalSearch)) ||
            (t.comment && t.comment.toLowerCase().includes(globalSearch))
        );
      }
      if (movementFilters.length > 0) {
        list = list.filter((t) => movementFilters.includes(t.mouvement));
      }
      if (statusFilters.length > 0) {
        list = list.filter((t) => statusFilters.includes(t.statut));
      }

      const key = (t) => `${t.client}|${t.product}|${t.numComm}|${t.mouvement}`;
      const groups = new Map();
      for (const t of list) {
        const k = key(t);
        if (!groups.has(k)) {
          groups.set(k, {
            Commande: t.numComm,
            Client: t.client,
            Produit: t.prodRef ? `[${t.prodRef}] ${t.product}` : t.product,
            Mouvement: t.mouvement,
            Changement: '',
            'Quantité Boîtes': 0,
            'Unité/Boîte': 0,
            'Quantité Unités': 0,
            'Total Quantité': 0,
            Date: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
            _first: t,
          });
        }
        const g = groups.get(k);
        g['Quantité Boîtes'] += t.qtyBox || 0;
        g['Unité/Boîte'] += t.unitPerbox || 0;
        g['Quantité Unités'] += t.qtyUnit || 0;
        g['Total Quantité'] += (t.totalQty ?? t.qtyBox * (t.unitPerbox || 0) + t.qtyUnit) || 0;
      }

      const data = Array.from(groups.values()).map(({ _first, ...rest }) => ({
        ...rest,
        Date: _first.createdAt ? new Date(_first.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
      }));
      data.sort((a, b) => {
        if (a.Client !== b.Client) return a.Client.localeCompare(b.Client);
        if (a.Produit !== b.Produit) return a.Produit.localeCompare(b.Produit);
        if (a.Commande !== b.Commande) return a.Commande.localeCompare(b.Commande);
        return (a.Mouvement || '').localeCompare(b.Mouvement || '');
      });

      const dates = list.map((t) => t.createdAt).filter(Boolean);
      const minDate = dates.length ? new Date(Math.min(...dates.map((d) => new Date(d).getTime()))).toISOString().slice(0, 10) : null;
      const maxDate = dates.length ? new Date(Math.max(...dates.map((d) => new Date(d).getTime()))).toISOString().slice(0, 10) : null;

      res.json({
        success: true,
        data,
        totalGroups: data.length,
        originalRecords: list.length,
        dateFilter: dateFilter || null,
        dateRange: minDate && maxDate ? { minDate, maxDate } : null,
      });
    } catch (err) {
      console.error('Process excel error:', err);
      res.status(500).json({ error: 'Erreur lors du traitement des données.' });
    }
  });

  // ---------- GET /api/transfert-fabrication/export-excel (must be before :id) ----------
  app.get('/api/transfert-fabrication/export-excel', authenticateToken, async (req, res) => {
    try {
      const dateFilter = (req.query.dateFilter || '').trim() || null;
      const globalSearch = (req.query.globalSearch || '').trim().toLowerCase();
      const movementFilters = (req.query.movementFilters || '').split(',').filter(Boolean);
      const statusFilters = (req.query.statusFilters || '').split(',').filter(Boolean);

      let sql = 'SELECT * FROM transfert_fabrication WHERE 1=1';
      const params = [];
      if (dateFilter) {
        sql += ' AND DATE(created_at) = ?';
        params.push(dateFilter);
      }
      const [rows] = await pool.execute(sql, params);
      let list = rows.map(rowToTransfert);
      if (globalSearch) {
        list = list.filter(
          (t) =>
            (t.client && t.client.toLowerCase().includes(globalSearch)) ||
            (t.product && t.product.toLowerCase().includes(globalSearch)) ||
            (t.numComm && t.numComm.toLowerCase().includes(globalSearch)) ||
            (t.comment && t.comment.toLowerCase().includes(globalSearch))
        );
      }
      if (movementFilters.length > 0) list = list.filter((t) => movementFilters.includes(t.mouvement));
      if (statusFilters.length > 0) list = list.filter((t) => statusFilters.includes(t.statut));

      const key = (t) => `${t.client}|${t.product}|${t.numComm}|${t.mouvement}`;
      const groups = new Map();
      for (const t of list) {
        const k = key(t);
        if (!groups.has(k)) {
          groups.set(k, {
            Commande: t.numComm,
            Client: t.client,
            Produit: t.prodRef ? `[${t.prodRef}] ${t.product}` : t.product,
            Mouvement: t.mouvement,
            Changement: '',
            'Quantité Boîtes': 0,
            'Unité/Boîte': 0,
            'Quantité Unités': 0,
            'Total Quantité': 0,
            Date: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
          });
        }
        const g = groups.get(k);
        g['Quantité Boîtes'] += t.qtyBox || 0;
        g['Unité/Boîte'] += t.unitPerbox || 0;
        g['Quantité Unités'] += t.qtyUnit || 0;
        g['Total Quantité'] += (t.totalQty ?? t.qtyBox * (t.unitPerbox || 0) + t.qtyUnit) || 0;
      }
      const data = Array.from(groups.values());
      data.sort((a, b) => {
        if (a.Client !== b.Client) return a.Client.localeCompare(b.Client);
        if (a.Produit !== b.Produit) return a.Produit.localeCompare(b.Produit);
        if (a.Commande !== b.Commande) return a.Commande.localeCompare(b.Commande);
        return (a.Mouvement || '').localeCompare(b.Mouvement || '');
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Rapport groupé');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `rapport_fabrication_grouped_${Date.now()}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buf);
    } catch (err) {
      console.error('Export excel error:', err);
      res.status(500).json({ error: 'Erreur lors de l\'export Excel.' });
    }
  });

  // ---------- GET /api/transfert-fabrication/:id ----------
  app.get('/api/transfert-fabrication/:id', authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide.' });
      const [rows] = await pool.execute('SELECT * FROM transfert_fabrication WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Transfert introuvable.' });
      res.json(rowToTransfert(rows[0]));
    } catch (err) {
      console.error('Get transfert error:', err);
      res.status(500).json({ error: 'Erreur.' });
    }
  });

  // ---------- PUT /api/transfert-fabrication/:id ----------
  app.put('/api/transfert-fabrication/:id', authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide.' });
      const userId = req.user.id;
      const { fullName, role } = await getCurrentUserInfo(pool, userId);
      const userName = fullName || req.user.email || userId;

      const [rows] = await pool.execute('SELECT * FROM transfert_fabrication WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Transfert introuvable.' });
      const row = rows[0];

      const isPrivileged = role === 'admin' || role === 'responsable_magasin_pf';
      let canEditAll = isPrivileged;
      let canEditStatusOnly = false;
      if (!isPrivileged) {
        if (row.statut === 'Récéptionné') {
          canEditAll = false;
        } else if (row.statut === 'Envoyé') {
          canEditAll = row.created_by === userName;
          canEditStatusOnly = !canEditAll;
        } else {
          canEditAll = true;
        }
      }

      const body = req.body || {};
      if (canEditAll) {
        const numComm = (body.numComm ?? row.Num_comm ?? '').toString().trim();
        const client = (body.client ?? row.client ?? '').toString().trim();
        const product = (body.product ?? row.product ?? '').toString().trim();
        const prodRef = body.prodRef != null ? String(body.prodRef).trim() || null : row.prod_ref;
        const qtyBox = Math.max(0, parseInt(body.qtyBox ?? row.Qty_Box, 10) || 0);
        const unitPerbox = body.unitPerbox != null ? parseInt(body.unitPerbox, 10) : row.unit_perbox;
        const qtyUnit = Math.max(0, parseInt(body.qtyUnit ?? row.qty_unit, 10) || 0);
        const totalQty = body.totalQty != null ? parseInt(body.totalQty, 10) : (qtyBox * (unitPerbox || 0) + qtyUnit);
        const numPal = Math.max(1, parseInt(body.numPal ?? row.Num_pal, 10) || 1);
        const mouvement = (body.mouvement ?? row.mouvement).toString().trim();
        const statut = (body.statut ?? row.statut).toString().trim();
        const comment = body.comment != null ? String(body.comment).trim() || null : row.comment;

        await pool.execute(
          `UPDATE transfert_fabrication SET Num_comm=?, client=?, product=?, prod_ref=?, Qty_Box=?, unit_perbox=?, qty_unit=?, total_qty=?, Num_pal=?, mouvement=?, statut=?, comment=?, updated_by=? WHERE id=?`,
          [numComm, client, product, prodRef, qtyBox, unitPerbox, qtyUnit, totalQty, numPal, mouvement, statut, comment, userName, id]
        );
      } else if (canEditStatusOnly && body.statut != null) {
        const statut = String(body.statut).trim();
        await pool.execute('UPDATE transfert_fabrication SET statut=?, updated_by=? WHERE id=?', [statut, userName, id]);
      } else {
        return res.status(403).json({ error: 'Vous ne pouvez pas modifier ce transfert.' });
      }

      const [updated] = await pool.execute('SELECT * FROM transfert_fabrication WHERE id = ?', [id]);
      res.json(updated[0] ? rowToTransfert(updated[0]) : { id });
    } catch (err) {
      console.error('Update transfert error:', err);
      res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
    }
  });

  // ---------- DELETE /api/transfert-fabrication/:id ----------
  app.delete('/api/transfert-fabrication/:id', authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide.' });
      const userId = req.user.id;
      const { fullName } = await getCurrentUserInfo(pool, userId);
      const userName = fullName || req.user.email || userId;

      const [rows] = await pool.execute('SELECT created_by FROM transfert_fabrication WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Transfert introuvable.' });
      if (rows[0].created_by !== userName) {
        return res.status(403).json({ error: 'Seul le créateur peut supprimer ce transfert.' });
      }
      await pool.execute('DELETE FROM transfert_fabrication WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Delete transfert error:', err);
      res.status(500).json({ error: 'Erreur lors de la suppression.' });
    }
  });

  // ---------- PUT /api/transfert-fabrication/:id/validate ----------
  app.put('/api/transfert-fabrication/:id/validate', authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide.' });
      const userId = req.user.id;
      const { fullName } = await getCurrentUserInfo(pool, userId);
      const userName = fullName || req.user.email || userId;

      const [rows] = await pool.execute('SELECT statut FROM transfert_fabrication WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Transfert introuvable.' });
      if (rows[0].statut !== 'Envoyé') {
        return res.status(422).json({ error: 'Seul un transfert au statut Envoyé peut être réceptionné.' });
      }
      await pool.execute('UPDATE transfert_fabrication SET statut=?, updated_by=? WHERE id=?', ['Récéptionné', userName, id]);
      res.json({ success: true, data: { id, statut: 'Récéptionné' } });
    } catch (err) {
      console.error('Validate transfert error:', err);
      res.status(500).json({ error: 'Erreur lors de la validation.' });
    }
  });
}

export { registerTransfertFabricationRoutes };
