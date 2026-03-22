import * as XLSX from 'xlsx';

const WEIGHT_SET_ITEMS = {
  'BODY SPRAY 200ML': { weight: 170, price: 0.54 },
  'ROLL ON 50 ML': { weight: 155, price: 0.3 },
  'AFTER SHAVE 100ML (Glass/Cuba)': { weight: 240, price: 0.52 },
  'AFTER SHAVE 130ML': { weight: 138, price: 0.27 },
  'SHOWER GEL 200ML': { weight: 230, price: 0.4 },
  'SHOWER GEL 130ML': { weight: 136, price: 0.28 },
  'BODY LOTION 200ML': { weight: 230, price: 0.45 },
  'BODY LOTION 130ML': { weight: 132, price: 0.36 },
  'BODY SPRAY 150ML': { weight: 140, price: 0.4 },
};

const mapItem = (row) => ({
  id: Number(row.id),
  packingListId: Number(row.packing_list_id),
  palNo: row.pal_no ?? '',
  typePal: row.type_pal ?? '_',
  palKgs: row.pal_kgs == null ? null : Number(row.pal_kgs),
  status: row.status ?? 'planifie',
  statutPal: row.statut_pal ?? '_',
  designation: row.designation ?? '',
  quantity: Number(row.quantity ?? 0),
  boxes: Number(row.boxes ?? 0),
  pieces: Number(row.pieces ?? 0),
  order: Number(row.order ?? 0),
  batchNbr: row.batch_nbr ?? null,
  manufacturingDate: row.manufacturing_date ?? null,
  expiryDate: row.expiry_date ?? null,
});

const computePackingListStatus = (items) => {
  if (!items.length) return 'Planifié';
  const flags = items.map((item) => (item.statutPal || '_').toUpperCase());
  const allClosed = flags.every((f) => f === 'C');
  if (allClosed) return 'Réalisé';
  const someReception = flags.some((f) => f === 'C' || f === 'O');
  if (someReception) return 'En cours';
  return 'Planifié';
};

const sanitizeItems = (items = []) =>
  items.map((item, index) => {
    const boxes = Number(item.boxes ?? 0) || 0;
    const pieces = Number(item.pieces ?? 0) || 0;
    const quantity = boxes > 0 ? boxes * pieces : pieces;
    return {
      id: item.id ? Number(item.id) : undefined,
      palNo: String(item.pal_no ?? item.palNo ?? ''),
      typePal: String(item.type_pal ?? item.typePal ?? '_') || '_',
      palKgs: item.pal_kgs === '' || item.pal_kgs == null ? null : Number(item.pal_kgs),
      designation: String(item.designation ?? ''),
      quantity,
      boxes,
      pieces,
      order: Number(item.order ?? index),
      statutPal: String(item.statut_pal ?? item.statutPal ?? '_') || '_',
    };
  });

async function getPackingListById(pool, id) {
  const [headerRows] = await pool.execute(
    'SELECT * FROM packing_lists WHERE id = ? LIMIT 1',
    [id],
  );
  if (!headerRows.length) return null;

  const [itemsRows] = await pool.execute(
    'SELECT * FROM packing_list_items WHERE packing_list_id = ? ORDER BY `order` ASC, id ASC',
    [id],
  );
  const [weightRows] = await pool.execute(
    'SELECT * FROM weight_set_packing_list WHERE id_packing_list = ? ORDER BY id ASC',
    [id],
  );
  const [clientRows] = await pool.execute(
    'SELECT designation, instruction, instruction_logistique FROM clients WHERE designation = ? LIMIT 1',
    [headerRows[0].client],
  );

  return {
    id: Number(headerRows[0].id),
    container: headerRows[0].container,
    client: headerRows[0].client,
    proforma: headerRows[0].proforma,
    date: headerRows[0].date,
    status: headerRows[0].status ?? 'Planifié',
    notes: headerRows[0].notes ?? null,
    navalock: headerRows[0].navalock ?? null,
    volume: headerRows[0].volume ?? null,
    createdAt: headerRows[0].created_at,
    updatedAt: headerRows[0].updated_at,
    clientModel: clientRows[0] ?? null,
    items: itemsRows.map(mapItem),
    weightSets: weightRows.map((row) => ({
      id: Number(row.id),
      idPackingList: Number(row.id_packing_list),
      item: row.Item,
      qty: Number(row.Qty),
      totalWeight: Number(row.Total_weight),
      unitValue: Number(row.Unit_value),
      totalValue: Number(row.Total_Value),
    })),
  };
}

