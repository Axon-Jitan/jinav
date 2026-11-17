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

A shared vendor master key baked into an MSI can be extracted. For production, keep that key at a company gateway and provision suitable per-user/device credentials through IT's trusted distribution. Gateway hosting, authentication/renewal, signing and an actual MSI installer are not implemented by this client change; the current build still produces the documented unsigned Windows ZIP.

Valid managed metadata takes precedence over personal model/endpoint values, including existing profiles. Ordinary user preferences and application permissions remain intact. Changing the provider endpoint clears previous cloud-data consent. Users explicitly enable Ask jinav, review its disclosure and select Allowed apps. Opening the wheel or prompt still starts no model request or UI observation. Run performs a fresh backend permission check before observation; provider authentication/tool failures surface as a failed task. A provisioned credential means configured, not a fabricated successful connection.

The temporary OpenAI credential has now passed the live connection tests below. A model-driven desktop editor-and-save workflow remains unverified. The launcher continues to work independently.

## OpenAI testing configuration

Use provider openai, endpoint https://api.openai.com/v1/responses and an authorized model ID. The locally configured test model is gpt-4.1-mini; live authentication and strict tool-call tests passed using the provided temporary credential, including a request made after decrypting the application credential in Electron. No desktop content was sent during those tests. The credential is outside the repository in OS-protected storage; managed-model.json contains metadata only. The OpenAI adapter uses store:false, bounded responses, forced single strict function calls and no blind retries. Each decision is a fresh request with verified history; unresolved tool-call turns are not replayed.

Official protocol: https://developers.openai.com/api/docs/guides/function-calling
