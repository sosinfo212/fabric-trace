/**
 * Component Changes API: track component swaps in fabrication orders.
 * Menu path: /component-changes
 */

/** Get current user full_name for validation status */
async function getCurrentUserName(pool, userId) {
  const [[row]] = await pool.execute('SELECT full_name FROM profiles WHERE id = ?', [userId]);
  return row?.full_name ?? 'Utilisateur';
}

/** Resolve component_code to component_name from product_components */
async function resolveComponentNames(pool, componentCodes) {
  if (!componentCodes.length) return {};
  const placeholders = componentCodes.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT DISTINCT component_code, component_name FROM product_components WHERE component_code IN (${placeholders}) AND component_code IS NOT NULL AND TRIM(component_code) != ''`,
    componentCodes
  );
  const map = {};
  (rows || []).forEach((r) => {
    if (r.component_code && !map[r.component_code]) map[r.component_code] = r.component_name || r.component_code;
  });
  return map;
}

function registerComponentChangeRoutes(app, pool, authenticateToken) {
  // ---------- GET /api/component-changes/components/list (must be before :id routes) ----------
  app.get('/api/component-changes/components/list', authenticateToken, async (req, res) => {
    try {
      const q = (req.query.q != null && req.query.q !== '') ? String(req.query.q).trim() : '';
      let sql = `
        SELECT DISTINCT pc.component_code AS componentCode, pc.component_name AS componentName
        FROM product_components pc
        WHERE pc.component_code IS NOT NULL AND TRIM(pc.component_code) != ''
          AND pc.component_name IS NOT NULL AND TRIM(pc.component_name) != ''
      `;
      const params = [];
      if (q) {
        sql += ' AND (pc.component_name LIKE ? OR pc.component_code LIKE ?)';
        params.push(`%${q}%`, `%${q}%`);
      }
      sql += ' ORDER BY pc.component_name ASC LIMIT 2000';
      const [rows] = await pool.execute(sql, params);
      res.json({ data: (rows || []).map((r) => ({ componentCode: r.componentCode, componentName: r.componentName ?? r.componentCode })) });
    } catch (err) {
      console.error('Component changes components list error:', err);
      res.status(500).json({ error: 'Erreur liste composants.', data: [] });
    }
  });

  // ---------- GET /api/component-changes ----------
  app.get('/api/component-changes', authenticateToken, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id, of_id, commande, nom_du_produit, original_product_id, new_product_id, qty, status, comment, created_at, updated_at FROM component_changes ORDER BY created_at DESC'
      );
      const codes = [...new Set((rows || []).flatMap((r) => [r.original_product_id, r.new_product_id]).filter(Boolean))];
      const nameMap = await resolveComponentNames(pool, codes);
      const data = (rows || []).map((r) => ({
        id: r.id,
        ofId: r.of_id,
        commande: r.commande,
        nomDuProduit: r.nom_du_produit,
        originalProductId: r.original_product_id,
        newProductId: r.new_product_id,
        qty: r.qty,
        status: r.status,
        comment: r.comment,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        originalComponentName: nameMap[r.original_product_id] ?? r.original_product_id,
        originalComponentCode: r.original_product_id,
        newComponentName: nameMap[r.new_product_id] ?? r.new_product_id,
        newComponentCode: r.new_product_id,
      }));
      res.json({ data });
    } catch (err) {
      console.error('Component changes list error:', err);
      res.status(500).json({ error: 'Erreur lors de la récupération des changements de composants.' });
    }
  });

  // ---------- POST /api/component-changes ----------
  app.post('/api/component-changes', authenticateToken, async (req, res) => {
    try {
      const { of_id, commande, nom_du_produit, original_product_id, new_product_id, qty, comment } = req.body || {};
      if (!of_id || !commande || !nom_du_produit || original_product_id == null || original_product_id === '' || new_product_id == null || new_product_id === '') {
        return res.status(400).json({ success: false, message: 'OF, commande, nom du produit, composant original et nouveau composant sont requis.' });
      }
      if (String(original_product_id).trim() === String(new_product_id).trim()) {
        return res.status(400).json({ success: false, message: 'Le nouveau composant doit être différent du composant original.' });
      }
      const [origExists] = await pool.execute('SELECT 1 FROM product_components WHERE component_code = ? LIMIT 1', [String(original_product_id).trim()]);
      const [newExists] = await pool.execute('SELECT 1 FROM product_components WHERE component_code = ? LIMIT 1', [String(new_product_id).trim()]);
      if (origExists.length === 0) return res.status(400).json({ success: false, message: 'Composant original introuvable.' });
      if (newExists.length === 0) return res.status(400).json({ success: false, message: 'Nouveau composant introuvable.' });

      const qtyNum = Number.parseInt(qty, 10);
      const qtyVal = Number.isFinite(qtyNum) && qtyNum >= 0 ? qtyNum : 0;
      await pool.execute(
        'INSERT INTO component_changes (of_id, commande, nom_du_produit, original_product_id, new_product_id, qty, comment) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [String(of_id).trim(), String(commande).trim(), String(nom_du_produit).trim(), String(original_product_id).trim(), String(new_product_id).trim(), qtyVal, comment && String(comment).trim() ? String(comment).trim() : null]
      );
      res.status(201).json({ success: true, message: 'Changement de composant enregistré.' });
    } catch (err) {
      console.error('Component change create error:', err);
      res.status(500).json({ success: false, message: 'Erreur lors de l\'enregistrement.' });
    }
  });

  // ---------- PUT /api/component-changes/:id ----------
  app.put('/api/component-changes/:id', authenticateToken, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });
      const { of_id, commande, nom_du_produit, original_product_id, new_product_id, qty, comment } = req.body || {};
      if (!of_id || !commande || !nom_du_produit || original_product_id == null || original_product_id === '' || new_product_id == null || new_product_id === '') {
        return res.status(400).json({ success: false, message: 'OF, commande, nom du produit, composant original et nouveau composant sont requis.' });
      }
      if (String(original_product_id).trim() === String(new_product_id).trim()) {
        return res.status(400).json({ success: false, message: 'Le nouveau composant doit être différent du composant original.' });
      }
      const [origExists] = await pool.execute('SELECT 1 FROM product_components WHERE component_code = ? LIMIT 1', [String(original_product_id).trim()]);
      const [newExists] = await pool.execute('SELECT 1 FROM product_components WHERE component_code = ? LIMIT 1', [String(new_product_id).trim()]);
      if (origExists.length === 0) return res.status(400).json({ success: false, message: 'Composant original introuvable.' });
      if (newExists.length === 0) return res.status(400).json({ success: false, message: 'Nouveau composant introuvable.' });

      const qtyNum = Number.parseInt(qty, 10);
      const qtyVal = Number.isFinite(qtyNum) && qtyNum >= 0 ? qtyNum : 0;
      const [result] = await pool.execute(
        'UPDATE component_changes SET of_id = ?, commande = ?, nom_du_produit = ?, original_product_id = ?, new_product_id = ?, qty = ?, comment = ? WHERE id = ?',
        [String(of_id).trim(), String(commande).trim(), String(nom_du_produit).trim(), String(original_product_id).trim(), String(new_product_id).trim(), qtyVal, comment && String(comment).trim() ? String(comment).trim() : null, id]
      );
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Changement introuvable.' });
      res.json({ success: true, message: 'Changement mis à jour.' });
    } catch (err) {
      console.error('Component change update error:', err);
      res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour.' });
    }
  });

  // ---------- DELETE /api/component-changes/:id ----------
  app.delete('/api/component-changes/:id', authenticateToken, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });
      const [result] = await pool.execute('DELETE FROM component_changes WHERE id = ?', [id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Changement introuvable.' });
      res.json({ success: true, message: 'Changement supprimé.' });
    } catch (err) {
      console.error('Component change delete error:', err);
      res.status(500).json({ success: false, message: 'Erreur lors de la suppression.' });
    }
  });

  // ---------- POST /api/component-changes/:id/validate ----------
  app.post('/api/component-changes/:id/validate', authenticateToken, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });
      const userName = await getCurrentUserName(pool, req.user.id);
      const now = new Date();
      const dateStr = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
      const status = `Validée par ${userName} ${dateStr}`;
      const [result] = await pool.execute('UPDATE component_changes SET status = ? WHERE id = ?', [status, id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Changement introuvable.' });
      res.json({ success: true, status });
    } catch (err) {
      console.error('Component change validate error:', err);
      res.status(500).json({ success: false, message: 'Erreur lors de la validation.' });
    }
  });

  // ---------- GET /api/component-changes/of/search?q= ----------
  app.get('/api/component-changes/of/search', authenticateToken, async (req, res) => {
    try {
      const q = (req.query.q && String(req.query.q).trim()) || '';
      let sql = 'SELECT of_id AS OFID, sale_order_id AS saleOrderId, prod_name AS prodName FROM fab_orders WHERE of_id IS NOT NULL AND TRIM(of_id) != ""';
      const params = [];
      if (q) {
        sql += ' AND of_id LIKE ?';
        params.push(`%${q}%`);
      }
      sql += ' ORDER BY of_id LIMIT 15';
      const [rows] = await pool.execute(sql, params);
      res.json({ data: (rows || []).map((r) => ({ OFID: r.OFID, saleOrderId: r.saleOrderId ?? '', prodName: r.prodName ?? '' })) });
    } catch (err) {
      console.error('Component changes OF search error:', err);
      res.status(500).json({ error: 'Erreur recherche OF.', data: [] });
    }
  });

  // ---------- GET /api/component-changes/of/list (all for combobox) ----------
  app.get('/api/component-changes/of/list', authenticateToken, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT of_id AS OFID, sale_order_id AS saleOrderId, prod_name AS prodName FROM fab_orders WHERE of_id IS NOT NULL AND TRIM(of_id) != "" ORDER BY of_id'
      );
      res.json({ data: (rows || []).map((r) => ({ OFID: r.OFID, saleOrderId: r.saleOrderId ?? '', prodName: r.prodName ?? '' })) });
    } catch (err) {
      console.error('Component changes OF list error:', err);
      res.status(500).json({ error: 'Erreur liste OF.', data: [] });
    }
  });

  // ---------- GET /api/component-changes/products/autocomplete ----------
  app.get('/api/component-changes/products/autocomplete', authenticateToken, async (req, res) => {
    try {
      const type = req.query.type === 'new' ? 'new' : 'original';
      const nomDuProduit = req.query.nom_du_produit != null ? String(req.query.nom_du_produit).trim() : '';
      const search = req.query.q != null ? String(req.query.q).trim() : '';
      let sql = `
        SELECT DISTINCT pc.component_code AS componentCode, pc.component_name AS componentName
        FROM product_components pc
        INNER JOIN products p ON p.id = pc.product_id
        WHERE pc.component_name IS NOT NULL AND TRIM(pc.component_name) != ''
          AND pc.component_code IS NOT NULL AND TRIM(pc.component_code) != ''
      `;
      const params = [];
      if (type === 'original' && nomDuProduit) {
        sql += ' AND p.product_name = ?';
        params.push(nomDuProduit);
      }
      if (search) {
        sql += ' AND (pc.component_name LIKE ? OR pc.component_code LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      sql += ' ORDER BY pc.component_name ASC LIMIT 50';
      const [rows] = await pool.execute(sql, params);
      res.json({ data: (rows || []).map((r) => ({ componentCode: r.componentCode, componentName: r.componentName ?? r.componentCode })) });
    } catch (err) {
      console.error('Component changes autocomplete error:', err);
      res.status(500).json({ error: 'Erreur autocomplete.', data: [] });
    }
  });
}

export { registerComponentChangeRoutes };
