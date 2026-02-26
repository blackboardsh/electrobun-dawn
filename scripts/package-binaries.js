#!/usr/bin/env node

import { accessSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const platform = process.platform;
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
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
console.log('Package validation succeeded.');
