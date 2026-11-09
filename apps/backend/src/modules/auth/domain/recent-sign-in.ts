export function isRecentSignIn(signedInAt: Date, now: Date, windowSeconds: number): boolean {
  return now.getTime() - signedInAt.getTime() <= windowSeconds * 1000;
}
