function switchMode(m) {
    const enc = m === 'encrypt';
    document.getElementById('mEnc').classList.toggle('active', enc);
    document.getElementById('mDec').classList.toggle('active', !enc);
    document.getElementById('encrypt').classList.toggle('active', enc);
    document.getElementById('decrypt').classList.toggle('active', !enc);
}

function onFileIn(input) {
    const f = input.files[0]; if (!f) return;
    showFileIndicator('fiEnc', f);
    generateKey();
}

function onFileDec(input) {
    const f = input.files[0]; if (!f) return;
    showFileIndicator('fiDec', f);
}

function showFileIndicator(id, f) {
    document.getElementById(id + 'Name').textContent = f.name;
    document.getElementById(id + 'Size').textContent = fmt(f.size);
    document.getElementById(id).classList.add('show');
}

function fmt(b) {
    if (b < 1024) return b + 'B';
    if (b < 1048576) return (b / 1024).toFixed(1) + 'KB';
    return (b / 1048576).toFixed(1) + 'MB';
}

function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let key = '';
    const arr = crypto.getRandomValues(new Uint8Array(16));
    arr.forEach(b => key += chars[b % chars.length]);
    document.getElementById('passIn').value = key;
}

function copyKey() {
    const val = document.getElementById('passIn').value;
    if (!val || val === '') return;
    navigator.clipboard.writeText(val).then(() => toast('Key copied to clipboard', 'ok'));
}

function setStatus(id, msg, type) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.className = 'status-line ' + (type || '');
    el.style.visibility = 'visible';
}

function toast(msg, type = '') {
    const shelf = document.getElementById('toast-shelf');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    shelf.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 3000);
}

async function getKeyMaterial(pw) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), { name: 'PBKDF2' }, false, ['deriveKey']);
}

async function getKey(km, salt) {
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
}

async function generateHashName(fn) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fn));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

function packData(filename, fileBuffer) {
    const nb = new TextEncoder().encode(filename), fb = new Uint8Array(fileBuffer);
    const out = new Uint8Array(2 + nb.length + fb.length);
    out[0] = (nb.length >> 8) & 0xFF; out[1] = nb.length & 0xFF;
    out.set(nb, 2); out.set(fb, 2 + nb.length);
    return out.buffer;
}

function unpackData(buf) {
    const a = new Uint8Array(buf), nl = (a[0] << 8) | a[1];
    return { filename: new TextDecoder().decode(a.slice(2, 2 + nl)), fileBuffer: a.slice(2 + nl).buffer };
}

function downloadFile(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 100);
}

async function encodeFile() {
    const fi = document.getElementById('fileIn'), pw = document.getElementById('passIn').value;
    const btn = document.getElementById('btnEnc');
    if (!fi.files.length) return toast('No source file selected.', 'warn');
    if (!pw) return toast('Generate a key first.', 'warn');
    const file = fi.files[0];
    btn.disabled = true; btn.textContent = 'Processing…';
    setStatus('stEnc', 'encrypting…');
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv   = crypto.getRandomValues(new Uint8Array(12));
            const km   = await getKeyMaterial(pw);
            const key  = await getKey(km, salt);
            const enc  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, packData(file.name, e.target.result));
            const encB = new Uint8Array(enc);
            const out  = new Uint8Array(28 + encB.length);
            out.set(salt, 0); out.set(iv, 16); out.set(encB, 28);
            const hash = await generateHashName(file.name);
            downloadFile(new Blob([out], { type: 'application/octet-stream' }), hash + '.asvault');
            try {
                await navigator.clipboard.writeText(pw);
                toast('Encrypted · key copied to clipboard', 'ok');
            } catch {
                toast('File encrypted and saved.', 'ok');
            }
            setStatus('stEnc', `output → ${hash}.asvault`, 'ok');
        } catch {
            setStatus('stEnc', 'encryption failed', 'err');
            toast('Encryption error.', 'err');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Proceed`;
        }
    };
    reader.readAsArrayBuffer(file);
}

async function decodeFile(mode) {
    const fi = document.getElementById('fileOut'), pw = document.getElementById('passOut').value.trim();
    const btnV = document.getElementById('btnDecView'), btnS = document.getElementById('btnDecSave');
    if (!fi.files.length) return toast('No vault file selected.', 'warn');
    if (!pw) return toast('Access key required.', 'warn');
    const file = fi.files[0];
    if (!file.name.toLowerCase().endsWith('.asvault')) {
        return toast('Invalid format — only .asvault files accepted.', 'err');
    }
    btnV.disabled = true; btnS.disabled = true;
    btnV.textContent = 'Working…'; btnS.textContent = 'Working…';
    setStatus('stDec', 'decrypting…');
    closePreview();
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const arr  = new Uint8Array(e.target.result);
            if (arr.length < 28) throw new Error('invalid');
            const salt = arr.slice(0, 16), iv = arr.slice(16, 28), enc = arr.slice(28);
            const km   = await getKeyMaterial(pw);
            const key  = await getKey(km, salt);
            const dec  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, enc.buffer);
            const { filename, fileBuffer } = unpackData(dec);
            const blob = new Blob([fileBuffer]);

            if (mode === 'save') {
                downloadFile(blob, filename);
                setStatus('stDec', `saved → ${filename}`, 'ok');
                toast('File restored and saved.', 'ok');
            } else {
                const shown = showPreview(blob, filename);
                if (!shown) {
                    downloadFile(blob, filename);
                    setStatus('stDec', `no preview — saved → ${filename}`, 'ok');
                    toast('No preview for this format · file saved.', 'warn');
                } else {
                    setStatus('stDec', `viewing → ${filename}`, 'ok');
                    toast('File decrypted.', 'ok');
                }
            }
        } catch {
            setStatus('stDec', 'wrong key or corrupted file', 'err');
            toast('Decryption failed.', 'err');
        } finally {
            btnV.disabled = false; btnS.disabled = false;
            btnV.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>View`;
            btnS.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Save`;
        }
    };
    reader.readAsArrayBuffer(file);
}

const IMGS  = ['jpg','jpeg','png','gif','webp','bmp','svg','avif'];
const VIDS  = ['mp4','webm','ogg','mov'];
const AUDS  = ['mp3','wav','ogg','flac','m4a','aac'];

function showPreview(blob, filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const url = URL.createObjectURL(blob);
    const body = document.getElementById('previewBody');
    const modal = document.getElementById('previewModal');
    document.getElementById('previewName').textContent = filename;
    body.innerHTML = '';

    let el;
    if (IMGS.includes(ext)) {
        el = document.createElement('img');
        el.src = url; el.alt = filename;
    } else if (VIDS.includes(ext)) {
        el = document.createElement('video');
        el.src = url; el.controls = true;
    } else if (AUDS.includes(ext)) {
        el = document.createElement('audio');
        el.src = url; el.controls = true;
    } else {
        body.innerHTML = `<div class="preview-unsupported">no preview available for .${ext || '?'}</div>`;
        modal.classList.add('show');
        return false;
    }

    body.appendChild(el);
    modal.classList.add('show');
    return true;
}

function closePreview() {
    const modal = document.getElementById('previewModal');
    modal.classList.remove('show');
    document.getElementById('previewBody').innerHTML = '';
    document.getElementById('previewName').textContent = '';
}

function handleModalClick(e) {
    if (e.target === document.getElementById('previewModal')) closePreview();
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closePreview(); });

document.querySelectorAll('.drop-zone').forEach(z => {
    z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('over'); });
    z.addEventListener('dragleave', () => z.classList.remove('over'));
    z.addEventListener('drop', () => z.classList.remove('over'));
});
