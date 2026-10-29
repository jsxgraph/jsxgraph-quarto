// Helpers for the tests that render a small Quarto project with the filter and
// look at the generated board frames. Needs Quarto (set QUARTO to the quarto
// executable, or have `quarto` on the PATH); the tests skip without it.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const extensionDir = join(repoRoot, '_extensions', 'jsxgraph');

// Reviewed release-runtime baseline before the upstream iframe integration.
// Comparing to the original pre-preload commit would also compare unrelated
// runtime and hidden-board changes. The output test allows only the explicit
// iframe overflow CSS delta from this baseline.
export const BASE_COMMIT = '5ab4e4186f8290bafbd2b40c056b57e8123632b0';

export function findQuarto() {
  const exe = process.env.QUARTO || 'quarto';
  const probe = spawnSync(exe, ['--version'], { encoding: 'utf8' });
  return probe.status === 0 ? { exe, version: probe.stdout.trim() } : null;
}

// A git revision's extension directory (_extensions/jsxgraph), copied to a
// temporary folder: {root, extension}, with root to clean up; null if the
// revision is not in this clone.
export function extensionAtRevision(revision) {
  const dir = mkdtempSync(join(tmpdir(), 'jsxgraph-rev-'));
  const archive = spawnSync('git', ['-C', repoRoot, 'archive', revision, '_extensions/jsxgraph'], { maxBuffer: 1 << 28 });
  if (archive.status !== 0) { rmSync(dir, { recursive: true, force: true }); return null; }
  const untar = spawnSync('tar', ['-x', '-C', dir], { input: archive.stdout });
  if (untar.status !== 0) { rmSync(dir, { recursive: true, force: true }); return null; }
  return { root: dir, extension: join(dir, '_extensions', 'jsxgraph') };
}

// Render one document of a throw-away project.
//   files:  {relative path: string | Buffer} written into the project folder
//   doc:    path of the .qmd among them
//   extension: the extension directory to install (default: this checkout)
//   project: true writes a _quarto.yml, so the project directory is the root
// Returns {status, stdout, stderr, html, frames, dir}; html is null if no output was written.
export function renderProject({ quarto, files, doc, extension = extensionDir, project = false, extraArgs = [] }) {
  const dir = mkdtempSync(join(tmpdir(), 'jsxgraph-render-'));
  cpSync(extension, join(dir, '_extensions', 'jsxgraph'), { recursive: true });
  if (project) writeFileSync(join(dir, '_quarto.yml'), 'project:\n  type: default\n');
  for (const [name, content] of Object.entries(files)) {
    const target = join(dir, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  const run = spawnSync(quarto.exe, ['render', doc, '--to', 'html', ...extraArgs], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 28 });
  const output = join(dir, doc.replace(/\.qmd$/, '.html'));
  const html = existsSync(output) ? readFileSync(output, 'utf8') : null;
  return { status: run.status, stdout: run.stdout, stderr: run.stderr, html, frames: html ? extractFrames(html) : [], dir };
}

// Every board iframe of a page: the whole <iframe> element and the HTML of its
// data: URL, decoded.
export function extractFrames(html) {
  const frames = [];
  for (const m of html.matchAll(/<iframe src="data:text\/html;base64,([A-Za-z0-9+/=]+)"[^>]*><\/iframe>/g)) {
    frames.push({ element: m[0], html: Buffer.from(m[1], 'base64').toString('utf8') });
  }
  return frames;
}

// Board ids are random (JXG + 32 hex digits and underscores); number them by
// first appearance so that two renders of one document can be compared.
export function normalizeIds(text) {
  const seen = new Map();
  return text.replace(/JXG[0-9a-f]{8}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{8}/g,
    (id) => { if (!seen.has(id)) seen.set(id, 'JXG_ID_' + seen.size); return seen.get(id); });
}
// A rendered page embeds the frames as base64, so normalise inside them too.
export function normalizePage(html) {
  return normalizeIds(html.replace(/(<iframe src="data:text\/html;base64,)([A-Za-z0-9+/=]+)(")/g,
    (_, a, b64, c) => a + Buffer.from(normalizeIds(Buffer.from(b64, 'base64').toString('utf8')), 'utf8').toString('base64') + c));
}

// Remove temporary folders made by this module (and nothing else).
export function cleanup(...dirs) {
  for (const d of dirs) {
    if (!d) continue;
    const name = basename(d);
    if (dirname(resolve(d)) !== resolve(tmpdir()) || !/^jsxgraph-(rev|render|ctm)-/.test(name)) {
      throw new Error('refusing to remove ' + d);
    }
    rmSync(d, { recursive: true, force: true });
  }
}
