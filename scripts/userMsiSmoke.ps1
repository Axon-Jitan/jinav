# Installs the owned MSI as a standard user to verify default/custom paths, repair, and safe uninstall.
param([string]$MsiPath='out/release/jinav-0.0.1.msi')
$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskMsi=(Resolve-Path -LiteralPath $MsiPath).Path
if(-not $taskMsi.StartsWith((Join-Path $taskRoot 'out\release\'),[StringComparison]::OrdinalIgnoreCase)){throw 'Use the owned release MSI.'}
$taskPrincipal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if($taskPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Run this smoke check with a non-administrator token.'}
$taskMetadataText=& powershell.exe -NoProfile -NonInteractive -File (Join-Path $PSScriptRoot 'inspectUserMsi.ps1') -MsiPath $taskMsi
if($LASTEXITCODE -ne 0){throw 'Compiled MSI inspection failed.'}
$taskMetadata=$taskMetadataText | ConvertFrom-Json
$taskProduct=$taskMetadata.ProductCode
if($taskProduct -notmatch '^\{[A-Fa-f0-9-]{36}\}$'){throw 'Invalid owned product code.'}
foreach($taskRegRoot in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')){
  if(Get-ChildItem -LiteralPath $taskRegRoot -ErrorAction SilentlyContinue | Get-ItemProperty -ErrorAction SilentlyContinue | Where-Object DisplayName -like '*jinav*'){throw 'An existing jinav installation must be preserved; use a clean test account.'}
}
$taskDefault=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs\jinav'))
$taskCustom=[IO.Path]::GetFullPath((Join-Path $taskRoot ('out/private-team/install-check unicode-'+[char]0xFC+'-'+[guid]::NewGuid().ToString('N'))))
$taskPrivate=[IO.Path]::GetFullPath((Join-Path $taskRoot 'out\private-team\'))
if(-not $taskCustom.StartsWith($taskPrivate,[StringComparison]::OrdinalIgnoreCase)){throw 'Custom test directory escaped the workspace.'}
if((Test-Path -LiteralPath $taskDefault) -or (Test-Path -LiteralPath $taskCustom)){throw 'Refusing to overwrite an existing install/test directory.'}
$taskLogRoot=Join-Path $taskRoot 'out\private-team\install-evidence'
[void](New-Item -ItemType Directory -Path $taskLogRoot -Force)
$taskEvidence=[ordered]@{kind='real-windows-msi-install';result='failed';standardUser=$true;defaultInstall=$false;repair=$false;defaultUninstall=$false;customInstall=$false;customUninstall=$false;untrackedFilePreserved=$false;exitCodes=@{}}
$taskInstalled=$false
function Invoke-OwnedMsi([string[]]$Operation,[string]$Stage){
  $taskLog=Join-Path $taskLogRoot ($Stage+'.log')
  $taskProcess=Start-Process -FilePath 'msiexec.exe' -ArgumentList ($Operation+@('/qn','/norestart','/L*v',('"{0}"' -f $taskLog))) -WindowStyle Hidden -PassThru
  if(-not $taskProcess.WaitForExit(120000)){throw "MSI $Stage exceeded its check deadline; inspect the Windows Installer status before continuing."}
  $taskEvidence.exitCodes[$Stage]=$taskProcess.ExitCode
  if($taskProcess.ExitCode -notin @(0,3010)){throw "MSI $Stage failed with code $($taskProcess.ExitCode). See the private installer log."}
}
try{
  Invoke-OwnedMsi @('/i',('"{0}"' -f $taskMsi)) 'default-install'
  $taskInstalled=$true
  if(-not (Test-Path -LiteralPath (Join-Path $taskDefault 'jinav.exe'))){throw 'Default installation did not create the user-scoped launcher.'}
  $taskInstallInfo=Get-Content -LiteralPath (Join-Path $taskDefault '.installInfo.json') -Raw | ConvertFrom-Json
  $taskEvidence.defaultInstall=$true
  # Verify repair restores a tracked, non-sensitive runtime version file.
  $taskVersionFiles=@(Get-ChildItem -LiteralPath $taskDefault -Recurse -File -Filter 'version')
  if($taskVersionFiles.Count -ne 1){throw 'Expected one runtime version marker.'}
  $taskVersionPath=$taskVersionFiles[0].FullName
  if(-not $taskVersionPath.StartsWith($taskDefault+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Repair test target escaped the installation.'}
  $taskVersionHash=(Get-FileHash -LiteralPath $taskVersionPath).Hash
  Remove-Item -LiteralPath $taskVersionPath
  Invoke-OwnedMsi @('/fa',$taskProduct) 'repair'
  if((Get-FileHash -LiteralPath $taskVersionPath).Hash -ne $taskVersionHash){throw 'Repair did not restore the tracked file.'}
  $taskEvidence.repair=$true
  Invoke-OwnedMsi @('/x',$taskProduct) 'default-uninstall'
  $taskInstalled=$false
  if(Test-Path -LiteralPath (Join-Path $taskDefault 'jinav.exe')){throw 'Default uninstall left the launcher installed.'}
  $taskEvidence.defaultUninstall=$true
  [void](New-Item -ItemType Directory -Path $taskCustom)
  $taskSentinel=Join-Path $taskCustom 'existing-user-file.txt'
  $taskSentinelText=[guid]::NewGuid().ToString()
  [IO.File]::WriteAllText($taskSentinel,$taskSentinelText)
  Invoke-OwnedMsi @('/i',('"{0}"' -f $taskMsi),('APPLICATIONROOTDIRECTORY="{0}"' -f $taskCustom)) 'custom-install'
  $taskInstalled=$true
  if(-not (Test-Path -LiteralPath (Join-Path $taskCustom 'jinav.exe'))){throw 'Custom installation ignored the selected folder.'}
  $taskEvidence.customInstall=$true
  Invoke-OwnedMsi @('/x',$taskProduct) 'custom-uninstall'
  $taskInstalled=$false
  if(Test-Path -LiteralPath (Join-Path $taskCustom 'jinav.exe')){throw 'Custom uninstall left the launcher installed.'}
  $taskEvidence.customUninstall=$true
  if([IO.File]::ReadAllText($taskSentinel) -ne $taskSentinelText){throw 'Uninstall did not preserve the pre-existing file.'}
  $taskEvidence.untrackedFilePreserved=$true
  # Delete only the exact disposable sentinel; never recursively remove a chosen install folder.
  Remove-Item -LiteralPath $taskSentinel
  if(@(Get-ChildItem -LiteralPath $taskCustom -Force).Count -eq 0){Remove-Item -LiteralPath $taskCustom}
  $taskEvidence.result='passed'
}catch{
  $taskEvidence.error=$_.Exception.Message
  throw
}finally{
  if($taskInstalled){try{Invoke-OwnedMsi @('/x',$taskProduct) 'cleanup-uninstall'}catch{Write-Warning 'Test installation needs cleanup; consult its private MSI log.'}}
  $taskEvidencePath=Join-Path $taskRoot 'evidence\windows-msi-install.json'
  $taskEvidence | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $taskEvidencePath -Encoding UTF8
}
$taskEvidence | ConvertTo-Json -Depth 5 -Compress
