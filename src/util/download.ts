// Utility for downloading text content as a file in the browser.

/** Downloads a string as an NDJSON (application/x-ndjson) file. */
export function downloadText(content: string, filename: string) {
  const blob = new Blob([content], {
    type: "application/x-ndjson;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
