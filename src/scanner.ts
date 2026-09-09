// URL admission control for anything that fetches on a caller's behalf.
export const MAX_HTML_BYTES=512_000;

const PRIVATE_HOSTS=/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa)$/i;
const IPV4=/^\d{1,3}(\.\d{1,3}){3}$/;

// The scanner fetches attacker-supplied URLs, so it must never be usable as a probe
// into private space. Note the scheme is checked BEFORE the https:// prefix is added --
// the original guard ran after, so it could never fire.
export function assertScannableUrl(input:string):URL{
  const value=input.trim();
  if(!value) throw new Error("Enter a website address to scan.");
  // A leading "word:" is ambiguous -- it is a scheme in "javascript:x" but a port in
  // "example.com:443". Treat it as a port only when what follows is digits and there
  // is no "//" authority marker.
  const scheme=value.match(/^([a-z][a-z0-9+.-]*):(\/\/)?/i);
  if(scheme){
    const looksLikePort=!scheme[2]&&/^\d/.test(value.slice(scheme[0].length));
    if(!looksLikePort&&!/^https?$/i.test(scheme[1]))
      throw new Error("Only public http and https websites can be scanned.");
  }
  let url:URL;
  try{url=new URL(/^https?:\/\//i.test(value)?value:`https://${value}`);}
  catch{throw new Error("That does not look like a valid website address.");}
  if(!["http:","https:"].includes(url.protocol)) throw new Error("Only public http and https websites can be scanned.");
  if(url.port&&!["80","443"].includes(url.port)) throw new Error("Only standard web ports (80 and 443) can be scanned.");
  const host=url.hostname.toLowerCase();
  if(!host) throw new Error("That does not look like a valid website address.");
  // IPv6 literals arrive bracketed from URL.hostname on some runtimes and bare on others.
  if(host.startsWith("[")||host.includes(":")) throw new Error("Only public website names can be scanned, not IP addresses.");
  if(IPV4.test(host)) throw new Error("Only public website names can be scanned, not IP addresses.");
  if(PRIVATE_HOSTS.test(host)) throw new Error("Only public websites can be scanned.");
  if(!host.includes(".")) throw new Error("Enter a full website address, for example yourstore.com.");
  if(host.endsWith(".")) throw new Error("That does not look like a valid website address.");
  return url;
}
