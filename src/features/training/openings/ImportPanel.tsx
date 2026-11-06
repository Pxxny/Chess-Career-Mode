import { useState } from 'react';
import { Badge, Button, Card, CardTitle } from '@/components/ui';
import { exportPgn, importGameCollection, importOpeningLines, type CollectionReport, type LineImportReport } from '@/game/openings/pgn';
import { useSave } from '@/hooks/useGame';
import { useOpeningStore } from '@/store/openingStore';
import { Segmented, StatusLine } from '../play/controls';

type Mode = 'lines' | 'collection';

const MAX_FILE_BYTES = 60 * 1024 * 1024;

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/x-chess-pgn' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportPanel() {
  const save = useSave();
  const { db, custom, usageBySource, addCustom, addCollection, removeSource, clearImports, storageError } = useOpeningStore();
  const [mode, setMode] = useState<Mode>('lines');
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [variations, setVariations] = useState(true);
  const [maxPlies, setMaxPlies] = useState(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ kind: 'lines'; r: LineImportReport; source: string } | { kind: 'collection'; r: CollectionReport; source: string } | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError(`That file is ${(file.size / 1048576).toFixed(0)} MB. Files up to ${MAX_FILE_BYTES / 1048576} MB are accepted; split a larger database first.`);
      return;
    }
    try {
      setText(await file.text());
      if (!source) setSource(file.name.replace(/\.pgn$/i, ''));
    } catch {
      setError('The file could not be read. Try selecting it again or paste the PGN text.');
    }
  };

  const run = () => {
    const name = source.trim() || (mode === 'lines' ? 'Imported lines' : 'Imported games');
    setBusy(true);
    setError(null);
    setReport(null);
    // Let the page repaint first: a big file takes a moment to read.
    setTimeout(async () => {
      try {
        if (mode === 'lines') {
          const r = importOpeningLines(db, text, { source: name, includeVariations: variations, maxPlies });
          if (r.added.length) await addCustom(r.added);
          setReport({ kind: 'lines', r, source: name });
        } else {
          const r = importGameCollection(db, text, name);
          if (r.classified) await addCollection(name, r.usage);
          setReport({ kind: 'collection', r, source: name });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The file could not be read as PGN.');
      } finally {
        setBusy(false);
      }
    }, 20);
  };

  const lineSources = [...new Set(custom.map((c) => c.source))];
  const prefIds = [...new Set(Object.values(save.repertoire.preferences).flat())];

  return (
    <>
      <Card className="mb-4">
        <CardTitle>Import from PGN</CardTitle>
        <p className="mb-4 text-sm text-ink-muted">Extend the opening database from a PGN file, or from pasted text. Imported data stays in this browser and is added to the built-in ECO openings.</p>
        <div className="space-y-4">
          <Segmented<Mode> label="What does the file contain?" value={mode} onChange={setMode} options={[{ id: 'lines', label: 'Opening lines (repertoire, study)' }, { id: 'collection', label: 'A game collection (statistics)' }]} />
          <p className="text-sm text-ink-muted">
            {mode === 'lines'
              ? 'Each game, and optionally each variation inside it, becomes an opening line. Names come from the Opening, Variation or Event tags. Lines that are already in the database are skipped.'
              : 'The games are counted per opening, with results and decades. Real counts then replace the estimated popularity and history. Only the first 40 half-moves of each game are read.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pgn-file" className="mb-1 block text-sm font-semibold text-ink">PGN file</label>
              <input id="pgn-file" type="file" accept=".pgn,.txt,text/plain" onChange={(e) => void onFile(e.target.files?.[0])} className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-navy-600 file:px-4 file:py-2.5 file:font-semibold file:text-ink" />
            </div>
            <div>
              <label htmlFor="pgn-source" className="mb-1 block text-sm font-semibold text-ink">Name this source</label>
              <input id="pgn-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. My repertoire, Master games 1990-2020" className="min-h-11 w-full rounded-lg border border-white/10 bg-navy-900 px-3 text-sm text-ink" />
            </div>
          </div>
          <div>
            <label htmlFor="pgn-text" className="mb-1 block text-sm font-semibold text-ink">Or paste PGN</label>
            <textarea id="pgn-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'[Event "My Najdorf"]\n[ECO "B90"]\n\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 *'} className="w-full rounded-lg border border-white/10 bg-navy-900 p-3 font-mono text-xs text-ink" />
            <p className="mt-1 text-xs text-ink-faint">{text ? (text.length < 1024 ? `${text.length} characters loaded.` : `${(text.length / 1024).toFixed(0)} KB loaded.`) : 'Nothing loaded yet.'}</p>
          </div>
          {mode === 'lines' && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-ink">
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-gold-500" checked={variations} onChange={(e) => setVariations(e.target.checked)} />Import variations inside games as separate lines</label>
              <label className="flex items-center gap-2">Keep the first <input type="number" min={4} max={80} value={maxPlies} onChange={(e) => setMaxPlies(Math.max(4, Math.min(80, Number(e.target.value) || 24)))} className="h-10 w-20 rounded-lg border border-white/10 bg-navy-900 px-2 text-ink" /> half-moves</label>
            </div>
          )}
          {error && <StatusLine tone="warn">{error}</StatusLine>}
          {storageError && <StatusLine tone="warn">The browser would not save this data ({storageError}). It will be lost when you close the page.</StatusLine>}
          <Button disabled={busy || !text.trim()} onClick={run}>{busy ? 'Importing…' : mode === 'lines' ? 'Import lines' : 'Count games'}</Button>
        </div>
      </Card>

      {report && (
        <Card className="mb-4" aria-live="polite">
          <CardTitle>Import report: {report.source}</CardTitle>
          {report.kind === 'lines' ? (
            <>
              <ul className="space-y-0.5 text-sm text-ink">
                <li>{report.r.gamesRead} games read</li>
                <li className="font-semibold text-emerald-300">{report.r.added.length} new openings added</li>
                <li>{report.r.known} lines were already in the database</li>
                <li>{report.r.truncated} lines cut at an illegal or unreadable move</li>
                <li>{report.r.skipped} lines skipped</li>
              </ul>
              {report.r.warnings.map((w) => <p key={w} className="mt-1 text-sm text-orange-300">{w}</p>)}
              {report.r.added.length > 0 && <p className="mt-2 text-xs text-ink-muted">For example: {report.r.added.slice(0, 4).map((a) => a.name).join('; ')}</p>}
            </>
          ) : (
            <ul className="space-y-0.5 text-sm text-ink">
              <li>{report.r.gamesRead.toLocaleString()} games read</li>
              <li className="font-semibold text-emerald-300">{report.r.classified.toLocaleString()} matched an opening</li>
              <li>{report.r.unclassified.toLocaleString()} did not match any known opening</li>
              {report.r.classified === 0 && <li className="text-orange-300">Nothing was matched, so nothing was saved.</li>}
            </ul>
          )}
        </Card>
      )}

      <Card className="mb-4">
        <CardTitle aside={<Badge>{lineSources.length + Object.keys(usageBySource).length} sources</Badge>}>Imported sources</CardTitle>
        {lineSources.length + Object.keys(usageBySource).length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing imported yet. The database holds the built-in ECO openings only.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {lineSources.map((s) => (
              <li key={`l-${s}`} className="flex items-center justify-between gap-3 py-2.5">
                <p className="text-sm text-ink"><span className="font-semibold">{s}</span> <span className="text-ink-muted">· {custom.filter((c) => c.source === s).length} opening lines</span></p>
                <Button variant="danger" className="min-h-11" onClick={() => void removeSource(s)}>Remove</Button>
              </li>
            ))}
            {Object.entries(usageBySource).map(([s, u]) => (
              <li key={`u-${s}`} className="flex items-center justify-between gap-3 py-2.5">
                <p className="text-sm text-ink"><span className="font-semibold">{s}</span> <span className="text-ink-muted">· game collection, {Math.max(...Object.values(u).map((x) => x.games), 0).toLocaleString()} games in its busiest opening</span></p>
                <Button variant="danger" className="min-h-11" onClick={() => void removeSource(s)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
        {(custom.length > 0 || Object.keys(usageBySource).length > 0) && <Button variant="secondary" className="mt-3" onClick={() => void clearImports()}>Remove everything imported</Button>}
      </Card>

      <Card>
        <CardTitle>Export</CardTitle>
        <p className="mb-3 text-sm text-ink-muted">Save openings as a PGN file you can import again or open in other chess software.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={custom.length === 0} onClick={() => download('imported-openings.pgn', exportPgn(custom))}>Export imported lines ({custom.length})</Button>
          <Button variant="secondary" disabled={prefIds.length === 0} onClick={() => download('my-repertoire.pgn', exportPgn(prefIds.map((id) => db.byId.get(id)).filter((e): e is NonNullable<typeof e> => !!e).map((e) => ({ eco: e.eco, name: e.name, moves: e.moves, side: e.side }))))}>Export my preferred openings ({prefIds.length})</Button>
        </div>
      </Card>
    </>
  );
}
