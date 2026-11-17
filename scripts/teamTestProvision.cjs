// Exports the owner's authorized temporary test key only into an ignored private build.
// The resulting installer is extractable; this is not a secret-distribution boundary.
const { app, safeStorage } = require("electron");
const { readFile, writeFile, mkdir } = require("node:fs/promises");
const { resolve, join, sep } = require("node:path");
// Async safeStorage uses the encryption keyring associated with this userData profile.
app.setName("jinav");
app.setPath("userData", join(app.getPath("appData"), "jinav"));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch(
  "disk-cache-dir",
  resolve(__dirname, "../out/private-team/helper-cache"),
);
app.whenReady().then(async () => {
  let phase = "initialization";
  try {
    const root = resolve(__dirname, ".."),
      directory = resolve(process.argv[2] || "");
    if (!directory.startsWith(resolve(root, "out/private-team") + sep))
      throw Error("Invalid staging path");
    phase = "protected-storage availability";
    if (!(await safeStorage.isAsyncEncryptionAvailable()))
      throw Error("Protected storage unavailable");
    phase = "reading protected credential";
    const encrypted = await readFile(
      join(app.getPath("appData"), "jinav/credential.bin"),
    );
    phase = "decrypting protected credential";
    const key = (await safeStorage.decryptStringAsync(encrypted)).result;
    phase = "validating credential format";
    if (!/^sk-[A-Za-z0-9_-]{20,4096}$/.test(key))
      throw Error("Missing OpenAI testing credential");
    phase = "provider authentication";
    const response = await fetch(
      "https://api.openai.com/v1/models/gpt-4.1-mini",
      {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok)
      throw Error(
        `API credential validation failed (${phase}, HTTP ${response.status})`,
      );
    phase = "provider tool-call test";
    const capability = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        store: false,
        input: "Call connection_check with connected=true.",
        tools: [
          {
            type: "function",
            name: "connection_check",
            description: "Verify tool calling for this test build",
            strict: true,
            parameters: {
              type: "object",
              properties: { connected: { type: "boolean" } },
              required: ["connected"],
              additionalProperties: false,
            },
          },
        ],
        tool_choice: { type: "function", name: "connection_check" },
        parallel_tool_calls: false,
        max_output_tokens: 64,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!capability.ok)
      throw Error(
        `API credential validation failed (${phase}, HTTP ${capability.status})`,
      );
    const answer = await capability.json();
    if (
      !answer.output?.some(
        (item) =>
          item.type === "function_call" &&
          item.name === "connection_check" &&
          JSON.parse(item.arguments).connected === true,
      )
    )
      throw Error(
        "API credential validation failed (tool capability unavailable)",
      );
    phase = "private build staging";
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "team-test-credential.bin"),
      Buffer.concat([Buffer.from("JINAV-TEAM-TEST-V1\0"), Buffer.from(key)]),
      { mode: 0o600 },
    );
    await writeFile(
      join(directory, "managed-model.json"),
      JSON.stringify(
        {
          version: 1,
          provider: "openai",
          model: "gpt-4.1-mini",
          endpoint: "https://api.openai.com/v1/responses",
          credentialSource: "bundled-test",
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(directory, "credential-check.json"),
      JSON.stringify({
        model: "gpt-4.1-mini",
        status: response.status,
        desktopContentSent: false,
        toolCallingVerified: true,
      }),
    );
    app.exit(0);
  } catch (error) {
    process.stderr.write(
      /^API credential validation failed/.test(error.message)
        ? error.message + "\n"
        : `Could not prepare the private team-test credential (${phase}).\n`,
    );
    app.exit(1);
  }
});
