import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { packingApi } from '@/lib/api';

/** Header image for print/PDF (browser print). */
const PACKING_PRINT_HEADER_IMAGE = 'https://i.imgur.com/aAhVAkV.png';

/**
 * Print iframe HTML. Page numbers use @page margin boxes — the only context where
 * counter(page) / counter(pages) work in print (fixed + ::after shows 0/0 in Chromium).
 */
function buildPackingPrintIframeHtml(bodyInnerHtml: string): string {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join('');
  const styles = Array.from(document.querySelectorAll('style'))
    .map((el) => el.outerHTML)
    .join('');
  const printExtras = `<style>
    @page {
      size: A4;
      margin: 14mm 12mm 28mm 12mm;
      @bottom-center {
        content: "Page " counter(page) " / " counter(pages);
        font-size: 9pt;
        line-height: 1.2;
        color: #374151;
        font-family: system-ui, -apple-system, sans-serif;
        font-weight: 500;
      }
    }
    @media print {
      html, body { background: #fff !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title></title>${links}${styles}${printExtras}</head><body>${bodyInnerHtml}</body></html>`;
}

/**
 * Chromium-based browsers often ignore @page margin boxes for HTML print; fixed elements
 * cannot use counter(page) reliably (shows 0/0). We add a simple estimated page count instead.
 */
function injectChromiumPaginationFallback(doc: Document): void {
  const win = doc.defaultView;
  if (!win || doc.querySelector('.packing-print-pagination-fallback')) return;
  const isChromium =
    typeof (win as Window & { chrome?: unknown }).chrome !== 'undefined' &&
    /Google Inc|Chromium/.test(navigator.vendor);
  if (!isChromium) return;
  const h = doc.body?.scrollHeight ?? 0;
  const est = Math.max(1, Math.ceil(h / 900));
  const fb = doc.createElement('div');
  fb.className = 'packing-print-pagination-fallback';
  fb.setAttribute('aria-hidden', 'true');
  fb.textContent = `Environ ${est} page(s)`;
  fb.style.cssText =
    'position:fixed;left:0;right:0;bottom:6mm;text-align:center;font-size:9pt;color:#374151;font-family:system-ui,sans-serif;font-weight:500;z-index:9999;';
  doc.body.appendChild(fb);
}

function printIframeWhenImagesReady(iframe: HTMLIFrameElement): void {
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }
  let printed = false;
  const triggerPrint = (): void => {
    if (printed) return;
    printed = true;
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 600);
  };
  const run = (): void => {
    injectChromiumPaginationFallback(doc);
    const pending = Array.from(doc.images).filter((img) => !img.complete);
    if (pending.length === 0) {
      triggerPrint();
      return;
    }
    let left = pending.length;
    const done = (): void => {
      left -= 1;
      if (left <= 0) triggerPrint();
    };
    pending.forEach((img) => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  };
  setTimeout(run, 50);
}

