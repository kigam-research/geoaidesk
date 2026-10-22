// Server-safe part of the GAID screen style (no React): the storage key and the inline <head> script that applies a
// stored non-default style before first paint. The hook and setter live in ./style.ts (client only).
export const GAID_STYLE_KEY = "gaid:style";

export const GAID_STYLE_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(GAID_STYLE_KEY)})==="mapsheet"){document.documentElement.dataset.style="mapsheet"}}catch(e){}`;
