import { useSSB } from '../../hooks/useSSB';
import { hentBarnehageNokkel, hentSkoleNokkel, hentOmsorgNokkel } from '../../api/ssb';

// ─── Konfigurasjon ────────────────────────────────────────────────────────────

interface IndikatorDef {
  navn: string;
  enhet: string;
  landssnittKode: string; // ContentsCode for å hente landssnitt fra 'EAK'
  bedreHvis: 'over' | 'under';
  formatFn?: (v: number) => string;
}

const BARNEHAGE_INDIKATORER: Record<string, IndikatorDef> = {
  KOSandel150000: {
    navn: 'Barnehagedekning 1–5 år',
    enhet: '%',
    landssnittKode: 'KOSandel150000',
    bedreHvis: 'over',
  },
  KOSbarnaav0000: {
    navn: 'Barn per årsverk',
    enhet: '',
    landssnittKode: 'KOSbarnaav0000',
    bedreHvis: 'under',
    formatFn: v => v.toFixed(1),
  },
  KOSutg020000: {
    navn: 'Driftsutg. per innb. 1–5 år',
    enhet: ' kr',
    landssnittKode: 'KOSutg020000',
    bedreHvis: 'over',
    formatFn: v => v.toLocaleString('nb-NO'),
  },
};

const SKOLE_INDIKATORER: Record<string, IndikatorDef> = {
  KOSgrstr20000: {
    navn: 'Gruppestørrelse (elever)',
    enhet: '',
    landssnittKode: 'KOSgrstr20000',
    bedreHvis: 'under',
    formatFn: v => v.toFixed(1),
  },
  KOSregnind20000: {
    navn: 'Driftsutg. per innb. 6–15 år',
    enhet: ' kr',
    landssnittKode: 'KOSregnind20000',
    bedreHvis: 'over',
    formatFn: v => v.toLocaleString('nb-NO'),
  },
  KOSgrunnskolepoe0000: {
    navn: 'Grunnskolepoeng',
    enhet: '',
    landssnittKode: 'KOSgrunnskolepoe0000',
    bedreHvis: 'over',
    formatFn: v => v.toFixed(1),
  },
};

const OMSORG_INDIKATORER: Record<string, IndikatorDef> = {
  KOSlangtid80aaro0001: {
    navn: 'Andel 80+ i sykehjem',
    enhet: '%',
    landssnittKode: 'KOSlangtid80aaro0001',
    bedreHvis: 'over',
  },
  KOSlegetimperbeb0000: {
    navn: 'Legetimer per beboer/uke',
    enhet: '',
    landssnittKode: 'KOSlegetimperbeb0000',
    bedreHvis: 'over',
    formatFn: v => v.toFixed(2),
  },
  KOSbeleggomsorgs0000: {
    navn: 'Belegg i institusjon',
    enhet: '%',
    landssnittKode: 'KOSbeleggomsorgs0000',
    bedreHvis: 'over',
  },
};

// ─── Delte hjelpere ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3">
      {[120, 120, 120].map((h, i) => (
        <div key={i} className="animate-pulse bg-gray-200 rounded-xl" style={{ height: h }} />
      ))}
    </div>
  );
}

function Feil({ melding }: { melding: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
      Kunne ikke laste data: {melding}
    </div>
  );
}

type SsbRad = { [k: string]: string | number | null; verdi: number | null };

function IndikatorRad({
  meta,
  bambleVerdi,
  landsVerdi,
}: {
  meta: IndikatorDef;
  bambleVerdi: number | null;
  landsVerdi: number | null;
}) {
  if (bambleVerdi == null) return null;

  const bedre =
    landsVerdi == null
      ? true
      : meta.bedreHvis === 'over'
        ? bambleVerdi >= landsVerdi
        : bambleVerdi <= landsVerdi;

  const ref = landsVerdi ?? bambleVerdi * 1.5;
  const pct = Math.min(100, Math.round((bambleVerdi / (ref * 1.4)) * 100));

  const fmt = meta.formatFn ?? ((v: number) => v.toFixed(1));
  const formatert = fmt(bambleVerdi) + meta.enhet;
  const landsStr = landsVerdi != null ? fmt(landsVerdi) + meta.enhet : '—';
  const farge = bedre ? '#1D9E75' : '#E24B4A';

  return (
    <div className="py-2.5 border-b border-gray-100 last:border-b-0">
      {/* Rad 1: navn + verdi */}
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-xs text-gray-600 leading-snug">{meta.navn}</span>
        <span className="text-sm font-semibold text-gray-800 whitespace-nowrap flex-shrink-0">
          {formatert}
        </span>
      </div>
      {/* Rad 2: progressbar + snitt-sammenligning */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: pct + '%', background: farge }}
          />
        </div>
        <span className="text-[10px] whitespace-nowrap flex-shrink-0" style={{ color: farge }}>
          {bedre ? '▲' : '▼'} snitt {landsStr}
        </span>
      </div>
    </div>
  );
}

function Seksjon({
  tittel,
  rader,
  indikatorer,
}: {
  tittel: string;
  rader: SsbRad[];
  indikatorer: Record<string, IndikatorDef>;
}) {
  const bamble = rader.filter(r => r.KOKkommuneregion0000 === '4012');
  const land   = rader.filter(r => r.KOKkommuneregion0000 === 'EAK');

  if (bamble.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded-xl px-3 pt-2.5 pb-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{tittel}</p>
      {Object.entries(indikatorer).map(([kode, meta]) => {
        const b = bamble.find(r => r.ContentsCode === kode)?.verdi ?? null;
        const l = land.find(r => r.ContentsCode === kode)?.verdi ?? null;
        return <IndikatorRad key={kode} meta={meta} bambleVerdi={b} landsVerdi={l} />;
      })}
    </div>
  );
}

// ─── Hovedkomponent ───────────────────────────────────────────────────────────

export function TjenesterPanel() {
  const barnehage = useSSB(hentBarnehageNokkel, 'barnehage');
  const skole     = useSSB(hentSkoleNokkel,     'skole');
  const omsorg    = useSSB(hentOmsorgNokkel,    'omsorg');

  if (barnehage.laster || skole.laster || omsorg.laster) return <Skeleton />;

  const feil = barnehage.feil ?? skole.feil ?? omsorg.feil;
  if (feil) return <Feil melding={feil} />;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Tjenester (KOSTRA 2024)</h3>

      <Seksjon
        tittel="Barnehage"
        rader={barnehage.data ?? []}
        indikatorer={BARNEHAGE_INDIKATORER}
      />
      <Seksjon
        tittel="Grunnskole"
        rader={skole.data ?? []}
        indikatorer={SKOLE_INDIKATORER}
      />
      <Seksjon
        tittel="Pleie og omsorg"
        rader={omsorg.data ?? []}
        indikatorer={OMSORG_INDIKATORER}
      />

      <p className="text-[10px] text-gray-400">
        Bamble vs. landssnitt. Kilde: KOSTRA / SSB tabell 13502, 12255, 12293.
      </p>
    </div>
  );
}
