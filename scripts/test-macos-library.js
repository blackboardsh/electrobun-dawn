#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') throw new Error('This test requires macOS');
const arch = process.env.DAWN_TARGET_ARCH || process.arch;
const expected = { x64: 'x86_64', arm64: 'arm64' }[arch];
const host = execFileSync('uname', ['-m'], { encoding: 'utf8' }).trim();
if (!expected || process.arch !== arch || host !== expected) {
  throw new Error(`Expected a native ${arch} test process, got Node ${process.arch} on ${host}`);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installDir = join(root, 'dist', `darwin-${arch}`);
const library = ['libwebgpu_dawn.dylib', 'libwebgpu_dawn_shared.dylib']
  .map((name) => join(installDir, 'lib', name)).find(existsSync);
if (!library) throw new Error('Packaged Dawn library not found');
const temporary = mkdtempSync(join(tmpdir(), 'dawn-smoke-'));
try {
  const source = join(temporary, 'smoke.c');
  const executable = join(temporary, 'smoke');
  writeFileSync(source, `
#include <stdio.h>
#include <webgpu/webgpu.h>
int main(void) {
  WGPUInstance instance = wgpuCreateInstance(NULL);
  if (!instance) {
    fputs("Dawn instance creation failed\\n", stderr);
    return 1;
  }
  wgpuInstanceRelease(instance);
  puts("Dawn instance creation and release succeeded");
  return 0;
}
`);
  execFileSync('xcrun', ['clang', '-arch', expected, '-mmacosx-version-min=14.0',
    '-I', join(installDir, 'include'), source, library,
    '-Wl,-rpath,' + join(installDir, 'lib'), '-o', executable], { stdio: 'inherit' });
  execFileSync(executable, [], { stdio: 'inherit' });
  console.log(`Validated native ${arch} Dawn headers, linking, loading, and instance lifecycle`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
