# electrobun-dawn

Builds Dawn (WebGPU) shared libraries for Electrobun.

## Build (local)

```bash
npm run build:release
npm run package
```

Artifacts are installed to:
```
dist/<platform>-<arch>/
```

Windows supports x64 and ARM64 with Visual Studio 2022 or 2026. Install the C++
build tools for the target architecture. The default target matches Node's
architecture; `DAWN_TARGET_ARCH=arm64` selects ARM64 explicitly on Windows.
Build directories are separate for each target. Windows ARM64 CI builds
natively, validates the DLL architecture, and creates/releases a WebGPU
instance through the packaged library before publishing.

## Release

Tag a release (or use the workflow dispatch) to publish per-platform tarballs.
