param([ValidateSet('x64', 'arm64')][string]$Architecture = 'x64')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$nativeArch = [Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString().ToLowerInvariant()
if ($nativeArch -ne $Architecture) { throw "Expected a native $Architecture test process, got $nativeArch" }
$library = @('webgpu_dawn.dll', 'libwebgpu_dawn.dll') | ForEach-Object {
  Join-Path $root "dist/win32-$Architecture/bin/$_"
} | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $library) { throw 'Packaged Dawn library not found' }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DawnSmoke {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern IntPtr LoadLibraryW(string path);
  [DllImport("kernel32.dll", CharSet = CharSet.Ansi, SetLastError = true)]
  public static extern IntPtr GetProcAddress(IntPtr library, string name);
  [DllImport("kernel32.dll")]
  public static extern bool FreeLibrary(IntPtr library);
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
  public delegate IntPtr CreateInstance(IntPtr descriptor);
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
  public delegate void ReleaseInstance(IntPtr instance);
}
'@
$handle = [DawnSmoke]::LoadLibraryW($library)
if ($handle -eq [IntPtr]::Zero) { throw "Dawn load failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
try {
  $createAddress = [DawnSmoke]::GetProcAddress($handle, 'wgpuCreateInstance')
  $releaseAddress = [DawnSmoke]::GetProcAddress($handle, 'wgpuInstanceRelease')
  if ($createAddress -eq [IntPtr]::Zero -or $releaseAddress -eq [IntPtr]::Zero) { throw 'Dawn WebGPU exports missing' }
  $create = [Runtime.InteropServices.Marshal]::GetDelegateForFunctionPointer($createAddress, [DawnSmoke+CreateInstance])
  $release = [Runtime.InteropServices.Marshal]::GetDelegateForFunctionPointer($releaseAddress, [DawnSmoke+ReleaseInstance])
  $instance = $create.Invoke([IntPtr]::Zero)
  if ($instance -eq [IntPtr]::Zero) { throw 'Dawn instance creation failed' }
  $release.Invoke($instance)
  Write-Host "Validated native $Architecture Dawn instance creation and release"
} finally {
  [DawnSmoke]::FreeLibrary($handle) | Out-Null
}
