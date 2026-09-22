// Trigger a browser download of a Blob under `filename` using a temporary
// object URL and anchor. Extracted from the pages so the DOM dance lives in one
// place and can be stubbed in tests.
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
