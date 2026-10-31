import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessSecurityHeaders, unauthorizedHosts } from '@core/security';

const PROTECTED = {
  'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

describe('assessSecurityHeaders', () => {
  it('recognizes a response that declares all protections', () => {
    assert.deepEqual(assessSecurityHeaders(PROTECTED), {
      framingBlocked: true,
      inlineScriptBlocked: true,
      contentSniffingBlocked: true,
      referrerLimited: true,
    });
  });

  it('reports every protection as missing when no headers are sent', () => {
    assert.deepEqual(assessSecurityHeaders({}), {
      framingBlocked: false,
      inlineScriptBlocked: false,
      contentSniffingBlocked: false,
      referrerLimited: false,
    });
  });

  it('treats unsafe-inline as allowed unless a nonce or hash is present', () => {
    const inline = { 'Content-Security-Policy': "script-src 'self' 'unsafe-inline'" };
    assert.equal(assessSecurityHeaders(inline).inlineScriptBlocked, false);
    const nonce = { 'Content-Security-Policy': "script-src 'unsafe-inline' 'nonce-abc'" };
    assert.equal(assessSecurityHeaders(nonce).inlineScriptBlocked, true);
    const scriptOverridesDefault = {
      'content-security-policy': "default-src 'self'; script-src * 'unsafe-inline'",
    };
    assert.equal(assessSecurityHeaders(scriptOverridesDefault).inlineScriptBlocked, false);
  });

  it('accepts X-Frame-Options only when frame-ancestors is absent', () => {
    assert.equal(assessSecurityHeaders({ 'X-Frame-Options': 'deny' }).framingBlocked, true);
    const permissiveAncestors = {
      'content-security-policy': 'frame-ancestors https://partner.example.test',
      'x-frame-options': 'DENY',
    };
    assert.equal(assessSecurityHeaders(permissiveAncestors).framingBlocked, false);
  });

  it('uses the last referrer policy in a fallback list', () => {
    const fallback = { 'referrer-policy': 'unsafe-url, strict-origin-when-cross-origin' };
    assert.equal(assessSecurityHeaders(fallback).referrerLimited, true);
    assert.equal(
      assessSecurityHeaders({ 'referrer-policy': 'no-referrer, unsafe-url' }).referrerLimited,
      false,
    );
  });
});

describe('unauthorizedHosts', () => {
  it('returns the hosts that are not authorized, once each', () => {
    assert.deepEqual(
      unauthorizedHosts(
        ['http://localhost:4000/portal', 'http://localhost:4000/api', 'https://qa.example.test'],
        ['LOCALHOST'],
      ),
      ['qa.example.test'],
    );
  });

  it('authorizes subdomains through a wildcard entry but not the parent domain', () => {
    assert.deepEqual(
      unauthorizedHosts(
        ['https://api.qa.example.test', 'https://qa.example.test'],
        ['*.qa.example.test'],
      ),
      ['qa.example.test'],
    );
  });

  it('authorizes nothing when the list is empty', () => {
    assert.deepEqual(unauthorizedHosts(['http://127.0.0.1:4000'], []), ['127.0.0.1']);
  });
});