export default function PackingPrintPage() {
  const { id } = useParams();
  const packingListId = Number(id);
  const { data, isLoading } = useQuery({
    queryKey: ['packing-print', packingListId],
    queryFn: () => packingApi.getOne(packingListId),
    enabled: Number.isFinite(packingListId),
  });

  const printRootRef = useRef<HTMLDivElement>(null);
  const initialTitleRef = useRef<string | null>(null);
  const printSnapshotRef = useRef<string>('');

  useEffect(() => {
    initialTitleRef.current = document.title;
    document.title = `Packing list #${packingListId}`;
    return () => {
      if (initialTitleRef.current !== null) document.title = initialTitleRef.current;
    };
  }, [packingListId]);

  /** If user prints the tab (Ctrl+P), clear document title so the browser header shows no title. */
  useEffect(() => {
    const onBeforePrint = (): void => {
      printSnapshotRef.current = document.title;
      document.title = '';
    };
    const onAfterPrint = (): void => {
      document.title = printSnapshotRef.current || `Packing list #${packingListId}`;
    };
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [packingListId]);

  const handlePrint = useCallback(() => {
    const root = printRootRef.current;
    if (!root) return;
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print').forEach((el) => el.remove());
    const html = buildPackingPrintIframeHtml(clone.innerHTML);
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Print');
    iframe.style.cssText =
      'position:fixed;width:0;height:0;border:0;left:0;top:0;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => printIframeWhenImagesReady(iframe), 0);
  }, []);

  if (isLoading || !data) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  const totalPieces = data.items.reduce((sum, it) => sum + it.quantity, 0);
  const totalBoxes = data.items.reduce((sum, it) => sum + it.boxes, 0);
  const totalPallets = new Set(data.items.filter((it) => it.palNo !== '0').map((it) => it.palNo)).size;
  const normalItems = data.items.filter((it) => it.palNo !== '0');
  const vracItems = data.items.filter((it) => it.palNo === '0');
  const grouped = normalItems.reduce<Record<string, typeof normalItems>>((acc, item) => {
    const key = item.palNo;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const orderedPalNos = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 bg-white p-5 text-black print:max-w-none print:p-0">
      <div ref={printRootRef} className="space-y-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 0.5in; }
          .packing-print-header {
            max-height: 140px;
            width: 100%;
            object-fit: contain;
            object-position: left top;
          }
        }
        .packing-print-header {
          max-height: 160px;
          width: 100%;
          object-fit: contain;
          object-position: left top;
        }
      `}</style>
      <div className="no-print flex justify-end">
        <Button type="button" onClick={handlePrint}>Imprimer</Button>
      </div>
      <div className="mb-4 print:mb-3">
        <img
          src={PACKING_PRINT_HEADER_IMAGE}
          alt=""
          className="packing-print-header block"
        />
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-gray-500">PACKING LIST</h1>
        <div className="text-right text-sm">
          <div><strong>Client:</strong> {data.client}</div>
          <div><strong>Date:</strong> {new Date(data.date).toLocaleDateString('fr-FR')}</div>
          <div><strong>Container:</strong> {data.container}</div>
          <div><strong>Proforma:</strong> {data.proforma}</div>
        </div>
      </div>
      <h2 className="text-center text-lg font-bold">PACKING LIST AVANT CHARGEMENT</h2>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {['PAL N°', 'PAL KGS', 'DESIGNATION', 'QUANTITY', 'BOXES', 'PIECES'].map((h) => (
              <th key={h} className="border border-black bg-gray-200 p-1">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orderedPalNos.map((palNo) =>
            grouped[palNo].map((it, idx) => (
              <tr key={it.id}>
                {idx === 0 ? (
                  <td rowSpan={grouped[palNo].length} className="border border-black p-1 text-center align-middle">
                    {palNo}
                  </td>
                ) : null}
                <td className="border border-black p-1 text-center">{it.palKgs ?? ''}</td>
                <td className="border border-black p-1">{it.designation}</td>
                <td className="border border-black p-1 text-center">{it.quantity}</td>
                <td className="border border-black p-1 text-center">{it.boxes}</td>
                <td className="border border-black p-1 text-center">{it.pieces}</td>
              </tr>
            )),
          )}
          {vracItems.length ? (
            <>
              <tr>
                <td colSpan={6} className="border border-black bg-gray-100 p-1 text-center font-semibold">
                  Vrac
                </td>
              </tr>
              {vracItems.map((it) => (
                <tr key={it.id}>
                  <td className="border border-black p-1 text-center">Vrac</td>
                  <td className="border border-black p-1 text-center">{it.palKgs ?? ''}</td>
                  <td className="border border-black p-1">{it.designation}</td>
                  <td className="border border-black p-1 text-center">{it.quantity}</td>
                  <td className="border border-black p-1 text-center">{it.boxes}</td>
                  <td className="border border-black p-1 text-center">{it.pieces}</td>
                </tr>
              ))}
            </>
          ) : null}
        </tbody>
      </table>

      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr>
            <td className="border border-black bg-gray-200 p-2 font-semibold">TOTAL NUMBER OF PIECES</td>
            <td className="border border-black p-2">{totalPieces.toLocaleString('fr-FR')}</td>
            <td className="border border-black bg-gray-200 p-2 font-semibold">TOTAL NUMBER OF BOXES</td>
            <td className="border border-black p-2">{totalBoxes.toLocaleString('fr-FR')}</td>
          </tr>
          <tr>
            <td className="border border-black bg-gray-200 p-2 font-semibold">TOTAL NUMBER OF PALLETS</td>
            <td className="border border-black p-2">{totalPallets.toLocaleString('fr-FR')}</td>
            <td className="border border-black bg-gray-200 p-2 font-semibold">VOLUME</td>
            <td className="border border-black p-2">{data.volume || ''}</td>
          </tr>
          <tr>
            <td className="border border-black bg-gray-200 p-2 font-semibold">NAVALOCK</td>
            <td className="border border-black p-2">{data.navalock || ''}</td>
            <td className="border border-black bg-gray-200 p-2 font-semibold">NOTES</td>
            <td className="border border-black p-2">{data.notes || ''}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}
