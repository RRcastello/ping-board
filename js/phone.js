// Phone number and form validation. Pure functions, no DOM, so they can be
// tested with `node --test`.

/**
 * Turn whatever the user typed into WhatsApp's digits-only format.
 * Returns { ok: true, phone } or { ok: false, error }.
 */
export function normalizePhone(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return { ok: false, error: 'Enter a WhatsApp number.' };

  // Spaces, dashes, dots, slashes and brackets are just formatting.
  s = s.replace(/[\s\-./()]/g, '');

  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);

  if (!/^\d+$/.test(s)) {
    return { ok: false, error: 'Use digits only, e.g. +31 6 12345678.' };
  }
  if (s.startsWith('0')) {
    return {
      ok: false,
      error: 'Start with the country code instead of 0, e.g. +31 6 12345678.',
    };
  }
  if (s.length < 8 || s.length > 15) {
    return {
      ok: false,
      error: 'A number with country code has 8 to 15 digits.',
    };
  }
  return { ok: true, phone: s };
}

export function waLink(phone, message) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export const LIMITS = { label: 60, contact_name: 80, message: 1000 };

/**
 * Validate a whole button form. Returns { ok, value, errors } where errors maps
 * field name to message.
 */
export function validateButton(input) {
  const errors = {};
  const label = String(input.label ?? '').trim();
  const contact_name = String(input.contact_name ?? '').trim();
  const message = String(input.message ?? '').trim();

  if (!label) errors.label = 'Give the button a label.';
  else if (label.length > LIMITS.label) errors.label = `Keep it under ${LIMITS.label} characters.`;

  if (contact_name.length > LIMITS.contact_name) {
    errors.contact_name = `Keep it under ${LIMITS.contact_name} characters.`;
  }

  const p = normalizePhone(input.phone);
  if (!p.ok) errors.phone = p.error;

  if (!message) errors.message = 'Write the message to send.';
  else if (message.length > LIMITS.message) errors.message = `Keep it under ${LIMITS.message} characters.`;

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value: ok ? { label, contact_name: contact_name || null, phone: p.phone, message } : null,
  };
}
