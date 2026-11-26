function ipv4Octets(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : -1));
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

export function subnetForAddress(value: string): string | null {
  if (value.includes(".")) {
    const separator = value.lastIndexOf(":");
    const octets = ipv4Octets(separator < 0 ? value : value.slice(separator + 1));
    if (!octets) return null;
    if (separator < 0) return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
    value = `${value.slice(0, separator)}:${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }

  if (!value.includes(":") || value.includes("%") || value.includes(":::")) return null;
  const compression = value.indexOf("::");
  if (compression !== -1 && value.indexOf("::", compression + 2) !== -1) return null;

  const left = (compression === -1 ? value : value.slice(0, compression))
    .split(":")
    .filter(Boolean);
  const right = compression === -1
    ? []
    : value.slice(compression + 2).split(":").filter(Boolean);
  const missing = 8 - left.length - right.length;
  if ((compression === -1 && missing !== 0) || (compression !== -1 && missing < 1)) return null;

  const groups = [...left, ...Array(compression === -1 ? 0 : missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[\da-f]{1,4}$/i.test(group))) {
    return null;
  }
  const words = groups.map((group) => Number.parseInt(group, 16));

  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    const octets = [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255];
    return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  }

  return `${words.slice(0, 4).map((word) => word.toString(16).padStart(4, "0")).join(":")}::/64`;
}
