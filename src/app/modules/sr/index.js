// Modul «Rechtstext» (Etappe 1). Ansichten mit work: true brauchen einen gewählten Erlass (Hash-Parameter w).
import { LibraryView } from './library.js';
import { Overview } from './overview.js';
import { Read, ChronikView } from './read.js';
import { CompareView } from './compareview.js';
import { UpdateView } from './updateview.js';
import { InfoView } from './info.js';
import { GuideView } from './guide.js';

export const srModule = {
  id: 'sr',
  labelKey: 'nav.module',
  views: [
    { id: 'bibliothek', labelKey: 'nav.bibliothek', component: LibraryView },
    { id: 'uebersicht', labelKey: 'nav.uebersicht', component: Overview, work: true },
    { id: 'lesen', labelKey: 'nav.lesen', component: Read, work: true },
    { id: 'chronik', labelKey: 'nav.chronik', component: ChronikView, work: true },
    { id: 'vergleich', labelKey: 'nav.vergleich', component: CompareView, work: true },
    { id: 'aktualisieren', labelKey: 'nav.aktualisieren', component: UpdateView },
    { id: 'anleitung', labelKey: 'nav.anleitung', component: GuideView, sample: true },
    { id: 'info', labelKey: 'nav.info', component: InfoView },
  ],
};
