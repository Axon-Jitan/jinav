// Supplies the Win32 window inventory binding; does not execute shell commands.
export const windowApi = `Add-Type @'
using System; using System.Text; using System.Collections.Generic; using System.Diagnostics; using System.Runtime.InteropServices;
public class JinavWindow { public string id; public string app; public string title; public bool focused; }
public class JinavWindows {
 public delegate bool Callback(IntPtr h, IntPtr p);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int c);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
 public static bool Focus(IntPtr h){
  if(GetForegroundWindow()==h)return true;
  if(IsIconic(h)){ShowWindowAsync(h,9);for(int i=0;i<25 && IsIconic(h);i++)System.Threading.Thread.Sleep(20);}
  SetForegroundWindow(h);
  for(int i=0;i<25;i++){if(GetForegroundWindow()==h)return true;System.Threading.Thread.Sleep(20);}
  return GetForegroundWindow()==h;
 }
 [DllImport("user32.dll")] static extern bool EnumWindows(Callback callback,IntPtr p);
 [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h,Callback callback,IntPtr p);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 static Process AppProcess(IntPtr h){uint pid;GetWindowThreadProcessId(h,out pid);var owner=Process.GetProcessById((int)pid);if(!owner.ProcessName.Equals("ApplicationFrameHost",StringComparison.OrdinalIgnoreCase))return owner;
  Process app=owner;EnumChildWindows(h,(child,p)=>{uint other;GetWindowThreadProcessId(child,out other);if(other!=pid){try{var candidate=Process.GetProcessById((int)other);if(!candidate.ProcessName.Equals("ApplicationFrameHost",StringComparison.OrdinalIgnoreCase))app=candidate;}catch(ArgumentException){}}return true;},IntPtr.Zero);return app;
 }
 public static JinavWindow Current(){
  var h=GetForegroundWindow();if(h==IntPtr.Zero)return null;var text=new StringBuilder(1024);GetWindowText(h,text,text.Capacity);uint pid;GetWindowThreadProcessId(h,out pid);
  try{return new JinavWindow{id=h.ToInt64().ToString(),app=AppProcess(h).ProcessName+".exe",title=text.ToString(),focused=true};}catch(ArgumentException){return null;}catch(System.ComponentModel.Win32Exception){return null;}
 }
 public static JinavWindow[] Inventory(){
  var items=new List<JinavWindow>(); var foreground=GetForegroundWindow();
  EnumWindows((h,p)=>{ if(!IsWindowVisible(h))return true; var text=new StringBuilder(1024); GetWindowText(h,text,text.Capacity); if(text.Length==0)return true;
   uint pid; GetWindowThreadProcessId(h,out pid); try { var process=AppProcess(h);items.Add(new JinavWindow{id=h.ToInt64().ToString(),app=process.ProcessName+".exe",title=text.ToString(),focused=h==foreground}); } catch(ArgumentException){} catch(System.ComponentModel.Win32Exception){} return true;
  },IntPtr.Zero);return items.ToArray();
 }
}
'@;`;
