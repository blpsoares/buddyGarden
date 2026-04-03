/**
 * project-context.ts — extrai contexto relevante de um diretório de projeto.
 *
 * O que é extraído (cap total ~4000 chars):
 *   1. Árvore de diretório (2 níveis, sem node_modules/.git/etc)
 *   2. Arquivos-chave: README.md, CLAUDE.md, package.json, pyproject.toml,
 *      Cargo.toml, go.mod, composer.json (primeiros 1200 chars cada)
 *   3. git status (se for repo git)
 *   4. git log --oneline -8 (últimos commits)
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, basename } from 'path';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.svn', 'dist', 'build', '__pycache__',
  '.next', '.nuxt', 'coverage', '.venv', 'venv', 'env', '.env',
  'target', 'vendor', '.turbo', '.cache', 'out', 'tmp', '.tmp',
]);

const KEY_FILES = [
  'README.md', 'readme.md', 'README.txt',
  'CLAUDE.md', 'claude.md',
  'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod',
  'composer.json', 'Gemfile', 'requirements.txt',
];

// ── Árvore de diretório ──────────────────────────────────────────────────────

function buildTree(dir: string, depth = 0, maxDepth = 2): string[] {
  if (depth > maxDepth) return [];
  let entries: string[];
  try {
    entries = readdirSync(dir).sort();
  } catch {
    return [];
  }

  const lines: string[] = [];
  const prefix = '  '.repeat(depth);

  for (const name of entries) {
    if (name.startsWith('.') && depth > 0) continue; // ocultos só na raiz
    const fullPath = join(dir, name);
    let isDir = false;
    try { isDir = statSync(fullPath).isDirectory(); } catch { continue; }

    if (isDir) {
      if (IGNORE_DIRS.has(name)) continue;
      lines.push(`${prefix}${name}/`);
      lines.push(...buildTree(fullPath, depth + 1, maxDepth));
    } else {
      lines.push(`${prefix}${name}`);
    }
  }
  return lines;
}

// ── Git helpers ──────────────────────────────────────────────────────────────

async function gitOutput(cwd: string, args: string[]): Promise<string> {
  try {
    const proc = Bun.spawn(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    return text.trim();
  } catch {
    return '';
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

export interface ProjectContext {
  dir: string;
  summary: string; // texto pronto para injetar no system prompt
}

export async function buildProjectContext(dir: string): Promise<ProjectContext> {
  if (!existsSync(dir)) {
    return { dir, summary: `[projeto: diretório não encontrado: ${dir}]` };
  }

  const parts: string[] = [];
  const dirName = basename(dir);

  // 1. Árvore
  const tree = buildTree(dir);
  parts.push(`## Projeto: ${dirName}\nLocalização: ${dir}\n\n### Estrutura\n\`\`\`\n${tree.slice(0, 60).join('\n')}\`\`\``);

  // 2. Arquivos-chave
  const fileSnippets: string[] = [];
  for (const fname of KEY_FILES) {
    const fpath = join(dir, fname);
    if (!existsSync(fpath)) continue;
    try {
      const raw = readFileSync(fpath, 'utf-8');
      const snippet = raw.slice(0, 1200).trimEnd();
      fileSnippets.push(`### ${fname}\n\`\`\`\n${snippet}${raw.length > 1200 ? '\n...(truncado)' : ''}\n\`\`\``);
      if (fileSnippets.length >= 3) break; // max 3 arquivos-chave
    } catch { /* ignore */ }
  }
  if (fileSnippets.length > 0) parts.push(fileSnippets.join('\n\n'));

  // 3. Git status
  const isGit = existsSync(join(dir, '.git'));
  if (isGit) {
    const [status, log] = await Promise.all([
      gitOutput(dir, ['status', '--short']),
      gitOutput(dir, ['log', '--oneline', '-8']),
    ]);
    if (status) parts.push(`### Git status\n\`\`\`\n${status}\n\`\`\``);
    if (log)    parts.push(`### Git log recente\n\`\`\`\n${log}\n\`\`\``);
  }

  // Cap em ~4000 chars
  let summary = parts.join('\n\n');
  if (summary.length > 4000) summary = summary.slice(0, 3900) + '\n...(contexto truncado)';

  return { dir, summary };
}

// ── Directory browser ────────────────────────────────────────────────────────

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export function browseDir(targetPath: string): { path: string; entries: DirEntry[] } | { error: string } {
  if (!existsSync(targetPath)) return { error: 'Caminho não encontrado' };
  try {
    const stat = statSync(targetPath);
    if (!stat.isDirectory()) return { error: 'Não é um diretório' };
  } catch {
    return { error: 'Acesso negado' };
  }

  let entries: string[];
  try {
    entries = readdirSync(targetPath).sort();
  } catch {
    return { error: 'Sem permissão para listar' };
  }

  const result: DirEntry[] = [];
  for (const name of entries) {
    if (name.startsWith('.')) continue; // ocultar dotfiles no browser
    const fullPath = join(targetPath, name);
    try {
      const isDir = statSync(fullPath).isDirectory();
      if (isDir) result.push({ name, path: fullPath, isDir: true });
    } catch { /* skip */ }
  }

  return { path: targetPath, entries: result };
}
