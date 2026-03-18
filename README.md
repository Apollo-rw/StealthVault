# StealthVault
> StealthVault is a lightweight, self-contained file encryption tool that runs entirely in your browser. Drop in any file, get a `.asvault`, an encrypted binary container that reveals nothing about its contents without the access key. No accounts, no cloud, no trace.

---

## How it works

StealthVault encrypts any file using AES-256-GCM, a symmetric authenticated cipher. The key is derived from a randomly generated access key using PBKDF2 with 100,000 iterations and SHA-256. The encrypted output is saved as a `.asvault` file, a binary container holding the salt, IV, and ciphertext. The original filename is packed inside the ciphertext, so it's fully recovered on decryption.

All processing happens locally in your browser. Nothing is uploaded anywhere.

---

## Requirements

A modern browser with support for the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

## Usage

### Encrypting a file
1. Download and Open `index.html` in a browser or Access: https://apollo-rw.github.io/StealthVault/
2. Select any file using the drop zone.
3. An access key is automatically generated, copy it or save it somewhere safe (it's also copied to your clipboard automatically when you click Encrypt).
4. Click **Encrypt** and a `.asvault` file is downloaded.

### Decrypting a file
1. Switch to the **Decrypt** tab.
2. Select the `.asvault` file.
3. Paste the access key.
4. Choose **View** to preview the file in-browser (for images, video & audio), or **Save** to download the restored original file.

---

## Technical details

| Property | Value |
|---|---|
| Cipher | AES-256-GCM |
| Key derivation | PBKDF2 |
| Hash | SHA-256 |
| Iterations | 100,000 |
| Salt | 16 bytes, random per file |
| IV | 12 bytes, random per file |
| Key length | 16 chars, alphanumeric + symbols |

---

## File format

`.asvault` files follow a simple binary layout:

```
[0–15]   salt         (16 bytes)
[16–27]  IV           (12 bytes)
[28–]    ciphertext   (AES-GCM encrypted payload)
```

The payload itself contains a 2-byte length prefix for the original filename, followed by the filename and the raw file contents.

---

## Security notes

- The access key is the only thing protecting your file. Store it safely, there is no recovery mechanism.
- Each encryption uses a fresh random salt and IV, so encrypting the same file twice produces different outputs.
- The `.asvault` format is only accepted by the Decrypt tab, files without this extension are rejected before any processing occurs.
- StealthVault does not store, log, or transmit any data.

---

## License

```
MIT License

Copyright (c) 2025 Λpollo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
