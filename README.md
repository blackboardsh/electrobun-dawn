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

## Release

Tag a release (or use the workflow dispatch) to publish per-platform tarballs.
