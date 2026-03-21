function escapeCsvValue(value) {
  const v = value === null || value === undefined ? '' : String(value);
  const escaped = v.replace(/"/g, '""');
  // Always quote to be safe with commas/semicolons/newlines.
  return `"${escaped}"`;
}

function getCurrentUserName(pool, userId) {
  return (async () => {
    const [[row]] = await pool.execute('SELECT full_name FROM profiles WHERE id = ?', [userId]);
    return row?.full_name ?? 'Utilisateur';
  })();
}

function registerWasteHorsProdRoutes(app, pool, authenticateToken) {
  // Simple unauthenticated ping to confirm route wiring at runtime.
  app.get('/api/components/waste/ping', (req, res) => {
    res.json({ ok: true });
  });

  // ---------- LOOKUPS ----------
  app.get('/api/components/waste/products', authenticateToken, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT DISTINCT product_name AS productName FROM products WHERE product_name IS NOT NULL AND TRIM(product_name) != "" ORDER BY product_name ASC'
      );
      res.json({ data: (rows || []).map((r) => r.productName).filter(Boolean) });
    } catch (err) {
      console.error('Waste products lookup error:', err);
      res.status(500).json({ error: 'Erreur lors de la récupération des produits.', data: [] });
    }
  });

  app.get('/api/components/waste/get-components', authenticateToken, async (req, res) => {
    try {
      const productName = req.query.product_name != null ? String(req.query.product_name).trim() : '';
      if (!productName) return res.json({ data: [] });

      const [rows] = await pool.execute(
        `SELECT DISTINCT pc.component_name AS componentName
         FROM product_components pc
         INNER JOIN products p ON p.id = pc.product_id
         WHERE p.product_name = ?
           AND pc.component_name IS NOT NULL
           AND TRIM(pc.component_name) != ''
         ORDER BY pc.component_name ASC`,
        [productName]
      );
      res.json({
        data: (rows || [])
          .map((r) => r.componentName)
          .filter(Boolean),
      });
    } catch (err) {
      console.error('Waste components lookup error:', err);
      res.status(500).json({ error: 'Erreur lors de la récupération des composants.', data: [] });
    }
  });

  app.get('/api/components/waste/defauts', authenticateToken, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT DISTINCT label AS label FROM defaut_list WHERE label IS NOT NULL AND TRIM(label) != "" ORDER BY label ASC'
      );
      res.json({ data: (rows || []).map((r) => r.label).filter(Boolean) });
    } catch (err) {
      console.error('Waste defauts lookup error:', err);
      res.status(500).json({ error: 'Erreur lors de la récupération des défauts.', data: [] });
    }
  });

  // ---------- DATA ----------
  app.get('/api/components/waste/data', authenticateToken, async (req, res) => {
    try {
      const startDateRaw = req.query.startDate != null ? String(req.query.startDate).trim() : '';
      const endDateRaw = req.query.endDate != null ? String(req.query.endDate).trim() : '';
      const showValidatedRaw = req.query.showValidated != null ? String(req.query.showValidated).trim() : 'false';

      const includeValidated = showValidatedRaw === 'true' || showValidatedRaw === '1';

      const page = Number.parseInt(String(req.query.page ?? '1'), 10);
      const pageSize = Number.parseInt(String(req.query.pageSize ?? '50'), 10);
      const safePage = Number.isFinite(page) && page > 0 ? page : 1;
      const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 200) : 50;
      const offset = (safePage - 1) * safePageSize;

      const filters = [];
      const params = [];

      if (!includeValidated) {
        filters.push('status = ?');
        params.push(1);
      }

      if (startDateRaw) {
        // startDate: yyyy-MM-dd
        filters.push('created_at >= ?');
        params.push(`${startDateRaw} 00:00:00`);
      }
      if (endDateRaw) {
        filters.push('created_at <= ?');
        params.push(`${endDateRaw} 23:59:59`);
      }

      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total
         FROM rebut_hors_prod
         ${where}`,
        params
      );
      const total = countRows?.[0]?.total ?? 0;

      const [rows] = await pool.execute(
        `SELECT
            id,
            produit,
            composant,
            qty,
            defaut,
            comment,
            created_by AS createdBy,
            demandeur,
            status,
            updated_by AS updatedBy,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM rebut_hors_prod
          ${where}
          ORDER BY created_at DESC
          LIMIT ${safePageSize} OFFSET ${offset}`,
        params
      );

      res.json({
        data: (rows || []).map((r) => ({
          id: r.id,
          produit: r.produit,
          composant: r.composant,
          qty: r.qty,
          defaut: r.defaut,
          comment: r.comment,
          createdBy: r.createdBy,
          demandeur: r.demandeur,
          status: !!r.status,
          updatedBy: r.updatedBy,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        recordsTotal: total,
        recordsFiltered: total,
        page: safePage,
        pageSize: safePageSize,
      });
    } catch (err) {
      console.error('Waste data error:', err);
      res.status(500).json({ error: 'Erreur lors de la récupération des rebuts.', data: [], recordsTotal: 0, recordsFiltered: 0 });
    }
  });

  app.get('/api/components/waste/:id', authenticateToken, async (req, res) => {
    try {
      const id = Number.parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID invalide.' });

      const [rows] = await pool.execute(
        `SELECT
            id,
            produit,
            composant,
            qty,
            defaut,
            comment,
            created_by AS createdBy,
            demandeur,
            status,
            updated_by AS updatedBy,
            created_at AS createdAt,
            updated_at AS updatedAt
         FROM rebut_hors_prod
         WHERE id = ?
         LIMIT 1`,
        [id]
      );
      const row = rows?.[0];
      if (!row) return res.status(404).json({ error: 'Rebut introuvable.' });

      res.json({
        id: row.id,
        produit: row.produit,
        composant: row.composant,
        qty: row.qty,
        defaut: row.defaut,
        comment: row.comment,
        createdBy: row.createdBy,
        demandeur: row.demandeur,
        status: !!row.status,
        updatedBy: row.updatedBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    } catch (err) {
      console.error('Waste get by id error:', err);
      res.status(500).json({ error: 'Erreur lors de la récupération.' });
    }
  });

  // ---------- CREATE ----------
  app.post('/api/components/waste', authenticateToken, async (req, res) => {
    try {
      const { produit, composant, qty, defaut, demandeur, commentaire, comment } = req.body || {};

      const produitStr = produit != null ? String(produit).trim() : '';
      const composantStr = composant != null ? String(composant).trim() : '';
      const defautStr = defaut != null ? String(defaut).trim() : '';
      const demandeurStr = demandeur != null ? String(demandeur).trim() : '';
      const commentStr = (commentaire ?? comment) != null ? String(commentaire ?? comment).trim() : '';

      const qtyNum = Number.parseInt(qty, 10);

      if (!produitStr || !composantStr || !demandeurStr || !defautStr || !Number.isFinite(qtyNum) || qtyNum < 1) {
        return res.status(400).json({ success: false, message: 'Produit, composant, quantité (>=1), défaut et demandeur sont requis.' });
      }

      // Validate product existence
      const [[prodRow]] = await pool.execute('SELECT 1 FROM products WHERE product_name = ? LIMIT 1', [produitStr]);
      if (!prodRow) return res.status(400).json({ success: false, message: 'Produit introuvable.' });

      // Validate component belongs to product
      const [[compRow]] = await pool.execute(
        `SELECT 1
         FROM product_components pc
         INNER JOIN products p ON p.id = pc.product_id
         WHERE p.product_name = ?
           AND pc.component_name = ?
         LIMIT 1`,
        [produitStr, composantStr]
      );
      if (!compRow) return res.status(400).json({ success: false, message: 'Composant introuvable pour ce produit.' });

      // Validate defect existence
      const [[defRow]] = await pool.execute('SELECT 1 FROM defaut_list WHERE label = ? LIMIT 1', [defautStr]);
      if (!defRow) return res.status(400).json({ success: false, message: 'Défaut introuvable.' });

      const userName = await getCurrentUserName(pool, req.user.id);

      const [result] = await pool.execute(
        `INSERT INTO rebut_hors_prod
          (produit, composant, qty, defaut, comment, created_by, demandeur, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [produitStr, composantStr, qtyNum, defautStr, commentStr || null, userName, demandeurStr]
      );

      res.status(201).json({ success: true, message: 'Rebut enregistré.', id: result.insertId });
    } catch (err) {
      console.error('Waste create error:', err);
      res.status(500).json({ success: false, message: 'Erreur lors de l’enregistrement.' });
    }
  });

  // ---------- UPDATE ----------
  app.put('/api/components/waste/:id', authenticateToken, async (req, res) => {
    try {
      const id = Number.parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });

      const existingQuery = await pool.execute('SELECT status FROM rebut_hors_prod WHERE id = ? LIMIT 1', [id]);
      const row = existingQuery?.[0]?.[0];
      if (!row) return res.status(404).json({ success: false, message: 'Rebut introuvable.' });
      if (!row.status) return res.status(403).json({ success: false, message: 'Cette entrée est verrouillée et ne peut pas être modifiée.' });

      const { produit, composant, qty, defaut, demandeur, commentaire, comment } = req.body || {};

      const produitStr = produit != null ? String(produit).trim() : '';
      const composantStr = composant != null ? String(composant).trim() : '';
      const defautStr = defaut != null ? String(defaut).trim() : '';
      const demandeurStr = demandeur != null ? String(demandeur).trim() : '';
      const commentStr = (commentaire ?? comment) != null ? String(commentaire ?? comment).trim() : '';
      const qtyNum = Number.parseInt(qty, 10);

      if (!produitStr || !composantStr || !demandeurStr || !defautStr || !Number.isFinite(qtyNum) || qtyNum < 1) {
        return res.status(400).json({ success: false, message: 'Champs invalides. Produit, composant, quantité (>=1), défaut et demandeur sont requis.' });
      }

      const userName = await getCurrentUserName(pool, req.user.id);

      await pool.execute(
        `UPDATE rebut_hors_prod
         SET produit = ?, composant = ?, qty = ?, defaut = ?, comment = ?, updated_by = ?, demandeur = ?, updated_at = NOW()
         WHERE id = ?`,
        [produitStr, composantStr, qtyNum, defautStr, commentStr || null, userName, demandeurStr, id]
      );

      res.json({ success: true, message: 'Rebut mis à jour.' });
    } catch (err) {
      console.error('Waste update error:', err);
      res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour.' });
    }
  });

  // ---------- DELETE ----------
  app.delete('/api/components/waste/:id', authenticateToken, async (req, res) => {
    try {
      const id = Number.parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });

      const existingQuery = await pool.execute('SELECT status FROM rebut_hors_prod WHERE id = ? LIMIT 1', [id]);
      const row = existingQuery?.[0]?.[0];
      if (!row) return res.status(404).json({ success: false, message: 'Rebut introuvable.' });
      if (!row.status) return res.status(403).json({ success: false, message: 'Cette entrée est verrouillée et ne peut pas être supprimée.' });

      await pool.execute('DELETE FROM rebut_hors_prod WHERE id = ?', [id]);
      res.json({ success: true, message: 'Rebut supprimé.' });
    } catch (err) {
      console.error('Waste delete error:', err);
      res.status(500).json({ success: false, message: 'Erreur lors de la suppression.' });
    }
  });

  // ---------- VALIDATE (lock) ----------
  app.post('/api/components/waste/:id/validate', authenticateToken, async (req, res) => {
    try {
      const id = Number.parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });

      const userName = await getCurrentUserName(pool, req.user.id);

      const [result] = await pool.execute(
        'UPDATE rebut_hors_prod SET status = 0, updated_by = ?, updated_at = NOW() WHERE id = ? AND status = 1',
        [userName, id]
      );

      if (result.affectedRows === 0) {
        return res.status(400).json({ success: false, message: 'Entrée déjà verrouillée ou introuvable.' });
      }

      res.json({ success: true, message: 'Entrée verrouillée.' });
    } catch (err) {
      console.error('Waste validate error:', err);
      res.status(500).json({ success: false, message: 'Erreur lors de la validation.' });
    }
  });

  // ---------- BULK VALIDATE ----------
  app.post('/api/components/waste/bulk-validate', authenticateToken, async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const parsedIds = ids.map((x) => Number.parseInt(String(x), 10)).filter((n) => Number.isFinite(n));

      if (parsedIds.length === 0) return res.status(400).json({ success: false, message: 'Aucun ID valide.' });

      const userName = await getCurrentUserName(pool, req.user.id);

      // Determine which ones are currently unlocked
      const placeholders = parsedIds.map(() => '?').join(',');
      const [rows] = await pool.execute(
        `SELECT id, status FROM rebut_hors_prod WHERE id IN (${placeholders})`,
        parsedIds
      );

      const unlockedIds = (rows || []).filter((r) => !!r.status).map((r) => r.id);
      const validated = unlockedIds.length;
      const alreadyLocked = parsedIds.length - validated;

      if (unlockedIds.length > 0) {
        const unlockedPlaceholders = unlockedIds.map(() => '?').join(',');
        await pool.execute(
          `UPDATE rebut_hors_prod
           SET status = 0, updated_by = ?, updated_at = NOW()
           WHERE id IN (${unlockedPlaceholders})`,
          [userName, ...unlockedIds]
        );
      }

      res.json({
        success: true,
        message: 'Validation en masse terminée.',
        validated,
        alreadyLocked,
      });
    } catch (err) {
      console.error('Waste bulk validate error:', err);
      res.status(500).json({ success: false, message: 'Erreur lors de la validation en masse.' });
    }
  });

  // ---------- EXPORT CSV ----------
  app.get('/api/components/waste/export', authenticateToken, async (req, res) => {
    try {
      const startDateRaw = req.query.startDate != null ? String(req.query.startDate).trim() : '';
      const endDateRaw = req.query.endDate != null ? String(req.query.endDate).trim() : '';
      const showValidatedRaw = req.query.showValidated != null ? String(req.query.showValidated).trim() : 'false';
      const statusFilterRaw = req.query.statusFilter != null ? String(req.query.statusFilter).trim().toLowerCase() : '';
      const includeValidated = showValidatedRaw === 'true' || showValidatedRaw === '1';

      const filters = [];
      const params = [];

      const hasExplicitStatusFilter = statusFilterRaw === 'unlocked' || statusFilterRaw === 'locked';
      if (hasExplicitStatusFilter) {
        filters.push('status = ?');
        params.push(statusFilterRaw === 'unlocked' ? 1 : 0);
      } else if (!includeValidated) {
        filters.push('status = ?');
        params.push(1);
      }
      if (startDateRaw) {
        filters.push('created_at >= ?');
        params.push(`${startDateRaw} 00:00:00`);
      }
      if (endDateRaw) {
        filters.push('created_at <= ?');
        params.push(`${endDateRaw} 23:59:59`);
      }

      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      const [rows] = await pool.execute(
        `SELECT
            id,
            produit,
            composant,
            qty,
            defaut,
            comment,
            demandeur,
            created_by AS createdBy,
            status,
            created_at AS createdAt
         FROM rebut_hors_prod
         ${where}
         ORDER BY created_at DESC`,
        params
      );

      const header = [
        'ID',
        'Produit',
        'Composant',
        'Quantité',
        'Défaut',
        'Demandeur',
        'Commentaire',
        'Créé par',
        'Statut',
        'Date de création',
      ];

      const csvLines = [];
      csvLines.push(header.map(escapeCsvValue).join(','));

      for (const r of rows || []) {
        const statusLabel = r.status ? 'Déverrouillé' : 'Verrouillé';
        const createdAt = r.createdAt ? String(r.createdAt) : '';
        csvLines.push(
          [
            r.id,
            r.produit,
            r.composant,
            r.qty,
            r.defaut,
            r.demandeur,
            r.comment,
            r.createdBy,
            statusLabel,
            createdAt,
          ].map(escapeCsvValue).join(',')
        );
      }

      const csv = csvLines.join('\n');
      const filename = `rebuts_hors_production_${Date.now()}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csv);
    } catch (err) {
      console.error('Waste export csv error:', err);
      res.status(500).json({ error: 'Erreur lors de l’export CSV.' });
    }
  });
}

export { registerWasteHorsProdRoutes };

