/* Offline escape hatch: download / restore the save as a file. Works with no
   Google account and no network. */
export function exportSaveFile(save) {
  const blob = new Blob([JSON.stringify(save)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'dcss-manager-save.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function importSaveFile(file) {
  return file.text().then(txt => JSON.parse(txt));
}
