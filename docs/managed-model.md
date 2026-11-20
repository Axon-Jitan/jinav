# IT-managed model provisioning

Coworkers no longer see provider, endpoint, model or API-key setup fields. Settings retains user consent, allowed applications and desktop permissions. Minimize, maximize/restore and Close control the real Settings window; closing leaves the tray launcher running.

IT supplies `managed-model.json` with only non-secret model metadata:

```json
{
  "version": 1,
  "model": "claude-sonnet-4-5",
  "endpoint": "https://api.anthropic.com/v1/messages"
}
```

This is an example, not a configured service or a promise that the account has access to that model. Supported protocols are Anthropic Messages (provider: anthropic, the backwards-compatible default) and OpenAI Responses (provider: openai). A company gateway must expose the selected protocol.

Place the file in the project root before packaging. Forge validates its allowed fields and copies it to the application's `resources` directory. An MSI wrapping this application should deploy the same file there. Development reads the project-root file. The local deployment file is Git-ignored. API-key properties in this file are rejected both at packaging and startup; do not put secrets in URLs either.

Credentials are provisioned separately, before ordinary coworker use. IT's trusted deployment tool can supply `JINAV_API_KEY` in the first user-session process environment. jinav consumes and removes that variable, then stores the credential in its existing OS-protected per-user `credential.bin`. Do not put it in command-line arguments, source files, installer properties/logs, `.env`, ordinary settings, or persistent machine/user environment variables. Quit a running jinav before provisioning so the single-instance handoff does not discard the provisioning launch. Provision in the signed-in user's normal context, not the MSI's SYSTEM context. Existing protected credentials are reused only for the same provider endpoint. A provider change with an existing credential requires IT to supply a replacement; otherwise provisioning fails closed without forwarding the old key. If protected storage is unavailable, the existing session-only policy applies.

A shared vendor master key baked into an MSI can be extracted. For production, keep that key at a company gateway and provision suitable per-user/device credentials through IT's trusted distribution. Gateway hosting, authentication/renewal and signing remain deployment work. An unsigned Windows x64 MSI is now available for the explicitly authorized private testing mode below; ordinary builds continue to produce the documented Windows ZIP without a bundled credential.

Valid managed metadata takes precedence over personal model/endpoint values, including existing profiles. Ordinary user preferences and application permissions remain intact. Changing the provider endpoint clears previous cloud-data consent. Users explicitly enable Ask jinav, review its disclosure and select Allowed apps. Opening the wheel or prompt still starts no model request or UI observation. Run performs a fresh backend permission check before observation; provider authentication/tool failures surface as a failed task. A provisioned credential means configured, not a fabricated successful connection.

The temporary OpenAI credential has now passed the live connection tests below. A model-driven desktop editor-and-save workflow remains unverified. The launcher continues to work independently.

## OpenAI testing configuration

Use provider openai, endpoint https://api.openai.com/v1/responses and an authorized model ID. The locally configured test model is gpt-4.1-mini; live authentication and strict tool-call tests passed using the provided temporary credential, including a request made after decrypting the application credential in Electron. No desktop content was sent during those tests. The credential is outside the repository in OS-protected storage; managed-model.json contains metadata only. The OpenAI adapter uses store:false, bounded responses, forced single strict function calls and no blind retries. Each decision is a fresh request with verified history; unresolved tool-call turns are not replayed.

Official protocol: https://developers.openai.com/api/docs/guides/function-calling

## Private team-test MSI

The owner selected product version **0.0.1**. Earlier test installers were incorrectly numbered 0.1.x; uninstall one of those before installing 0.0.1, since the existing MSI upgrade policy rejects downgrades. The upgrade identity remains stable; no downgrade check is bypassed.

The owner explicitly requested a shareable MSI containing the temporary test key. This is a narrow exception for private testing, not secure distribution of a production master key. Anyone with the MSI or installed files can extract the shared key and spend the associated API quota. Revocation ends API access for every recipient. Share privately with the authorized team, set a provider-side usage budget, revoke after testing, and do not upload this artifact to the public repository or a release.

On the build owner's Windows account, after storing the authorized temporary OpenAI credential in jinav's protected store, run `npm run make:team-msi`. The script authenticates and verifies a minimal strict tool call without desktop content. It packages OpenAI Responses with `gpt-4.1-mini`, using Forge maker-wix **8.0.1** and a project-local, SHA-256-pinned **WiX 3.14.1** toolchain. It does not install a global compiler or place the key in a command line, JSON settings, source, or build logs. Temporary credential staging is removed afterward. Finished installers are placed in ignored `out/release/`; internal packaging and extraction files remain in ignored `out/private-team/`. Both contain deliberately extractable test credentials and must be shared privately.

The output is `out/release/jinav-<version>.msi`, with a `.sha256` sidecar. The MSI is per-user, unsigned, defaults to `%LOCALAPPDATA%\Programs\jinav`, offers an optional Change location page, and includes the native driver/helpers and licences outside ASAR. It creates **jinav (team test)** shortcuts that open Settings. It does not launch code in the MSI service/SYSTEM context. First user launch imports the bundled binary credential into that user's Windows safeStorage. The key remains extractable from the installer and application resources regardless of this protected per-user copy. The file is marked `credentialSource: bundled-test` in key-free metadata; normal builds reject that mode unless the private build directory is explicitly selected.

Users must still enable Ask jinav, review cloud disclosure, and choose allowed apps or All installed apps. Physical input is separate. Installation, menu invocation and key import start no desktop observation or AI actions.

An administrative extraction and fresh-profile runtime check passed on Windows 11 x64: first-run import, OS-protected storage, driver status and a real provider-adapter tool call. No desktop text was sent. This does not establish full installation/upgrade/uninstall behavior on another account or computer, nor a successful autonomous editor-save task. Signed production distribution remains outstanding. Do not disable Windows security controls to install this unsigned test build.

`node scripts/teamMsiSmoke.mjs <administrative-image-directory>` validates an extracted MSI within `out/private-team/`. To rebuild only the MSI wrapper from an existing private package, use `npm run make:team-msi -- --from-package`; this reuses its existing test credential without another API check and must not be used after revoking or changing the key.

See [Windows installer validation](windows-installer.md) for the per-user directory correction and actual install/repair/uninstall checks.
