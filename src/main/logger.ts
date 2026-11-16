// Writes structured lifecycle diagnostics; never accepts task contents or credentials.
export const logger = {
  info(event: "launcher-show", fields: { mode: string; milliseconds: number }) {
    process.stderr.write(
      JSON.stringify({ level: "info", event, ...fields }) + "\n",
    );
  },
  error(event: "startup", message: string) {
    process.stderr.write(
      JSON.stringify({ level: "error", event, message }) + "\n",
    );
  },
};
