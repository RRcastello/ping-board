import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, validateButton, waLink } from '../js/phone.js';

test('strips +, spaces and formatting', () => {
  assert.deepEqual(normalizePhone('+31 6 1234 5678'), { ok: true, phone: '31612345678' });
  assert.deepEqual(normalizePhone('+1 (415) 555-0100'), { ok: true, phone: '14155550100' });
  assert.deepEqual(normalizePhone(' 44.20.7946.0958 '), { ok: true, phone: '442079460958' });
});

test('strips leading 00', () => {
  assert.deepEqual(normalizePhone('0031612345678'), { ok: true, phone: '31612345678' });
});

test('rejects numbers starting with 0 (no country code)', () => {
  const r = normalizePhone('0612345678');
  assert.equal(r.ok, false);
  assert.match(r.error, /country code/);
  assert.equal(normalizePhone('+0612345678').ok, false);
});

test('enforces 8 to 15 digits', () => {
  assert.equal(normalizePhone('+3161234').ok, false); // 7
  assert.equal(normalizePhone('+31612345').ok, true); // 8
  assert.equal(normalizePhone('+123456789012345').ok, true); // 15
  assert.equal(normalizePhone('+1234567890123456').ok, false); // 16
});

test('rejects letters and empty input', () => {
  assert.equal(normalizePhone('+31 6 CALL ME').ok, false);
  assert.equal(normalizePhone('').ok, false);
  assert.equal(normalizePhone(null).ok, false);
});

test('validateButton requires label, number and message', () => {
  const r = validateButton({ label: ' ', phone: '', message: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.label && r.errors.phone && r.errors.message);
  assert.equal(r.errors.contact_name, undefined);
});

test('validateButton returns cleaned values', () => {
  const r = validateButton({ label: ' On my way ', contact_name: '', phone: '+31 6 12345678', message: ' Hi! ' });
  assert.deepEqual(r.value, { label: 'On my way', contact_name: null, phone: '31612345678', message: 'Hi!' });
});

test('waLink url-encodes the message', () => {
  assert.equal(
    waLink('31612345678', 'On my way & 10 min? 👍'),
    'https://wa.me/31612345678?text=On%20my%20way%20%26%2010%20min%3F%20%F0%9F%91%8D',
  );
});
