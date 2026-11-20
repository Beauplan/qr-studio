import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, Copy, Check, Link2, Type, Wifi, Contact, Mail, Phone, Settings2, ImagePlus, X, Coffee, ShieldCheck, Zap, Palette, Github, AlertCircle } from 'lucide-react';

const tabs = [
  { id: 'url', label: 'Website', Icon: Link2 },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'wifi', label: 'Wi-Fi', Icon: Wifi },
  { id: 'contact', label: 'Contact', Icon: Contact },
  { id: 'email', label: 'Email', Icon: Mail },
  { id: 'phone', label: 'Phone', Icon: Phone },
];
const defaults = {
  url: 'https://example.com', text: 'Hello from QR Studio!',
  wifiName: '', wifiPassword: '', wifiSecurity: 'WPA', wifiHidden: false,
  firstName: '', lastName: '', organization: '', contactPhone: '', contactEmail: '',
  emailTo: '', emailSubject: '', emailBody: '', phone: ''
};
const escapeWifi = (value) => value.replace(/([\\;,:"])/g, '\\$1');
const escapeVCard = (value) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const toHex = (value) => /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';

function makePayload(type, data) {
  switch (type) {
    case 'url': {
      const raw = data.url.trim();
      if (!raw) return '';
      if (/^[a-z][a-z\d+.-]*:/i.test(raw)) return raw;
      return `https://${raw}`;
    }
    case 'text': return data.text;
    case 'wifi':
      if (!data.wifiName.trim()) return '';
      return `WIFI:T:${data.wifiSecurity};S:${escapeWifi(data.wifiName)};P:${data.wifiSecurity === 'nopass' ? '' : escapeWifi(data.wifiPassword)};H:${data.wifiHidden ? 'true' : 'false'};;`;
    case 'contact': {
      if (![data.firstName, data.lastName, data.organization, data.contactPhone, data.contactEmail].some((s) => s.trim())) return '';
      const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
      return ['BEGIN:VCARD', 'VERSION:3.0', `N:${escapeVCard(data.lastName)};${escapeVCard(data.firstName)};;;`, `FN:${escapeVCard(fullName || data.organization || 'Contact')}`, data.organization && `ORG:${escapeVCard(data.organization)}`, data.contactPhone && `TEL:${escapeVCard(data.contactPhone)}`, data.contactEmail && `EMAIL:${escapeVCard(data.contactEmail)}`, 'END:VCARD'].filter(Boolean).join('\n');
    }
    case 'email': {
      if (!data.emailTo.trim()) return '';
      const params = new URLSearchParams();
      if (data.emailSubject) params.set('subject', data.emailSubject);
      if (data.emailBody) params.set('body', data.emailBody);
      return `mailto:${data.emailTo.trim()}${params.size ? '?' + params.toString() : ''}`;
    }
    case 'phone': return data.phone.trim() ? `tel:${data.phone.trim()}` : '';
    default: return '';
  }
}

function Field({ label, value, onChange, placeholder, type = 'text', textarea = false }) {
  return <label className="field"><span>{label}</span>{textarea ? <textarea rows="4" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/> : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/>}</label>;
}

function App() {
  const [type, setType] = useState('url');
  const [data, setData] = useState(defaults);
  const [foreground, setForeground] = useState('#101827');
  const [background, setBackground] = useState('#ffffff');
  const [size, setSize] = useState(512);
  const [level, setLevel] = useState('H');
  const [margin, setMargin] = useState(3);
  const [logo, setLogo] = useState(null);
  const [logoError, setLogoError] = useState('');
  const [qrSvg, setQrSvg] = useState('');
  const [qrError, setQrError] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const payload = useMemo(() => makePayload(type, data), [type, data]);
  const update = (key) => (value) => setData((previous) => ({ ...previous, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    if (!payload) { setQrSvg(''); setQrError(''); return; }
    QRCode.toString(payload, { type: 'svg', errorCorrectionLevel: level, margin, width: size, color: { dark: foreground, light: background } })
      .then((svg) => { if (!cancelled) { setQrSvg(svg); setQrError(''); } })
      .catch(() => { if (!cancelled) { setQrSvg(''); setQrError('This content is too large to fit in a QR code. Try shortening it.'); } });
    return () => { cancelled = true; };
  }, [payload, level, margin, size, foreground, background]);

  const loadLogo = (file) => {
    setLogoError('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setLogoError('Choose a PNG, JPEG, or WebP image.'); return; }
    if (file.size > 2 * 1024 * 1024) { setLogoError('Logo must be smaller than 2 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.onerror = () => setLogoError('Could not read that image.');
    reader.readAsDataURL(file);
  };

  const makeCanvas = async (outputSize) => {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, payload, { errorCorrectionLevel: level, margin, width: outputSize, color: { dark: foreground, light: background } });
    if (logo) {
      const image = new Image();
      image.src = logo;
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
      const logoSize = Math.round(outputSize * 0.17);
      const x = (canvas.width - logoSize) / 2;
      const y = (canvas.height - logoSize) / 2;
      const ctx = canvas.getContext('2d');
      const padding = Math.max(5, Math.round(outputSize * 0.018));
      ctx.fillStyle = background;
      ctx.fillRect(x - padding, y - padding, logoSize + padding * 2, logoSize + padding * 2);
      ctx.drawImage(image, x, y, logoSize, logoSize);
    }
    return canvas;
  };

  const download = async (format) => {
    if (!payload || qrError || busy) return;
    setBusy(true);
    try {
      let url;
      if (format === 'png') {
        const canvas = await makeCanvas(size);
        url = canvas.toDataURL('image/png');
      } else {
        let svg = await QRCode.toString(payload, { type: 'svg', errorCorrectionLevel: level, margin, width: size, color: { dark: foreground, light: background } });
        if (logo) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(svg, 'image/svg+xml');
          const root = doc.documentElement;
          const namespace = 'http://www.w3.org/2000/svg';
          const logoSize = size * 0.17;
          const x = (size - logoSize) / 2;
          const padding = Math.max(5, size * 0.018);
          const rect = doc.createElementNS(namespace, 'rect');
          rect.setAttribute('x', String(x - padding)); rect.setAttribute('y', String(x - padding));
          rect.setAttribute('width', String(logoSize + padding * 2)); rect.setAttribute('height', String(logoSize + padding * 2)); rect.setAttribute('fill', background);
          root.appendChild(rect);
          const image = doc.createElementNS(namespace, 'image');
          image.setAttribute('x', String(x)); image.setAttribute('y', String(x));
          image.setAttribute('width', String(logoSize)); image.setAttribute('height', String(logoSize));
          image.setAttribute('href', logo);
          root.appendChild(image);
          svg = new XMLSerializer().serializeToString(doc);
        }
        url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      }
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `qr-studio-${type}.${format}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      if (format === 'svg') setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setQrError('Could not download this QR code. Try a different image or settings.'); }
    finally { setBusy(false); }
  };

  const copyContent = async () => {
    if (!payload) return;
    try { await navigator.clipboard.writeText(payload); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setCopied(false); }
  };

  const form = () => {
    switch (type) {
      case 'url': return <Field label="Website URL" value={data.url} onChange={update('url')} placeholder="https://yourwebsite.com"/>;
      case 'text': return <Field label="Your text" value={data.text} onChange={update('text')} placeholder="Type anything..." textarea/>;
      case 'wifi': return <><Field label="Network name (SSID)" value={data.wifiName} onChange={update('wifiName')} placeholder="My Wi-Fi"/><div className="two-fields"><label className="field"><span>Security</span><select value={data.wifiSecurity} onChange={(e) => update('wifiSecurity')(e.target.value)}><option value="WPA">WPA / WPA2 / WPA3</option><option value="WEP">WEP</option><option value="nopass">No password</option></select></label>{data.wifiSecurity !== 'nopass' && <Field label="Password" value={data.wifiPassword} onChange={update('wifiPassword')} placeholder="Wi-Fi password"/>}</div><label className="checkbox"><input type="checkbox" checked={data.wifiHidden} onChange={(e) => update('wifiHidden')(e.target.checked)}/> Hidden network</label></>;
      case 'contact': return <><div className="two-fields"><Field label="First name" value={data.firstName} onChange={update('firstName')} placeholder="Alex"/><Field label="Last name" value={data.lastName} onChange={update('lastName')} placeholder="Morgan"/></div><Field label="Company (optional)" value={data.organization} onChange={update('organization')} placeholder="Acme Studio"/><div className="two-fields"><Field label="Phone" value={data.contactPhone} onChange={update('contactPhone')} placeholder="+1 555 123 4567"/><Field label="Email" type="email" value={data.contactEmail} onChange={update('contactEmail')} placeholder="alex@example.com"/></div></>;
      case 'email': return <><Field label="Recipient email" type="email" value={data.emailTo} onChange={update('emailTo')} placeholder="hello@example.com"/><Field label="Subject (optional)" value={data.emailSubject} onChange={update('emailSubject')} placeholder="Hello!"/><Field label="Message (optional)" value={data.emailBody} onChange={update('emailBody')} placeholder="Write your message..." textarea/></>;
      case 'phone': return <Field label="Phone number" type="tel" value={data.phone} onChange={update('phone')} placeholder="+1 555 123 4567"/>;
      default: return null;
    }
  };

  return <div className="app">
    <header className="topbar"><div className="container topbar-inner"><a className="brand" href="#top"><span className="brand-icon"><QrCode size={23}/></span><span>QR<span className="accent">Studio</span><small>CREATE · CUSTOMIZE · SHARE</small></span></a><nav className="top-actions"><a className="top-link" href="#features">Features</a><a className="coffee" href="https://www.buymeacoffee.com/" target="_blank" rel="noopener noreferrer"><Coffee size={17}/> <span>Buy Me a Coffee</span></a></nav></div></header>
    <main id="top"><section className="hero container"><div className="eyebrow"><span className="pulse"/> FREE QR CODE GENERATOR</div><h1>One scan. <span>Endless possibilities.</span></h1><p>Create beautiful, scannable QR codes in seconds. Customize every detail and download instantly — completely free.</p><div className="hero-perks"><span><Check size={15}/> Unlimited codes</span><span><Check size={15}/> No sign-up</span><span><Check size={15}/> No watermarks</span></div></section>
    <section className="workspace container" aria-label="QR code generator"><div className="editor panel"><div className="panel-heading"><div><span className="step">01 / CREATE</span><h2>Build your QR code</h2><p>Choose what you want to share.</p></div><Settings2 className="heading-icon" size={22}/></div><div className="tab-grid" role="tablist" aria-label="QR content type">{tabs.map(({ id, label, Icon }) => <button key={id} role="tab" aria-selected={type === id} className={`tab ${type === id ? 'selected' : ''}`} onClick={() => setType(id)}><Icon size={18}/><span>{label}</span></button>)}</div><div className="fields">{form()}</div><div className="section-divider"/><div className="section-title"><Palette size={18}/><h3>Make it yours</h3></div><div className="color-row"><label className="color-field"><span>QR color</span><div className="color-input"><input type="color" value={foreground} onChange={(e) => setForeground(toHex(e.target.value))}/><code>{foreground.toUpperCase()}</code></div></label><label className="color-field"><span>Background</span><div className="color-input"><input type="color" value={background} onChange={(e) => setBackground(toHex(e.target.value))}/><code>{background.toUpperCase()}</code></div></label></div><div className="two-fields"><label className="field"><span>Download size</span><select value={size} onChange={(e) => setSize(Number(e.target.value))}><option value="256">256 × 256 px</option><option value="512">512 × 512 px</option><option value="1024">1024 × 1024 px</option><option value="2048">2048 × 2048 px</option></select></label><label className="field"><span>Error correction</span><select value={level} onChange={(e) => setLevel(e.target.value)}><option value="L">Low (7%)</option><option value="M">Medium (15%)</option><option value="Q">Quartile (25%)</option><option value="H">High (30%)</option></select></label></div><label className="field"><span>Quiet zone (margin): {margin} modules</span><input className="range" type="range" min="1" max="8" value={margin} onChange={(e) => setMargin(Number(e.target.value))}/></label><div className="logo-row"><div><strong>Add a logo <span className="optional">(optional)</span></strong><p>PNG, JPEG or WebP · up to 2 MB</p></div>{logo ? <button className="outline-button" onClick={() => { setLogo(null); if (fileRef.current) fileRef.current.value = ''; }}><X size={15}/> Remove</button> : <button className="outline-button" onClick={() => fileRef.current?.click()}><ImagePlus size={16}/> Upload</button>}<input ref={fileRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => loadLogo(e.target.files?.[0])}/></div>{logoError && <p className="error-text"><AlertCircle size={15}/>{logoError}</p>}<p className="hint">For best scanning results, use strong contrast and test QR codes with logos before sharing.</p></div>
    <aside className="preview panel"><div className="panel-heading"><div><span className="step">02 / PREVIEW</span><h2>Your QR code</h2><p>Changes appear instantly.</p></div><span className="live-pill"><span className="pulse"/> LIVE</span></div><div className="preview-stage"><div className="qr-paper" style={{backgroundColor:background}}>{qrSvg && !qrError ? <><img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`} alt="Generated QR code preview"/><span className="preview-logo" style={{backgroundColor:background}}>{logo && <img src={logo} alt="Uploaded logo"/>}</span></> : <div className="empty-qr"><QrCode size={68}/><span>{qrError || 'Enter content to generate your QR code'}</span></div>}</div></div>{qrError && <p className="error-text"><AlertCircle size={15}/>{qrError}</p>}<div className="preview-info"><div><span>FORMAT</span><strong>{type.toUpperCase()}</strong></div><div><span>RESOLUTION</span><strong>{size} × {size}</strong></div><div><span>QUALITY</span><strong>High</strong></div></div><button className="download-main" disabled={!payload || !!qrError || busy} onClick={() => download('png')}><Download size={19}/>{busy ? 'Preparing...' : 'Download PNG'}</button><div className="secondary-actions"><button disabled={!payload || !!qrError || busy} onClick={() => download('svg')}><Download size={16}/> Download SVG</button><button disabled={!payload} onClick={copyContent}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Copied!' : 'Copy content'}</button></div><p className="preview-note"><ShieldCheck size={16}/> Your content stays in your browser. No account needed.</p></aside></section>
    <section className="features container" id="features"><div className="features-heading"><span className="step">WHY QR STUDIO?</span><h2>Everything you need. <span>Nothing you don't.</span></h2></div><div className="feature-grid"><div className="feature"><span className="feature-icon"><Zap size={22}/></span><h3>Instant creation</h3><p>Generate QR codes as you type, with no waiting or unnecessary steps.</p></div><div className="feature"><span className="feature-icon"><Palette size={22}/></span><h3>Make it personal</h3><p>Pick your colors, choose the size, and add a logo to match your brand.</p></div><div className="feature"><span className="feature-icon"><ShieldCheck size={22}/></span><h3>Private by design</h3><p>Static QR codes are generated locally in your browser, not stored on our servers.</p></div></div></section></main>
    <footer className="footer"><div className="container footer-inner"><div className="footer-brand"><QrCode size={22}/><strong>QR<span className="accent">Studio</span></strong><span>Free tools. More possibilities.</span></div><div className="footer-right"><span>© {new Date().getFullYear()} QR Studio - Kendrick</span><a href="#top">Back to top ↑</a></div></div></footer>
  </div>;
}
export default App;
