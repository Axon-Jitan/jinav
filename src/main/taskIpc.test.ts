// Verifies pending task cancellation and native output-file authorization.
import { afterEach,expect,it,vi } from 'vitest';
import { dialog } from 'electron';
import { channels } from '../shared/bridge';
import { defaultConfig } from '../shared/config';
import { taskIpc } from './taskIpc';
import { ConfigStore } from './configStore';
import { SecretStore } from './secretStore';
import { TaskHost } from './taskHost';
import { TaskCache } from './taskCache';
import type { LauncherWindow } from './launcherWindow';
import type { PlatformAdapter } from '../platform/platformAdapter';
import type { DesktopDriver } from '../desktop/desktopDriver';
vi.mock('electron',()=>({dialog:{showSaveDialog:vi.fn()},safeStorage:{},utilityProcess:{}}));
afterEach(()=>vi.restoreAllMocks());
const target={id:'1',app:'notepad.exe',title:'Disposable editor'};
function fixture(){
  const handlers=new Map<string,(value:unknown)=>unknown>();
  const store=new ConfigStore('unused');store.config={...defaultConfig,aiEnabled:true,cloudConsent:true};
  const secrets=new SecretStore('unused');vi.spyOn(secrets,'get').mockReturnValue('fake');
  const host=new TaskHost(()=>{},new TaskCache('unused'));vi.spyOn(host,'start').mockImplementation(()=>{});
  const launcher={show:vi.fn().mockResolvedValue(undefined),window:{setAlwaysOnTop:vi.fn(),webContents:{send:vi.fn()}}} as unknown as LauncherWindow;
  const platform:PlatformAdapter={label:'fake',isWayland:false,executableSuffix:'.exe',discover:async()=>[],windows:vi.fn().mockResolvedValue([target]),launch:vi.fn(),focus:vi.fn()};
  const desktop={status:vi.fn()} as unknown as DesktopDriver;
  const stop=taskIpc((channel,handler)=>handlers.set(channel,handler),store,secrets,host,launcher,platform,'driver',desktop);
  const invoke=(channel:string,value?:unknown)=>{const handler=handlers.get(channel);if(!handler)throw Error('Missing handler');return handler(value);};
  return {host,platform,invoke,stop};
}
it('invalidates a delayed start when Stop is requested during window validation',async()=>{const f=fixture();let finish:((windows:typeof target[])=>void)|undefined;vi.mocked(f.platform.windows).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const starting=f.invoke(channels.startTask,{goal:'Test',target}) as Promise<unknown>;await vi.waitFor(()=>expect(f.platform.windows).toHaveBeenCalled());f.stop();finish?.([target]);await expect(starting).rejects.toThrow('cancelled');expect(f.host.start).not.toHaveBeenCalled();expect(f.host.state.phase).toBe('cancelled');});
it('refuses file verification without native picker authorization',async()=>{const f=fixture();await expect(f.invoke(channels.startTask,{goal:'Test',target,verificationFile:'C:/private.txt'})).rejects.toThrow('native output picker');expect(f.host.start).not.toHaveBeenCalled();});
it('does not reuse a previous prompt output file when it is absent from this request',async()=>{const f=fixture();vi.mocked(dialog.showSaveDialog).mockResolvedValue({canceled:false,filePath:'C:/test/selected.txt'});await f.invoke(channels.chooseVerificationFile);await f.invoke(channels.startTask,{goal:'Test',target});expect(f.host.start).toHaveBeenCalledWith(expect.objectContaining({goal:'Test'}),expect.anything(),'fake','driver',undefined,expect.any(String));});
