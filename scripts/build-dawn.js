#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');
const platform = process.platform;
const arch = process.env.DAWN_TARGET_ARCH || process.arch;
if (!['arm64', 'x64'].includes(arch)) throw new Error(`Unsupported target architecture: ${arch}`);
if (platform !== 'win32' && arch !== process.arch) throw new Error('Cross compilation is only configured for Windows');

const platformLabel = platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'win32' : 'linux';
const outDir = join(root, 'out', `${platformLabel}-${arch}`, 'Release');
const installDir = join(root, 'dist', `${platformLabel}-${arch}`);

const deps = [
  'third_party/abseil-cpp',
  'third_party/dxc',
  'third_party/dxheaders',
  'third_party/glfw',
  'third_party/jinja2',
  'third_party/khronos/EGL-Registry',
  'third_party/khronos/OpenGL-Registry',
  'third_party/libprotobuf-mutator/src',
  'third_party/protobuf',
  'third_party/markupsafe',
  'third_party/glslang/src',
  'third_party/google_benchmark/src',
  'third_party/googletest',
  'third_party/spirv-headers/src',
  'third_party/spirv-tools/src',
  'third_party/vulkan-headers/src',
  'third_party/vulkan-loader/src',
  'third_party/vulkan-utility-libraries/src',
  'third_party/webgpu-headers/src'
];

function windowsGenerator() {
  if (process.env.CMAKE_GENERATOR) return process.env.CMAKE_GENERATOR;
  const vswhere = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles]
    .filter(Boolean)
    .map((directory) => join(directory, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe'))
    .find(existsSync);
  if (!vswhere) throw new Error('Visual Studio Installer (vswhere.exe) was not found');
  const component = arch === 'arm64' ? 'Microsoft.VisualStudio.Component.VC.Tools.ARM64' : 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64';
  const version = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', component, '-property', 'installationVersion'], { encoding: 'utf8' }).trim();
  const generator = { 17: 'Visual Studio 17 2022', 18: 'Visual Studio 18 2026' }[version.split('.')[0]];
  if (!generator) throw new Error(`No supported Visual Studio installation with ${arch} C++ tools (version: ${version || 'missing'})`);
  return generator;
}

const cmakeArgs = [
  '-S', join(root, 'dawn'),
  '-B', outDir,
  ...(platform === 'win32'
    ? ['-G', windowsGenerator(), '-A', arch === 'arm64' ? 'ARM64' : 'x64']
    : ['-G', 'Ninja', '-DCMAKE_BUILD_TYPE=Release']),
  '-DDAWN_FETCH_DEPENDENCIES=ON',
  '-DDAWN_ENABLE_INSTALL=ON',
  '-DDAWN_BUILD_MONOLITHIC_LIBRARY=SHARED',
  '-DBUILD_SHARED_LIBS=OFF',
  '-DDAWN_BUILD_SAMPLES=OFF',
  '-DDAWN_BUILD_TESTS=OFF',
  '-DDAWN_BUILD_PROTOBUF=OFF',
  '-DTINT_BUILD_CMD_TOOLS=OFF',
  '-DTINT_BUILD_TESTS=OFF',
  '-DTINT_BUILD_IR_BINARY=OFF'
];

function run(cmd, args, options = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...options });
}

mkdirSync(join(root, 'dist'), { recursive: true });
for (const dep of deps) {
  mkdirSync(join(root, 'dawn', dep), { recursive: true });
}

console.log(`Building Dawn (${platformLabel}-${arch})...`);
run('cmake', cmakeArgs);
run('cmake', ['--build', outDir, '--config', 'Release']);

rmSync(installDir, { recursive: true, force: true });
run('cmake', ['--install', outDir, '--config', 'Release', '--prefix', installDir]);

console.log(`Installed Dawn to ${installDir}`);
