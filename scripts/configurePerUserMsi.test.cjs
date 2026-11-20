// Checks the pinned installer's user scope and optional folder workflow without installing it.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MSICreator } = require("electron-wix-msi");
const { configurePerUserMsi } = require("./configurePerUserMsi.cjs");
function fixture() {
  return new MSICreator({
    appDirectory: process.cwd(),
    outputDirectory: process.cwd(),
    name: "jinav",
    exe: "jinav.exe",
    description: "Test",
    version: "0.0.1",
    manufacturer: "jinav",
    defaultInstallMode: "perUser",
    features: false,
    autoRun: false,
    ui: { chooseDirectory: true },
  });
}
test("roots app files beneath current-user Programs, with no ProgramFiles redirect", () => {
  const creator = fixture();
  configurePerUserMsi(creator);
  assert.match(
    creator.wixTemplate,
    /<Directory Id="LocalAppDataFolder">\s*<Directory Id="JinavUserPrograms" Name="Programs">\s*<!-- {{Directories}} -->\s*<\/Directory>\s*<\/Directory>/,
  );
  assert.doesNotMatch(
    creator.wixTemplate,
    /<Directory Id="{{ProgramFilesFolder}}">/,
  );
  assert.match(creator.wixTemplate, /InstallPrivileges="limited"/);
  assert.match(creator.wixTemplate, /InstallerVersion="500"/);
  assert.match(creator.wixTemplate, />NOT ALLUSERS<\/Condition>/);
  assert.equal(creator.autoRun, false);
});
test("uninstall scope searches only the current user's install registration", () => {
  const creator = fixture();
  configurePerUserMsi(creator);
  assert.doesNotMatch(creator.wixTemplate, /<RegistrySearch[^>]*Root="HKLM"/);
  assert.match(creator.wixTemplate, /<RegistrySearch[^>]*Root="HKCU"/);
  assert.match(
    creator.wixTemplate,
    /<SetProperty Id="APPLICATIONROOTDIRECTORY" Value="\[INSTALLPATH\]" Before="CostFinalize" Sequence="both">Installed AND INSTALLPATH<\/SetProperty>/,
  );
});
test("connects Welcome, folder, Change/Browse, validation, and ready dialogs", () => {
  const creator = fixture();
  configurePerUserMsi(creator);
  assert.match(
    creator.uiTemplate,
    /Id="WIXUI_INSTALLDIR" Value="APPLICATIONROOTDIRECTORY"/,
  );
  assert.match(
    creator.uiTemplate,
    /Dialog="WelcomeDlg"[^>]*Value="InstallDirDlg"/,
  );
  assert.match(
    creator.uiTemplate,
    /Control="ChangeFolder" Event="SpawnDialog" Value="BrowseDlg"/,
  );
  assert.match(creator.uiTemplate, /Control="Next" Event="SetTargetPath"/);
  assert.match(creator.uiTemplate, /Value="WixUIValidatePath"/);
  assert.match(
    creator.uiTemplate,
    /Value="VerifyReadyDlg" Order="4">WIXUI_INSTALLDIR_VALID="1"/,
  );
  assert.doesNotMatch(creator.uiTemplate, /CustomizeDlg|LicenseAgreementDlg/);
});
test("fails closed when scope or upstream template changes", () => {
  const machine = fixture();
  machine.defaultInstallMode = "perMachine";
  assert.throws(() => configurePerUserMsi(machine), /must remain per-user/);
  const changed = fixture();
  changed.wixTemplate = changed.wixTemplate.replace(
    "{{ProgramFilesFolder}}",
    "UnknownFolder",
  );
  assert.throws(() => configurePerUserMsi(changed), /template changed/);
});
test("uses per-user component key paths and preserves untracked files on uninstall", () => {
  const creator = fixture();
  configurePerUserMsi(creator);
  assert.match(
    creator.fileComponentTemplate,
    /<RegistryValue Root="HKCU"[^>]*KeyPath="yes"/,
  );
  assert.match(creator.fileComponentTemplate, /<File[^>]*KeyPath="no"/);
  assert.match(
    creator.fileComponentTemplate,
    /<RemoveFolder[^>]*On="uninstall"/,
  );
  assert.doesNotMatch(
    creator.wixTemplate,
    /RemoveFolderEx|Id="PurgeOnUninstall"/,
  );
});
