import { GenericPaymentAdapter } from './generic-payment.adapter.js';

export class CaktoPaymentAdapter extends GenericPaymentAdapter {
  constructor() {
    super({
      provider: 'cakto',
      statusKeys: ['status', 'payment_status', 'transaction.status', 'data.status'],
      idKeys: ['event_id', 'id', 'transaction_id', 'data.id', 'data.transaction_id'],
      amountKeys: ['amount', 'amount_cents', 'data.amount', 'transaction.amount'],
      tenantKeys: ['tenant_id', 'metadata.tenant_id', 'data.metadata.tenant_id'],
    });
  }
}
