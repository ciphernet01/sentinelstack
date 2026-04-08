import test from 'node:test';
import assert from 'node:assert/strict';
import type { Finding } from '@prisma/client';
import { buildFindingSignature, computeScanDiffSummary } from './scanDiff.service';

const mkFinding = (overrides: Partial<Finding> & Pick<Finding, 'toolName' | 'title' | 'severity'>): Finding =>
  ({
    id: overrides.id || `${overrides.toolName}-${overrides.title}`,
    assessmentId: overrides.assessmentId || 'assessment-1',
    toolName: overrides.toolName,
    title: overrides.title,
    description: overrides.description || 'description',
    severity: overrides.severity,
    remediation: overrides.remediation || 'remediation',
    evidence: overrides.evidence || {},
    complianceMapping: overrides.complianceMapping || [],
    createdAt: overrides.createdAt || new Date('2026-01-01T00:00:00Z'),
    updatedAt: overrides.updatedAt || new Date('2026-01-01T00:00:00Z'),
  }) as Finding;

test('buildFindingSignature normalizes fields', () => {
  const sig = buildFindingSignature(
    mkFinding({ toolName: '  SQLI_Scanner ', title: ' SQL Injection ', severity: 'HIGH' }),
  );
  assert.equal(sig, 'sqli_scanner::sql injection::high');
});

test('computeScanDiffSummary reports new and resolved findings', () => {
  const previous = {
    id: 'baseline-1',
    completedAt: new Date('2026-03-01T10:00:00Z'),
    findings: [
      mkFinding({ toolName: 'scanner-a', title: 'Old Finding', severity: 'MEDIUM' }),
      mkFinding({ toolName: 'scanner-b', title: 'Shared Finding', severity: 'HIGH' }),
    ],
  };

  const current = [
    mkFinding({ toolName: 'scanner-b', title: 'Shared Finding', severity: 'HIGH' }),
    mkFinding({ toolName: 'scanner-c', title: 'New Finding', severity: 'CRITICAL' }),
  ];

  const diff = computeScanDiffSummary(current, previous, 10);

  assert.ok(diff);
  assert.equal(diff?.baselineAssessmentId, 'baseline-1');
  assert.equal(diff?.baselineFindingCount, 2);
  assert.equal(diff?.currentFindingCount, 2);
  assert.equal(diff?.newFindingCount, 1);
  assert.equal(diff?.resolvedFindingCount, 1);
  assert.equal(diff?.unchangedFindingCount, 1);
  assert.equal(diff?.newFindings[0].title, 'New Finding');
  assert.equal(diff?.resolvedFindings[0].title, 'Old Finding');
});

test('computeScanDiffSummary returns null without a baseline', () => {
  const diff = computeScanDiffSummary([mkFinding({ toolName: 'a', title: 'b', severity: 'LOW' })], null);
  assert.equal(diff, null);
});