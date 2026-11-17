// Activates a registered Windows app through IApplicationActivationManager.
import { execFile } from "node:child_process";
const script = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; Add-Type @'
using System; using System.Runtime.InteropServices;
[ComImport,Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")] class JinavActivationManager {}
[ComImport,Guid("2e941141-7f97-4756-ba1d-9decde894a3d"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IJinavActivationManager {
 [PreserveSig] int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)]string id,[MarshalAs(UnmanagedType.LPWStr)]string arguments,uint options,out uint processId);
}
public class JinavPackagedActivation {
 public static void Open(string id){uint processId; var manager=(IJinavActivationManager)new JinavActivationManager(); int result=manager.ActivateApplication(id,null,0,out processId);if(result<0)Marshal.ThrowExceptionForHR(result);}
}
'@;
[JinavPackagedActivation]::Open([Console]::In.ReadToEnd());`;
export async function activatePackagedApp(
  appId: string,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  if (!appId || appId.length > 2048)
    throw Error("Invalid registered application identifier.");
  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(script, "utf16le").toString("base64"),
      ],
      { windowsHide: true, timeout: 15000, maxBuffer: 16384, signal },
      (error) => {
        if (error)
          reject(
            Error(
              "Windows did not accept activation of this installed app. Check that it is still installed in the signed-in desktop session.",
            ),
          );
        else resolve();
      },
    );
    child.stdin?.on("error", () => {
      /* Process completion reports activation failure. */
    });
    child.stdin?.end(appId);
  });
}
