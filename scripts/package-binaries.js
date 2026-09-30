#!/usr/bin/env node

import { accessSync, readFileSync } from 'node:fs';
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
if (platformLabel === 'win32') {
  const binary = readFileSync(libPath);
  const pe = binary.readUInt32LE(0x3c);
  if (binary.readUInt32LE(pe) !== 0x4550 || binary.readUInt16LE(pe + 4) !== { arm64: 0xaa64, x64: 0x8664 }[arch]) {
    throw new Error(`Dawn library does not contain a ${arch} PE image: ${libPath}`);
  }
}
console.log('Package validation succeeded.');
