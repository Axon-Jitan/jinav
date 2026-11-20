// Authors a user-scoped MSI with an explicit writable default and optional folder selection.
function configurePerUserMsi(creator) {
  if (creator.defaultInstallMode !== "perUser")
    throw Error("jinav's desktop installer must remain per-user.");
  creator.wixTemplate = creator.wixTemplate.replace(/\r\n/g, "\n");
  creator.uiTemplate = creator.uiTemplate.replace(/\r\n/g, "\n");
  const replace = (text, search, value) => {
    if (text.split(search).length !== 2)
      throw Error(
        "Pinned MSI template changed; review the per-user installer before building.",
      );
    return text.replace(search, value);
  };
  // Do not rely on ProgramFiles redirection: it did not occur in the original package.
  creator.wixTemplate = replace(
    creator.wixTemplate,
    '<Directory Id="{{ProgramFilesFolder}}">\n<!-- {{Directories}} -->\n      </Directory>',
    '<Directory Id="LocalAppDataFolder">\n        <Directory Id="JinavUserPrograms" Name="Programs">\n<!-- {{Directories}} -->\n        </Directory>\n      </Directory>',
  );
  creator.wixTemplate = replace(
    creator.wixTemplate,
    'InstallerVersion="405"',
    'InstallerVersion="500"',
  );
  creator.wixTemplate = replace(
    creator.wixTemplate,
    'InstallScope="{{PackageScope}}"/>',
    'InstallScope="{{PackageScope}}" InstallPrivileges="limited"/>\n    <Condition Message="jinav installs for the current user. Run without ALLUSERS or a machine-wide deployment option.">NOT ALLUSERS</Condition>',
  );
  // An uninstall must never fall back to a different account's/machine's InstallPath.
  const machineSearch =
    /\s*<RegistrySearch\s+Key="[^"\n]+"\s+Root="HKLM"[\s\S]*?\/>/g;
  if ((creator.wixTemplate.match(machineSearch) || []).length !== 1)
    throw Error("Pinned MSI registry search changed; review uninstall scope.");
  creator.wixTemplate = creator.wixTemplate.replace(machineSearch, "");
  creator.wixTemplate = replace(
    creator.wixTemplate,
    '<Media Id="1" Cabinet="product.cab" EmbedCab="yes"/>',
    '<SetProperty Id="APPLICATIONROOTDIRECTORY" Value="[INSTALLPATH]" Before="CostFinalize" Sequence="both">Installed AND INSTALLPATH</SetProperty>\n    <Media Id="1" Cabinet="product.cab" EmbedCab="yes"/>',
  );
  creator.wixTemplate = replace(
    creator.wixTemplate,
    "<!-- Installation files to %PROGRAMFILES% -->",
    "<!-- Current-user application files; independent of ProgramFiles redirection. -->",
  );
  // Windows Installer requires HKCU key paths for components placed in user profiles.
  creator.fileComponentTemplate = replace(
    creator.fileComponentTemplate,
    'KeyPath="yes" Checksum="yes"',
    'KeyPath="no" Checksum="yes"',
  );
  creator.fileComponentTemplate = replace(
    creator.fileComponentTemplate,
    "<!-- {{ExtensionAssociation}} -->",
    `<!-- {{I}} -->  <RegistryValue Root="HKCU" Key="Software\\jinav\\Installer\\Components" Name="{{ComponentId}}" Type="integer" Value="1" KeyPath="yes"/>
<!-- {{I}} -->  <RemoveFolder Id="{{ComponentId}}" On="uninstall"/>
<!-- {{ExtensionAssociation}} -->`,
  );
  creator.wixTemplate = replace(
    creator.wixTemplate,
    '<RemoveFolder Id="ApplicationProgramsFolder" On="uninstall"/>',
    '<RemoveFolder Id="ApplicationProgramsFolder" On="uninstall"/>\n        <RemoveFolder Id="EmptyUserPrograms" Directory="JinavUserPrograms" On="uninstall"/>',
  );
  // A chosen folder may already contain user files. Uninstall only tracked files and empty folders.
  const purge =
    /<DirectoryRef Id="APPLICATIONROOTDIRECTORY">\s*<Component Id="PurgeOnUninstall"[\s\S]*?<\/DirectoryRef>/g;
  if ((creator.wixTemplate.match(purge) || []).length !== 1)
    throw Error(
      "Pinned MSI uninstall template changed; review file preservation.",
    );
  creator.wixTemplate = creator.wixTemplate.replace(purge, "");
  creator.wixTemplate = replace(
    creator.wixTemplate,
    '<ComponentRef Id="PurgeOnUninstall" />',
    "",
  );

  // Reuse upstream's maintained dialogs without a feature tree or an invented licence agreement.
  creator.uiTemplate = replace(
    creator.uiTemplate,
    '<Property Id="WixUI_Mode" Value="FeatureTree" />',
    '<Property Id="WixUI_Mode" Value="InstallDir" />\n      <Property Id="WIXUI_INSTALLDIR" Value="APPLICATIONROOTDIRECTORY" />\n      <DialogRef Id="BrowseDlg" />',
  );
  creator.uiTemplate = creator.uiTemplate.replaceAll(
    "CustomizeDlg",
    "InstallDirDlg",
  );
  creator.uiTemplate = replace(
    creator.uiTemplate,
    '<Publish Dialog="InstallDirDlg" Control="Next" Event="NewDialog" Value="VerifyReadyDlg">1</Publish>',
    `<Publish Dialog="InstallDirDlg" Control="Next" Event="SetTargetPath" Value="[WIXUI_INSTALLDIR]" Order="1">1</Publish>
      <Publish Dialog="InstallDirDlg" Control="Next" Event="DoAction" Value="WixUIValidatePath" Order="2">1</Publish>
      <Publish Dialog="InstallDirDlg" Control="Next" Event="SpawnDialog" Value="InvalidDirDlg" Order="3">WIXUI_INSTALLDIR_VALID&lt;&gt;"1"</Publish>
      <Publish Dialog="InstallDirDlg" Control="Next" Event="NewDialog" Value="VerifyReadyDlg" Order="4">WIXUI_INSTALLDIR_VALID="1"</Publish>
      <Publish Dialog="InstallDirDlg" Control="ChangeFolder" Property="_BrowseProperty" Value="[WIXUI_INSTALLDIR]" Order="1">1</Publish>
      <Publish Dialog="InstallDirDlg" Control="ChangeFolder" Event="SpawnDialog" Value="BrowseDlg" Order="2">1</Publish>
      <Publish Dialog="BrowseDlg" Control="OK" Event="DoAction" Value="WixUIValidatePath" Order="3">1</Publish>
      <Publish Dialog="BrowseDlg" Control="OK" Event="SpawnDialog" Value="InvalidDirDlg" Order="4">WIXUI_INSTALLDIR_VALID&lt;&gt;"1"</Publish>`,
  );
}
module.exports = { configurePerUserMsi };
