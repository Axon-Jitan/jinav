# Verifies compiled MSI scope and folder-dialog wiring without installing or executing application code.
param([Parameter(Mandatory=$true)][string]$MsiPath)
$ErrorActionPreference='Stop'
$taskMsiPath=(Resolve-Path -LiteralPath $MsiPath).Path
$taskInstaller=New-Object -ComObject WindowsInstaller.Installer
$taskDatabase=$taskInstaller.OpenDatabase($taskMsiPath,0)
function Read-MsiRows([string]$Query,[int]$Columns){
  $taskView=$taskDatabase.OpenView($Query)
  [void]$taskView.Execute()
  while($taskRecord=$taskView.Fetch()){
    $taskValues=@()
    for($taskColumn=1;$taskColumn -le $Columns;$taskColumn++){
      $taskValues+= $taskRecord.GetType().InvokeMember('StringData','GetProperty',$null,$taskRecord,@($taskColumn))
    }
    ,$taskValues
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskRecord)
  }
  [void]$taskView.Close()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskView)
}
$taskProperties=@{}
Read-MsiRows 'SELECT `Property`, `Value` FROM `Property`' 2 | ForEach-Object {$taskProperties[$_[0]]=$_[1]}
if($taskProperties.ALLUSERS){throw 'MSI must not set ALLUSERS.'}
if($taskProperties.MSIINSTALLPERUSER -ne '1'){throw 'Missing current-user install context.'}
if($taskProperties.WIXUI_INSTALLDIR -ne 'APPLICATIONROOTDIRECTORY'){throw 'Folder selection is not bound to the app directory.'}
$taskDirectories=@{}
Read-MsiRows 'SELECT `Directory`, `Directory_Parent`, `DefaultDir` FROM `Directory`' 3 | ForEach-Object {$taskDirectories[$_[0]]=@($_[1],$_[2])}
if($taskDirectories.APPLICATIONROOTDIRECTORY[0] -ne 'JinavUserPrograms' -or $taskDirectories.APPLICATIONROOTDIRECTORY[1] -notmatch '(^|\|)jinav$'){throw 'Incorrect app install directory.'}
if($taskDirectories.JinavUserPrograms[0] -ne 'LocalAppDataFolder' -or $taskDirectories.JinavUserPrograms[1] -ne 'Programs'){throw 'Default install must remain under LocalAppData Programs.'}
$taskEvents=@(Read-MsiRows 'SELECT `Dialog_`, `Control_`, `Event`, `Argument` FROM `ControlEvent`' 4)
if(-not ($taskEvents | Where-Object {$_[0] -eq 'InstallDirDlg' -and $_[1] -eq 'ChangeFolder' -and $_[2] -eq 'SpawnDialog' -and $_[3] -eq 'BrowseDlg'})){throw 'Missing Change folder action.'}
if(-not ($taskEvents | Where-Object {$_[0] -eq 'InstallDirDlg' -and $_[1] -eq 'Next' -and $_[2] -eq 'SetTargetPath'})){throw 'Folder selection cannot be committed.'}
$taskActions=@(Read-MsiRows 'SELECT `Action`, `Source`, `Target` FROM `CustomAction`' 3)
if(-not ($taskActions | Where-Object {$_[1] -eq 'APPLICATIONROOTDIRECTORY' -and $_[2] -eq '[INSTALLPATH]'})){throw 'Chosen location is not restored for maintenance.'}
if($taskActions | Where-Object {$_[0] -match 'RemoveFoldersEx'}){throw 'Custom location must not be recursively purged.'}
$taskSummary=$taskDatabase.SummaryInformation(0)
$taskWordCount=$taskSummary.GetType().InvokeMember('Property','GetProperty',$null,$taskSummary,@(15))
if(($taskWordCount -band 8) -eq 0){throw 'MSI is not marked for limited-user installation.'}
[pscustomobject]@{ProductCode=$taskProperties.ProductCode;Version=$taskProperties.ProductVersion;PerUser=$true;LimitedPrivileges=$true;DefaultDirectory='LocalAppData/Programs/jinav';ChangeFolder=$true} | ConvertTo-Json -Compress
[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskSummary)
[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskDatabase)
[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskInstaller)
