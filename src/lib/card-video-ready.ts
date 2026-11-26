/** Publishing a ready notification must never gate the materials refresh. */
export function completeCardVideo(id: string, refreshMaterials: () => void, notify: (id: string) => void) {
  refreshMaterials();
  notify(id);
}