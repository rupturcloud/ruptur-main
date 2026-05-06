import { GenericPaymentAdapter } from './generic-payment.adapter.js';

export class GetnetPaymentAdapter extends GenericPaymentAdapter {
  constructor() {
    super({
      provider: 'getnet',
      statusKeys: ['status', 'payment_status', 'payment.status', 'transaction.status'],
      idKeys: ['event_id', 'payment_id', 'transaction_id', 'order_id', 'payment.id'],
      amountKeys: ['amount', 'amount_cents', 'payment.amount', 'transaction.amount'],
      tenantKeys: ['tenant_id', 'metadata.tenant_id', 'seller.metadata.tenant_id'],
    });
  }
}
