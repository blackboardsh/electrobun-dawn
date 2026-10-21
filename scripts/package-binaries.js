#!/usr/bin/env node

import { accessSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const platform = process.platform;
const arch = process.env.DAWN_TARGET_ARCH || process.arch;
if (!['arm64', 'x64'].includes(arch)) throw new Error(`Unsupported target architecture: ${arch}`);
const platformLabel = platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'win32' : 'linux';

const installDir = join(root, 'dist', `${platformLabel}-${arch}`);

function exists(path) {
  try {
    accessSync(path);
    return true;
  } catch {
    return false;
  }
}

const header = join(installDir, 'include', 'webgpu', 'webgpu.h');
if (!exists(header)) {
  throw new Error(`Missing header: ${header}`);
}

const libCandidates = platformLabel === 'darwin'
  ? [
      join(installDir, 'lib', 'libwebgpu_dawn.dylib'),
      join(installDir, 'lib', 'libwebgpu_dawn_shared.dylib')
    ]
  : platformLabel === 'win32'
    ? [
        join(installDir, 'bin', 'webgpu_dawn.dll'),
        join(installDir, 'bin', 'libwebgpu_dawn.dll')
      ]
    : [
        join(installDir, 'lib', 'libwebgpu_dawn.so'),
        join(installDir, 'lib', 'libwebgpu_dawn_shared.so')
      ];

const libPath = libCandidates.find(exists);
if (!libPath) {
  throw new Error(`Missing Dawn shared library. Checked: ${libCandidates.join(', ')}`);
}

console.log(`Found Dawn library: ${libPath}`);
if (platformLabel === 'darwin') {
  const architecture = execFileSync('lipo', ['-archs', libPath], { encoding: 'utf8' }).trim();
  const expected = { arm64: 'arm64', x64: 'x86_64' }[arch];
  if (architecture !== expected) {
    throw new Error(`Expected a ${expected} Dawn library, got ${architecture}`);
  }
  const loadCommands = execFileSync('otool', ['-l', libPath], { encoding: 'utf8' });
  const minimumVersion = loadCommands.match(/\bminos\s+(\d+(?:\.\d+){0,2})/)
    ?? loadCommands.match(/LC_VERSION_MIN_MACOSX\s+cmdsize\s+\d+\s+version\s+(\d+(?:\.\d+){0,2})/);
  const [major, minor = 0, patch = 0] = (minimumVersion?.[1] ?? '').split('.').map(Number);
  if (!minimumVersion || major > 14 || (major === 14 && (minor > 0 || patch > 0))) {
    throw new Error(`Dawn requires macOS ${minimumVersion?.[1] ?? 'unknown'}; the supported baseline is 14.0`);
  }
  const libraries = execFileSync('otool', ['-L', libPath], { encoding: 'utf8' })
    .trim().split('\n').slice(1).map((line) => line.trim().split(' (')[0]);
  // The first entry is the dylib's own install name, followed by dependencies.
  if (!/^@rpath\/libwebgpu_dawn(?:_shared)?\.dylib$/.test(libraries[0])) {
    throw new Error(`Dawn has a non-relocatable install name: ${libraries[0]}`);
  }
  const nonSystemLibraries = libraries.slice(1).filter((library) =>
    !library.startsWith('/System/Library/') && !library.startsWith('/usr/lib/'));
  if (nonSystemLibraries.length) {
    throw new Error(`Dawn depends on non-system libraries: ${nonSystemLibraries.join(', ')}`);
  }
  console.log(`Validated ${architecture}, macOS ${minimumVersion[1]}, and system-only dependencies`);
}
if (platformLabel === 'win32') {
  const binary = readFileSync(libPath);
  const pe = binary.readUInt32LE(0x3c);
  if (binary.readUInt32LE(pe) !== 0x4550 || binary.readUInt16LE(pe + 4) !== { arm64: 0xaa64, x64: 0x8664 }[arch]) {
    throw new Error(`Dawn library does not contain a ${arch} PE image: ${libPath}`);
  }
}
console.log('Package validation succeeded.');
