import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const roots = ['app', join('src', 'components')];
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (extname(path) === '.tsx') files.push(path);
  }
};
roots.forEach(walk);

const findings = [];
const lineAt = (source, index) => source.slice(0, index).split('\n').length;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const checks = [
    { kind: 'JSX text', regex: />([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g },
    { kind: 'string prop', regex: /\b(?:title|subtitle|label|placeholder|body|message|accessibilityLabel|action)="([^"]*[A-Za-z][^"]*)"/g },
  ];
  for (const { kind, regex } of checks) {
    for (const match of source.matchAll(regex)) {
      const value = match[1].trim();
      const looksLikeCode = kind === 'JSX text' && (/[?=:()[\]]/.test(value) || /^(api|Promise)$/.test(value));
      if (value && !value.startsWith('http') && !looksLikeCode) findings.push(`${relative('.', file)}:${lineAt(source, match.index)} ${kind}: ${value}`);
    }
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  console.error(`\n${findings.length} untranslated JSX/string-prop candidate(s).`);
  process.exit(1);
}
console.log(`i18n audit passed (${files.length} TSX files).`);