function workbookToBuffer(workbook) {
  const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return Buffer.from(arrayBuffer);
}

export function registerPackingRoutes(app, pool, authenticateToken) {
  app.get('/api/shipping/packing', authenticateToken, async (_req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT pl.*,
          (SELECT COUNT(*) FROM packing_list_items pli WHERE pli.packing_list_id = pl.id) AS items_count
         FROM packing_lists pl
         ORDER BY pl.created_at DESC`,
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Error loading packing lists:', error);
      res.status(500).json({ success: false, message: 'Erreur chargement packing lists' });
    }
  });

  app.post('/api/shipping/packing', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const { container, client, proforma, date, items = [] } = req.body;
      const sanitizedItems = sanitizeItems(items);
      if (!container || !client || !proforma || !date || sanitizedItems.length === 0) {
        return res.status(400).json({ success: false, message: 'Champs requis manquants' });
      }

      await connection.beginTransaction();
      const status = computePackingListStatus(sanitizedItems);
      const [headerResult] = await connection.execute(
        `INSERT INTO packing_lists (container, client, proforma, date, status)
         VALUES (?, ?, ?, ?, ?)`,
        [container, client, proforma, date, status],
      );
      const packingListId = headerResult.insertId;

      for (const [idx, item] of sanitizedItems.entries()) {
        await connection.execute(
          `INSERT INTO packing_list_items
           (packing_list_id, pal_no, type_pal, pal_kgs, statut_pal, designation, quantity, boxes, pieces, \`order\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            packingListId,
            item.palNo,
            item.typePal,
            item.palKgs,
            item.statutPal,
            item.designation,
            item.quantity,
            item.boxes,
            item.pieces,
            idx,
          ],
        );
      }

      await connection.commit();
      res.json({ success: true, message: 'Packing list créée', data: { id: packingListId } });
    } catch (error) {
      await connection.rollback();
      console.error('Error creating packing list:', error);
      res.status(500).json({ success: false, message: 'Erreur création packing list' });
    } finally {
      connection.release();
    }
  });

  app.get('/api/shipping/packing/search-products', authenticateToken, async (req, res) => {
    try {
      const query = String(req.query.q ?? '').trim();
      if (!query) {
        const [rows] = await pool.execute(
          `SELECT DISTINCT product_name
           FROM products
           WHERE product_name IS NOT NULL AND product_name <> ''
           ORDER BY product_name ASC
           LIMIT 2000`,
        );
        return res.json({ success: true, data: rows.map((r) => r.product_name) });
      }
      const [rows] = await pool.execute(
        `SELECT DISTINCT product_name
         FROM products
         WHERE product_name LIKE ?
         ORDER BY product_name ASC
         LIMIT 100`,
        [`%${query}%`],
      );
      res.json({ success: true, data: rows.map((r) => r.product_name) });
    } catch (error) {
      console.error('Error searching products:', error);
      res.status(500).json({ success: false, message: 'Erreur recherche produits' });
    }
  });

  app.get('/api/shipping/packing/designations', authenticateToken, async (req, res) => {
    try {
      const query = String(req.query.q ?? '').trim();
      if (!query || query.length < 2) {
        return res.json({ success: true, data: [] });
      }
      const [rows] = await pool.execute(
        `SELECT DISTINCT designation
         FROM clients
         WHERE designation IS NOT NULL
           AND designation LIKE ?
         ORDER BY designation ASC
         LIMIT 10`,
        [`%${query}%`],
      );
      res.json({ success: true, data: rows.map((r) => r.designation) });
    } catch (error) {
      console.error('Error searching clients:', error);
      res.status(500).json({ success: false, message: 'Erreur recherche clients' });
    }
  });

  app.get('/api/box-quantities/contained', authenticateToken, async (req, res) => {
    try {
      const name = String(req.query.name ?? '').trim();
      if (!name) return res.json({ success: true, data: { containedQuantity: 0 } });
      const [rows] = await pool.execute(
        `SELECT contained_quantity
         FROM box_quantities
         WHERE product_name = ?
         LIMIT 1`,
        [name],
      );
      const containedQuantity = rows.length ? Number(rows[0].contained_quantity ?? 0) : 0;
      res.json({ success: true, data: { containedQuantity } });
    } catch (error) {
      console.error('Error getting contained quantity:', error);
      res.status(500).json({ success: false, message: 'Erreur quantité contenue' });
    }
  });

  app.get('/api/shipping/packing/weight-set/item-data', authenticateToken, async (_req, res) => {
    res.json({ success: true, data: WEIGHT_SET_ITEMS });
  });

  /** Update header fields only (container, client, proforma, date, navalock, volume, notes) — does not touch line items. */
  const updatePackingHeader = async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, message: 'ID invalide' });
      }
      const {
        container,
        client,
        proforma,
        date,
        notes = null,
        navalock = null,
        volume = null,
      } = req.body;
      if (!container || !client || !proforma || !date) {
        return res.status(400).json({ success: false, message: 'Données invalides' });
      }
      const [existing] = await pool.execute('SELECT id FROM packing_lists WHERE id = ? LIMIT 1', [id]);
      if (!existing.length) {
        return res.status(404).json({ success: false, message: 'Packing list introuvable' });
      }
      await pool.execute(
        `UPDATE packing_lists
         SET container = ?, client = ?, proforma = ?, date = ?, notes = ?, navalock = ?, volume = ?
         WHERE id = ?`,
        [container, client, proforma, date, notes, navalock, volume, id],
      );
      res.json({ success: true, message: 'En-tête enregistré' });
    } catch (error) {
      console.error('Error updating packing list header:', error);
      res.status(500).json({ success: false, message: 'Erreur mise à jour en-tête' });
    }
  };
  app.patch('/api/shipping/packing/:id/header', authenticateToken, updatePackingHeader);
  app.put('/api/shipping/packing/:id/header', authenticateToken, updatePackingHeader);

  app.get('/api/shipping/packing/:id', authenticateToken, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const data = await getPackingListById(pool, id);
      if (!data) return res.status(404).json({ success: false, message: 'Packing list introuvable' });
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error loading packing list:', error);
      res.status(500).json({ success: false, message: 'Erreur chargement packing list' });
    }
  });

  app.put('/api/shipping/packing/:id', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const id = Number(req.params.id);
      const {
        container,
        client,
        proforma,
        date,
        notes = null,
        navalock = null,
        volume = null,
        deleted_items = [],
        items = [],
      } = req.body;
      const sanitizedItems = sanitizeItems(items);
      if (!container || !client || !proforma || !date || sanitizedItems.length === 0) {
        return res.status(400).json({ success: false, message: 'Données invalides' });
      }

      await connection.beginTransaction();
      for (const deletedId of deleted_items) {
        await connection.execute(
          'DELETE FROM packing_list_items WHERE id = ? AND packing_list_id = ?',
          [Number(deletedId), id],
        );
      }

      for (const [idx, item] of sanitizedItems.entries()) {
        if (item.id) {
          await connection.execute(
            `UPDATE packing_list_items
             SET pal_no = ?, type_pal = ?, pal_kgs = ?, statut_pal = ?, designation = ?,
                 quantity = ?, boxes = ?, pieces = ?, \`order\` = ?
             WHERE id = ? AND packing_list_id = ?`,
            [
              item.palNo,
              item.typePal,
              item.palKgs,
              item.statutPal,
              item.designation,
              item.quantity,
              item.boxes,
              item.pieces,
              idx,
              item.id,
              id,
            ],
          );
        } else {
          await connection.execute(
            `INSERT INTO packing_list_items
             (packing_list_id, pal_no, type_pal, pal_kgs, statut_pal, designation, quantity, boxes, pieces, \`order\`)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              item.palNo,
              item.typePal,
              item.palKgs,
              item.statutPal,
              item.designation,
              item.quantity,
              item.boxes,
              item.pieces,
              idx,
            ],
          );
        }
      }

      const status = computePackingListStatus(sanitizedItems);
      await connection.execute(
        `UPDATE packing_lists
         SET container = ?, client = ?, proforma = ?, date = ?, status = ?, notes = ?, navalock = ?, volume = ?
         WHERE id = ?`,
        [container, client, proforma, date, status, notes, navalock, volume, id],
      );

      await connection.commit();
      res.json({ success: true, message: 'Packing list mise à jour' });
    } catch (error) {
      await connection.rollback();
      console.error('Error updating packing list:', error);
      res.status(500).json({ success: false, message: 'Erreur mise à jour packing list' });
    } finally {
      connection.release();
    }
  });

  app.delete('/api/shipping/packing/:id', authenticateToken, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await pool.execute('DELETE FROM packing_lists WHERE id = ?', [id]);
      res.json({ success: true, message: 'Packing list supprimée' });
    } catch (error) {
      console.error('Error deleting packing list:', error);
      res.status(500).json({ success: false, message: 'Erreur suppression packing list' });
    }
  });

  app.post('/api/shipping/packing/:id/duplicate', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const id = Number(req.params.id);
      await connection.beginTransaction();
      const source = await getPackingListById(connection, id);
      if (!source) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Packing list introuvable' });
      }

      const [headerResult] = await connection.execute(
        `INSERT INTO packing_lists (container, client, proforma, date, status, notes, navalock, volume)
         VALUES (?, ?, ?, ?, 'Planifié', ?, ?, ?)`,
        [
          source.container,
          source.client,
          `${source.proforma} copie`,
          source.date,
          source.notes,
          source.navalock,
          source.volume,
        ],
      );
      const duplicatedId = headerResult.insertId;
      for (const [idx, item] of source.items.entries()) {
        await connection.execute(
          `INSERT INTO packing_list_items
           (packing_list_id, pal_no, type_pal, pal_kgs, statut_pal, designation, quantity, boxes, pieces, \`order\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            duplicatedId,
            item.palNo,
            item.typePal,
            item.palKgs,
            '_',
            item.designation,
            item.quantity,
            item.boxes,
            item.pieces,
            idx,
          ],
        );
      }
      await connection.commit();
      res.json({ success: true, message: 'Packing list dupliquée', duplicatedId });
    } catch (error) {
      await connection.rollback();
      console.error('Error duplicating packing list:', error);
      res.status(500).json({ success: false, message: 'Erreur duplication packing list' });
    } finally {
      connection.release();
    }
  });

  app.get('/api/shipping/packing/:id/items', authenticateToken, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [headerRows] = await pool.execute('SELECT proforma FROM packing_lists WHERE id = ? LIMIT 1', [id]);
      if (!headerRows.length) {
        return res.status(404).json({ success: false, message: 'Packing list introuvable' });
      }
      const [rows] = await pool.execute(
        `SELECT id, designation, batch_nbr, manufacturing_date, expiry_date
         FROM packing_list_items
         WHERE packing_list_id = ?
         ORDER BY \`order\` ASC, id ASC`,
        [id],
      );
      res.json({
        success: true,
        data: {
          proforma: headerRows[0].proforma,
          items: rows.map((row) => ({
            id: Number(row.id),
            designation: row.designation,
            batch_nbr: row.batch_nbr ?? '',
            manufacturing_date: row.manufacturing_date,
            expiry_date: row.expiry_date,
          })),
        },
      });
    } catch (error) {
      console.error('Error loading production items:', error);
      res.status(500).json({ success: false, message: 'Erreur chargement données production' });
    }
  });

  app.post('/api/shipping/packing/:id/production-data', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const packingListId = Number(req.params.id);
      const { items = [] } = req.body;
      await connection.beginTransaction();
      for (const item of items) {
        await connection.execute(
          `UPDATE packing_list_items
           SET batch_nbr = ?, manufacturing_date = ?, expiry_date = ?
           WHERE id = ? AND packing_list_id = ?`,
          [
            item.batch_nbr || null,
            item.manufacturing_date || null,
            item.expiry_date || null,
            Number(item.id),
            packingListId,
          ],
        );
      }
      await connection.commit();
      res.json({ success: true, message: 'Données de production mises à jour' });
    } catch (error) {
      await connection.rollback();
      console.error('Error updating production data:', error);
      res.status(500).json({ success: false, message: 'Erreur mise à jour données production' });
    } finally {
      connection.release();
    }
  });

  app.post('/api/shipping/packing/:id/weight-set', authenticateToken, async (req, res) => {
    try {
      const packingListId = Number(req.params.id);
      const payload = Array.isArray(req.body.weight_sets) ? req.body.weight_sets : [];
      if (!payload.length) {
        return res.status(400).json({ success: false, message: 'Aucun weight set fourni' });
      }
      for (const row of payload) {
        const item = String(row.Item ?? '');
        const qty = Number(row.Qty ?? 0);
        const meta = WEIGHT_SET_ITEMS[item];
        if (!meta || qty <= 0) continue;
        const totalWeight = (qty * meta.weight) / 1000;
        const totalValue = qty * meta.price;
        await pool.execute(
          `INSERT INTO weight_set_packing_list
           (id_packing_list, Item, Qty, Total_weight, Unit_value, Total_Value)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [packingListId, item, qty, totalWeight, meta.price, totalValue],
        );
      }
      res.json({ success: true, message: 'Weight sets enregistrés' });
    } catch (error) {
      console.error('Error saving weight sets:', error);
      res.status(500).json({ success: false, message: 'Erreur enregistrement weight sets' });
    }
  });

  app.delete('/api/shipping/packing/:id/weight-set', authenticateToken, async (req, res) => {
    try {
      const packingListId = Number(req.params.id);
      await pool.execute('DELETE FROM weight_set_packing_list WHERE id_packing_list = ?', [packingListId]);
      res.json({ success: true, message: 'Weight sets supprimés' });
    } catch (error) {
      console.error('Error clearing weight sets:', error);
      res.status(500).json({ success: false, message: 'Erreur suppression weight sets' });
    }
  });

  app.delete('/api/shipping/packing/:id/weight-set/:wsId', authenticateToken, async (req, res) => {
    try {
      const packingListId = Number(req.params.id);
      const wsId = Number(req.params.wsId);
      await pool.execute(
        'DELETE FROM weight_set_packing_list WHERE id = ? AND id_packing_list = ?',
        [wsId, packingListId],
      );
      res.json({ success: true, message: 'Weight set supprimé' });
    } catch (error) {
      console.error('Error deleting weight set:', error);
      res.status(500).json({ success: false, message: 'Erreur suppression weight set' });
    }
  });

  app.get('/api/shipping/packing/:id/export', authenticateToken, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const data = await getPackingListById(pool, id);
      if (!data) return res.status(404).json({ success: false, message: 'Packing list introuvable' });

      const rows = data.items.map((item) => ({
        'PAL N°': item.palNo === '0' ? 'Vrac' : item.palNo,
        'TYPE PAL': item.typePal,
        'PAL KGS': item.palKgs ?? '',
        DESIGNATION: item.designation,
        QUANTITY: item.quantity,
        BOXES: item.boxes,
        PIECES: item.pieces,
        'BATCH N°': item.batchNbr ?? '',
        'MANUFACTURING DATE': item.manufacturingDate ? new Date(item.manufacturingDate).toISOString().slice(0, 10) : '',
        'EXPIRY DATE': item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : '',
      }));
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, 'PackingList');
      const buffer = workbookToBuffer(workbook);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=packing-list-${id}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error('Error exporting full excel:', error);
      res.status(500).json({ success: false, message: 'Erreur export excel' });
    }
  });

  app.get('/api/shipping/packing/:id/export-simple', authenticateToken, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const data = await getPackingListById(pool, id);
      if (!data) return res.status(404).json({ success: false, message: 'Packing list introuvable' });

      const rows = data.items.map((item) => ({
        'PAL N°': item.palNo === '0' ? 'Vrac' : item.palNo,
        DESIGNATION: item.designation,
        QUANTITY: item.quantity,
        BOXES: item.boxes,
        PIECES: item.pieces,
      }));
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, 'PackingSimple');
      const buffer = workbookToBuffer(workbook);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=packing-list-${id}-simple.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error('Error exporting simple excel:', error);
      res.status(500).json({ success: false, message: 'Erreur export excel simplifié' });
    }
  });
}
