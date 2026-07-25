export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export function fmt(n){n=Math.floor(n);
  if(n>=1e9)return (n/1e9).toFixed(2)+'B';
  if(n>=1e6)return (n/1e6).toFixed(2)+'M';
  if(n>=1e4)return (n/1e3).toFixed(1)+'K';
  return ''+n}
