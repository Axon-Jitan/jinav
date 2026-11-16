// Implements Windows application catalogue operations through native shell facilities.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { shell } from "electron";
import { z } from "zod";
import type { PlatformAdapter } from "../platformAdapter";
import { appSchema } from "../../shared/config";
import { WindowService } from "./windowService";
const execute = promisify(execFile);
async function powershell(script: string): Promise<string> {
  try {
    const { stdout } = await execute(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(script, "utf16le").toString("base64"),
      ],
      { windowsHide: true, timeout: 15000, maxBuffer: 4 * 1024 * 1024 },
    );
    return stdout.replace(/^\uFEFF/, "").trim();
  } catch {
    throw Error(
      "Windows native operation was refused or timed out. Check the signed-in desktop session, then try again.",
    );
  }
}
export function windowsAdapter(): PlatformAdapter {
  const service = new WindowService();
  service.prepare();
  return {
    label: "Windows",
    isWayland: false,
    executableSuffix: ".exe",
    async discover() {
      const output = await powershell(
        `$ErrorActionPreference='Stop'; $items=@(); $ws=New-Object -ComObject WScript.Shell; $roots=@([Environment]::GetFolderPath('CommonStartMenu'),[Environment]::GetFolderPath('StartMenu')); foreach($root in $roots){ Get-ChildItem -LiteralPath $root -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | ForEach-Object { $s=$ws.CreateShortcut($_.FullName); if($s.TargetPath -like '*.exe'){ $items+=@{id=$_.FullName;name=$_.BaseName;path=$s.TargetPath} } } }; Get-StartApps | Where-Object {$_.AppID -match '!'} | ForEach-Object {$items+=@{id=('aumid:'+$_.AppID);name=$_.Name;path=''}}; ConvertTo-Json -InputObject @($items) -Compress`,
      );
      const entries = z.array(appSchema).parse(JSON.parse(output));
      const registered = await powershell(
        `$items=@(); foreach($root in @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths')){ Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue | ForEach-Object { $path=$_.GetValue(''); if($path -and (Test-Path -LiteralPath $path -PathType Leaf)){$items+=@{id=$path;name=[IO.Path]::GetFileNameWithoutExtension($path);path=$path}} } }; foreach($name in @('notepad.exe','explorer.exe')){$path=Join-Path $env:WINDIR ('System32\\'+$name);if($name -eq 'explorer.exe'){$path=Join-Path $env:WINDIR $name}; if(Test-Path -LiteralPath $path -PathType Leaf){$items+=@{id=$path;name=[IO.Path]::GetFileNameWithoutExtension($path);path=$path}}};ConvertTo-Json -InputObject @($items) -Compress`,
      );
      for (const entry of z.array(appSchema).parse(JSON.parse(registered)))
        if (!entries.some((e) => e.id === entry.id)) entries.push(entry);
      return entries;
    },
    async windows() {
      return service.windows();
    },
    foreground: () => service.foreground(),
    async launch(entry) {
      if (entry.id.startsWith("aumid:")) {
        await execute(
          "explorer.exe",
          [`shell:AppsFolder\\${entry.id.slice(6)}`],
          { windowsHide: true, timeout: 10000 },
        );
        return;
      }
      const error = await shell.openPath(entry.id);
      if (error)
        throw Error(
          `Could not open ${entry.name}: ${error}. Repair its shortcut in settings.`,
        );
    },
    async focus(window) {
      if (!/^\d+$/.test(window.id))
        throw Error("Invalid native window identifier");
      await service.focus(window.id, window.app);
    },
    dispose() {
      service.dispose();
    },
  };
}
