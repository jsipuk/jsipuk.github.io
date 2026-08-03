/* The Dojo — storage and encryption layer.
 *
 * Deliberately has no DOM access and never touches localStorage itself, so the
 * same file runs in the browser and under Node for `node dojo/test/run.js`.
 * The app layer owns persistence; this file owns the envelope format and the
 * cryptography.
 *
 * Envelope written to storage and to export files:
 *
 *   encrypted   { app, v, enc:true,  kdf, iter, salt, iv, ct }
 *   unencrypted { app, v, enc:false, data }
 *
 * `iter` is stored rather than assumed so the work factor can be raised later
 * without locking anyone out of data written by an older version.
 *
 * AES-GCM is authenticated, so a wrong passphrase makes decrypt throw. That is
 * the passphrase check: there is no separate verifier to get out of step.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DojoStore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var APP = 'dojo';
  var VERSION = 1;

  /* OWASP's current floor for PBKDF2-HMAC-SHA256. Paid once per unlock, not
     per save, because the derived key is held in memory for the session. */
  var ITERATIONS = 600000;

  var webcrypto = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto : null;
  function subtle() {
    if (!webcrypto) throw new Error('Web Crypto is not available in this browser.');
    return webcrypto.subtle;
  }

  /* ---------------------------------------------------------------- base64 */
  function toB64(bytes) {
    var bin = '';
    var arr = new Uint8Array(bytes);
    for (var i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    if (typeof btoa === 'function') return btoa(bin);
    return Buffer.from(arr).toString('base64');
  }

  function fromB64(str) {
    if (typeof atob === 'function') {
      var bin = atob(str);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(str, 'base64'));
  }

  function randomBytes(n) {
    var b = new Uint8Array(n);
    webcrypto.getRandomValues(b);
    return b;
  }

  function encodeUtf8(s) { return new TextEncoder().encode(s); }
  function decodeUtf8(b) { return new TextDecoder().decode(b); }

  /* ------------------------------------------------------------------ keys */
  function deriveKey(passphrase, salt, iterations) {
    return subtle().importKey('raw', encodeUtf8(passphrase), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return subtle().deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: iterations || ITERATIONS, hash: 'SHA-256' },
          base,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
      });
  }

  /* ------------------------------------------------------------ encryption */
  function encryptWithKey(key, data) {
    var iv = randomBytes(12);
    var bytes = encodeUtf8(JSON.stringify(data));
    return subtle().encrypt({ name: 'AES-GCM', iv: iv }, key, bytes)
      .then(function (ct) {
        return { iv: toB64(iv), ct: toB64(ct) };
      });
  }

  function decryptWithKey(key, ivB64, ctB64) {
    return subtle().decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, key, fromB64(ctB64))
      .then(function (plain) {
        return JSON.parse(decodeUtf8(new Uint8Array(plain)));
      });
  }

  /* -------------------------------------------------------------- envelope */
  function plainEnvelope(data) {
    return { app: APP, v: VERSION, enc: false, data: data };
  }

  function sealedEnvelope(saltB64, iterations, sealed) {
    return {
      app: APP,
      v: VERSION,
      enc: true,
      kdf: 'PBKDF2-SHA256',
      iter: iterations,
      salt: saltB64,
      iv: sealed.iv,
      ct: sealed.ct
    };
  }

  /* Create a brand new encrypted envelope, generating a fresh salt.
     Returns { envelope, key, salt, iter } so the caller can keep the derived
     key for the rest of the session instead of re-deriving on every save. */
  function seal(data, passphrase, iterations) {
    var iter = iterations || ITERATIONS;
    var salt = randomBytes(16);
    return deriveKey(passphrase, salt, iter).then(function (key) {
      return encryptWithKey(key, data).then(function (sealedParts) {
        return {
          envelope: sealedEnvelope(toB64(salt), iter, sealedParts),
          key: key,
          salt: toB64(salt),
          iter: iter
        };
      });
    });
  }

  /* Re-seal existing data with a key already derived this session. */
  function reseal(data, key, saltB64, iterations) {
    return encryptWithKey(key, data).then(function (sealedParts) {
      return sealedEnvelope(saltB64, iterations, sealedParts);
    });
  }

  function isEnvelope(obj) {
    return !!obj && typeof obj === 'object' && obj.app === APP && typeof obj.enc === 'boolean';
  }

  function isEncrypted(obj) {
    return isEnvelope(obj) && obj.enc === true;
  }

  /* Open an envelope. Unencrypted envelopes ignore the passphrase.
     Returns { data, key, salt, iter } so callers get the session key back. */
  function unseal(envelope, passphrase) {
    if (!isEnvelope(envelope)) return Promise.reject(new Error('Not a Dojo file.'));
    if (!envelope.enc) {
      return Promise.resolve({ data: envelope.data, key: null, salt: null, iter: null });
    }
    if (!passphrase) return Promise.reject(new Error('This file needs a passphrase.'));
    var iter = envelope.iter || ITERATIONS;
    return deriveKey(passphrase, fromB64(envelope.salt), iter).then(function (key) {
      return decryptWithKey(key, envelope.iv, envelope.ct).then(function (data) {
        return { data: data, key: key, salt: envelope.salt, iter: iter };
      });
    }).catch(function (err) {
      /* AES-GCM authentication failure is indistinguishable from a bad
         passphrase, which is exactly what we want to report. */
      if (err && err.name === 'OperationError') throw new Error('Wrong passphrase.');
      throw err;
    });
  }

  return {
    APP: APP,
    VERSION: VERSION,
    ITERATIONS: ITERATIONS,
    toB64: toB64,
    fromB64: fromB64,
    randomBytes: randomBytes,
    deriveKey: deriveKey,
    encryptWithKey: encryptWithKey,
    decryptWithKey: decryptWithKey,
    plainEnvelope: plainEnvelope,
    seal: seal,
    reseal: reseal,
    unseal: unseal,
    isEnvelope: isEnvelope,
    isEncrypted: isEncrypted
  };
}));
