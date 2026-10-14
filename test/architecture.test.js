// Checks the dependency rule of the concentric architecture by reading the import statements.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : entry.name.endsWith('.js') ? [join(directory, entry.name)] : [],
  );
}

function importsOf(file) {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((match) => match[1]);
}

function layerOf(file, specifier) {
  if (!specifier.startsWith('.')) return 'external';
  return relative(SRC, resolve(dirname(file), specifier)).split(/[\\/]/)[0];
}

test('the domain imports nothing but the domain', () => {
  for (const file of sourceFiles(join(SRC, 'domain'))) {
    for (const specifier of importsOf(file)) {
      assert.equal(layerOf(file, specifier), 'domain', `${relative(SRC, file)} imports ${specifier}`);
    }
  }
});

test('scenarios import nothing but the domain and other scenarios', () => {
  for (const file of sourceFiles(join(SRC, 'scenarios'))) {
    for (const specifier of importsOf(file)) {
      assert.ok(['domain', 'scenarios'].includes(layerOf(file, specifier)), `${relative(SRC, file)} imports ${specifier}`);
    }
  }
});

test('the infrastructure never imports the scenarios', () => {
  for (const file of sourceFiles(join(SRC, 'infrastructure'))) {
    for (const specifier of importsOf(file)) {
      assert.notEqual(layerOf(file, specifier), 'scenarios', `${relative(SRC, file)} imports ${specifier}`);
    }
  }
});
