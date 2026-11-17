// Subscribes to Win32 foreground/window events plus non-injected user input.
// Emits identities only; never records keys, pointer coordinates or window text.
import { spawn, type ChildProcess } from "node:child_process";
import { z } from "zod";
import type { DesktopEvent } from "../platformAdapter";
const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ready") }),
  z.object({
    kind: z.literal("input"),
    at: z.number().nonnegative(),
    windowId: z.string().regex(/^\d+$/).max(100),
  }),
  z.object({ kind: z.literal("release") }),
  z.object({
    kind: z.literal("window"),
    app: z.string().max(4096),
    processId: z.string().max(100),
    id: z.string().max(100),
    activated: z.boolean(),
  }),
]);
const script = `$ErrorActionPreference='Stop'; Add-Type -ReferencedAssemblies System.Windows.Forms @'
using System; using System.Diagnostics; using System.Runtime.InteropServices; using System.Windows.Forms;
public class JinavEvents {
 delegate void EventProc(IntPtr hook,uint evt,IntPtr h,int obj,int child,uint thread,uint time);
 delegate IntPtr InputProc(int code,IntPtr wp,IntPtr lp);
 static EventProc events=OnEvent; static InputProc mouse=OnMouse; static InputProc keyboard=OnKeyboard;
 [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint min,uint max,IntPtr module,EventProc callback,uint pid,uint thread,uint flags);
 [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [StructLayout(LayoutKind.Sequential)] struct Point {public int x;public int y;}
 [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point point);
 [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h,uint flags);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 delegate bool ChildProc(IntPtr h,IntPtr p);
 [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h,ChildProc callback,IntPtr p);
 [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id,InputProc callback,IntPtr module,uint thread);
 [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr h,int code,IntPtr wp,IntPtr lp);
 [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr h);
 [DllImport("kernel32.dll",CharSet=CharSet.Auto)] static extern IntPtr GetModuleHandle(string name);
 static long lastInput=0;
 static void Input(IntPtr window) { long now=DateTime.UtcNow.Ticks; if(now-lastInput<500000)return; lastInput=now; Console.WriteLine("{\\"kind\\":\\"input\\",\\"at\\":"+DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()+",\\"windowId\\":\\""+window.ToInt64()+"\\"}"); }
 static IntPtr OnMouse(int c,IntPtr w,IntPtr l) { if(c>=0 && (Marshal.ReadInt32(l,12)&1)==0)Input(GetAncestor(WindowFromPoint((Point)Marshal.PtrToStructure(l,typeof(Point))),2)); return CallNextHookEx(IntPtr.Zero,c,w,l); }
 static IntPtr OnKeyboard(int c,IntPtr w,IntPtr l) { if(c>=0 && (Marshal.ReadInt32(l,8)&16)==0){if(w.ToInt64()==0x101 || w.ToInt64()==0x105)Console.WriteLine("{\\"kind\\":\\"release\\"}");else Input(GetForegroundWindow());} return CallNextHookEx(IntPtr.Zero,c,w,l); }
 static void OnEvent(IntPtr hook,uint evt,IntPtr h,int obj,int child,uint thread,uint time) {
  if(h==IntPtr.Zero || obj!=0 || !IsWindowVisible(h) || GetWindowTextLength(h)==0)return;
  uint pid;GetWindowThreadProcessId(h,out pid);
  try{ var p=Process.GetProcessById((int)pid);
   if(p.ProcessName.Equals("ApplicationFrameHost",StringComparison.OrdinalIgnoreCase)){EnumChildWindows(h,(childWindow,unused)=>{uint other;GetWindowThreadProcessId(childWindow,out other);if(other!=pid){try{var candidate=Process.GetProcessById((int)other);if(!candidate.ProcessName.Equals("ApplicationFrameHost",StringComparison.OrdinalIgnoreCase)){p=candidate;}}catch(ArgumentException){}}return true;},IntPtr.Zero);pid=(uint)p.Id;}
   string path=p.MainModule.FileName.Replace("\\\\","\\\\\\\\").Replace("\\"","\\\\\\"");
   Console.WriteLine("{\\"kind\\":\\"window\\",\\"app\\":\\""+path+"\\",\\"processId\\":\\""+pid+"-"+p.StartTime.ToUniversalTime().Ticks+"\\",\\"id\\":\\""+h.ToInt64()+"\\",\\"activated\\":"+(evt==3?"true":"false")+"}");
  }catch(Exception){}
 }
 public static void Run(){
  var fg=SetWinEventHook(3,3,IntPtr.Zero,events,0,0,0);var show=SetWinEventHook(0x8002,0x8002,IntPtr.Zero,events,0,0,0);
  var module=GetModuleHandle(null);var mh=SetWindowsHookEx(14,mouse,module,0);var kh=SetWindowsHookEx(13,keyboard,module,0);
  if(fg==IntPtr.Zero || show==IntPtr.Zero || mh==IntPtr.Zero || kh==IntPtr.Zero)throw new Exception("Native event permissions unavailable");
  Console.WriteLine("{\\"kind\\":\\"ready\\"}");
  try{Application.Run();}finally{UnhookWinEvent(fg);UnhookWinEvent(show);UnhookWindowsHookEx(mh);UnhookWindowsHookEx(kh);}
 }
}
'@; [JinavEvents]::Run();`;
export class DesktopEvents {
  private child?: ChildProcess;
  start(callback: (event: DesktopEvent) => void) {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(script, "utf16le").toString("base64"),
      ],
      { windowsHide: true, shell: false },
    );
    this.child = child;
    let buffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      if (buffer.length > 65536) {
        child.kill();
        callback({ kind: "unavailable" });
        return;
      }
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        try {
          const value = schema.safeParse(JSON.parse(line));
          if (value.success) callback(value.data);
        } catch {
          callback({ kind: "unavailable" });
        }
      }
    });
    child.stderr.resume();
    child.on("error", () => callback({ kind: "unavailable" }));
    child.on("exit", () => callback({ kind: "unavailable" }));
    return () => {
      if (this.child === child) this.child = undefined;
      child.kill();
    };
  }
}
