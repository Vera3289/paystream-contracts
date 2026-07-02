const {
  buildStreamWizardPreview,
  createApprovalRequest,
  approveApprovalRequest,
  rejectApprovalRequest,
  overrideApprovalRequest,
} = require('../services/streamWorkflowService');

describe('stream wizard preview', () => {
  it('returns a valid preview and fee estimate for a complete form', () => {
    const preview = buildStreamWizardPreview({
      recipient: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      token: 'USDC',
      amount: '250000',
      balance: '1000000',
      durationPreset: 'monthly',
      customDurationDays: 30,
      hardStopEnabled: true,
      hardStopDate: '2026-12-31',
      requireApproval: true,
    });

    expect(preview.valid).toBe(true);
    expect(preview.errors).toEqual([]);
    expect(preview.estimation.estimatedFee).toBeGreaterThan(0);
    expect(preview.estimation.simulation).toContain('Ready');
  });

  it('flags over-budget amounts with a helpful message', () => {
    const preview = buildStreamWizardPreview({
      recipient: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      token: 'USDC',
      amount: '1000001',
      balance: '1000000',
      durationPreset: 'weekly',
      customDurationDays: 7,
      hardStopEnabled: false,
      hardStopDate: '',
      requireApproval: false,
    });

    expect(preview.valid).toBe(false);
    expect(preview.errors).toContain('Amount exceeds your available balance.');
  });
});

describe('approval workflow', () => {
  it('moves to approved after enough approvers sign off', () => {
    const request = createApprovalRequest({
      title: 'Create stream',
      requestedBy: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      approvers: ['GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHA', 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHB'],
      requiredApprovals: 2,
    });

    const afterFirst = approveApprovalRequest(request.id, 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHA');
    expect(afterFirst.status).toBe('pending');

    const afterSecond = approveApprovalRequest(request.id, 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHB');
    expect(afterSecond.status).toBe('approved');
    expect(afterSecond.auditTrail).toHaveLength(3);
  });

  it('supports rejection and override decisions', () => {
    const request = createApprovalRequest({
      title: 'Create stream',
      requestedBy: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      approvers: ['GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHA'],
      requiredApprovals: 1,
    });

    const rejected = rejectApprovalRequest(request.id, 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHA', 'Risky recipient');
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('Risky recipient');

    const overridden = overrideApprovalRequest(request.id, 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHC', 'Manual override for urgent payroll');
    expect(overridden.status).toBe('overridden');
    expect(overridden.overrideReason).toBe('Manual override for urgent payroll');
  });
});
