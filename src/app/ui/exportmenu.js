import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Menu } from './common.js';
import { toast, addToBasket } from '../app.js';
import { t, uiLang } from '../lib/i18n.js';

export function ExportMenu({ data, spec, label, small }) {
  const [busy, setBusy] = useState(false);
  const run = (what, format) => async () => {
    if (busy) return;
    setBusy(true);
    const s = { ...spec, w: data.id, format, ui: uiLang() };
    try {
      const ex = await import('../export.js');
      if (what === 'png') await ex.exportPng(data, s);
      else if (what === 'pdf') await ex.exportPdf({ data, spec: s });
      else if (what === 'print') await ex.printCards([{ data, spec: s }]);
      if (what !== 'print') toast(t('export.done', { kind: what.toUpperCase() }), 'success', 3000);
    } catch (e) {
      console.error(e);
      toast(t('export.failed', { msg: e.message || String(e) }), 'error');
    } finally { setBusy(false); }
  };
  return html`<${Menu} label=${busy ? t('export.busy') : label || t('export.label')} icon="download" align="right" className="export-menu" small=${small} items=${[
    { sep: true, label: t('export.fmt.a4Long') },
    { label: t('export.pngA4'), hint: t('export.hint2x'), onClick: run('png', 'a4') },
    { label: t('export.pdfA4'), onClick: run('pdf', 'a4') },
    { sep: true, label: t('export.fmt.169Long') },
    { label: t('export.png169'), hint: t('export.hintSlide'), onClick: run('png', '169') },
    { label: t('export.pdf169'), onClick: run('pdf', '169') },
    { sep: true, label: t('export.more') },
    { label: t('export.print'), onClick: run('print', 'a4') },
    { label: t('export.basketA4'), onClick: () => addToBasket({ ...spec, w: data.id, format: 'a4', ui: uiLang() }) },
    { label: t('export.basket169'), onClick: () => addToBasket({ ...spec, w: data.id, format: '169', ui: uiLang() }) },
  ]} />`;
}
