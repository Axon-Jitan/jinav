// Reads provider response text with a streaming byte limit.
export async function readBoundedResponse(
  response: Response,
  maximum = 200000,
): Promise<string> {
  if (!response.body) throw Error("Provider returned an empty response");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let text = "",
    bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > maximum) {
        await reader.cancel();
        throw Error("Model response exceeded size limit");
      }
      text += decoder.decode(result.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
