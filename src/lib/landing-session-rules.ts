/** Only an explicit email callback may resume a visitor capture. */
export function shouldOpenStudentHome(signedIn: boolean, resume?: string): boolean {
  return signedIn && resume !== "1";
}