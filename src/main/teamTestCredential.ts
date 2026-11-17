// Reads an explicitly opted-in shared test credential; never logs its contents.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
const header = Buffer.from("JINAV-TEAM-TEST-V1\0");
export async function teamTestCredential(
  directory: string,
  provider: string,
  endpoint: string,
) {
  if (
    provider !== "openai" ||
    endpoint !== "https://api.openai.com/v1/responses"
  )
    throw Error(
      "Shared test provisioning requires the approved OpenAI endpoint",
    );
  const bytes = await readFile(join(directory, "team-test-credential.bin"));
  if (bytes.length > 8192 || !bytes.subarray(0, header.length).equals(header))
    throw Error("Invalid team-test provisioning file");
  const key = bytes.subarray(header.length).toString("utf8");
  if (!/^[A-Za-z0-9_-]{20,4096}$/.test(key))
    throw Error("Invalid team-test credential");
  return key;
}
