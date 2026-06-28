class StreamWorkflowService {
  constructor() {
    this._requests = new Map();
  }

  buildStreamWizardPreview(input) {
    const errors = [];
    const safeAmount = Number(input.amount || 0);
    const balance = Number(input.balance || 0);

    if (!input.recipient || !/^G[A-Z0-9]{55}$/.test(input.recipient)) {
      errors.push('A valid recipient address is required.');
    }

    if (!input.token) {
      errors.push('Select a token before continuing.');
    }

    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
      errors.push('Enter a positive stream amount.');
    } else if (safeAmount > balance) {
      errors.push('Amount exceeds your available balance.');
    }

    const durationDays = input.durationPreset === 'custom'
      ? Number(input.customDurationDays || 0)
      : input.durationPreset === 'weekly'
        ? 7
        : input.durationPreset === 'monthly'
          ? 30
          : 0;

    if (!durationDays || durationDays <= 0) {
      errors.push('Choose a stream duration.');
    }

    const estimatedFee = Math.max(15000, Math.round(safeAmount * 0.001));
    const simulation = errors.length === 0
      ? 'Ready to simulate — no blockers detected.'
      : `Simulation blocked: ${errors.join(' ')}`;

    return {
      valid: errors.length === 0,
      errors,
      estimation: {
        estimatedFee,
        simulation,
        durationDays,
        hardStopEnabled: Boolean(input.hardStopEnabled),
      },
    };
  }

  createApprovalRequest({ title, requestedBy, approvers = [], requiredApprovals = 1, metadata = {} }) {
    const request = {
      id: `approval-${Date.now()}`,
      title: title || 'Pending approval',
      requestedBy,
      approvers,
      requiredApprovals,
      status: 'pending',
      deadline: metadata.deadline || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      auditTrail: [
        {
          actor: requestedBy,
          action: 'requested',
          timestamp: new Date().toISOString(),
          note: metadata.note || 'Approval requested',
        },
      ],
      notifications: approvers.map((approver) => ({
        approver,
        channel: 'email',
        sentAt: new Date().toISOString(),
      })),
      metadata,
    };

    this._requests.set(request.id, request);
    return request;
  }

  approveApprovalRequest(requestId, approver, note = 'Approved') {
    const request = this._findRequest(requestId);
    if (!request) throw new Error('Approval request not found');
    if (request.status !== 'pending') return request;

    request.auditTrail.push({ actor: approver, action: 'approved', timestamp: new Date().toISOString(), note });
    request.decisions = request.decisions || [];
    request.decisions.push({ actor: approver, action: 'approved', note });
    const approvedCount = request.auditTrail.filter((entry) => entry.action === 'approved').length;

    if (approvedCount >= request.requiredApprovals) {
      request.status = 'approved';
    }

    return request;
  }

  rejectApprovalRequest(requestId, approver, reason) {
    const request = this._findRequest(requestId);
    if (!request) throw new Error('Approval request not found');
    if (request.status !== 'pending') return request;

    request.auditTrail.push({ actor: approver, action: 'rejected', timestamp: new Date().toISOString(), note: reason });
    request.rejectionReason = reason;
    request.status = 'rejected';
    return request;
  }

  overrideApprovalRequest(requestId, actor, reason) {
    const request = this._findRequest(requestId);
    if (!request) throw new Error('Approval request not found');

    request.auditTrail.push({ actor, action: 'overridden', timestamp: new Date().toISOString(), note: reason });
    request.overrideReason = reason;
    request.overrideBy = actor;
    request.status = 'overridden';
    return request;
  }

  _findRequest(requestId) {
    return this._requests.get(requestId);
  }
}

const service = new StreamWorkflowService();

module.exports = {
  buildStreamWizardPreview: service.buildStreamWizardPreview.bind(service),
  createApprovalRequest: service.createApprovalRequest.bind(service),
  approveApprovalRequest: service.approveApprovalRequest.bind(service),
  rejectApprovalRequest: service.rejectApprovalRequest.bind(service),
  overrideApprovalRequest: service.overrideApprovalRequest.bind(service),
};
