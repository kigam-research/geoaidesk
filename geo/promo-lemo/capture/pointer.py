"""Pointer overlay copied unchanged from geo/promo/capture.py; no text masks."""
DRAW = """([p,a]) => {
 let o=document.getElementById('capture-pointer');
 if(!o){o=document.createElement('div');o.id='capture-pointer';
  o.style.cssText='position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  o.innerHTML='<svg width="100%" height="100%" style="overflow:visible;position:absolute;inset:0"><g id="capture-ripple"></g><g id="capture-arrow"><path d="M0 0 L0 22 L5.6 16.4 L10.4 27.2 L15.2 24.8 L10.4 14.4 L19.2 14.4 Z" fill="#14213d" stroke="white" stroke-width="2" stroke-linejoin="round"/></g></svg>';
  document.body.appendChild(o);}
 o.querySelector('#capture-arrow').setAttribute('transform',`translate(${p.x} ${p.y})`);
 o.querySelector('#capture-ripple').innerHTML=a==null?'':`<circle cx="${p.x}" cy="${p.y}" r="${8+22*a}" fill="none" stroke="#2f6bff" stroke-width="${2.5*(1-a)}" opacity="${0.9*(1-a)}"/>`;
}"""

