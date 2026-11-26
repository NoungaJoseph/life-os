import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPrivacyHtml, renderTermsHtml } from './legal.routes';

test('legal pages render store-compliant privacy policy and terms of use', () => {
  const privacy = renderPrivacyHtml();
  assert.ok(privacy.includes('MY LIFE OS'));
  assert.ok(privacy.includes('Accessibility Service'));
  assert.ok(privacy.includes('Delete your account'));

  const terms = renderTermsHtml();
  assert.ok(terms.includes('MY LIFE OS'));
  assert.ok(terms.includes('Terms of Use'));
});
