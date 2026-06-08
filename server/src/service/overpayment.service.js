import { qboQuery } from "./qboClient.js";

// ── Account map fetch karo ──
const fetchAccountMap = async (accessToken, realmId) => {
  const res = await qboQuery(
    accessToken, realmId,
    "SELECT * FROM Account MAXRESULTS 1000"
  );
  const accounts = res?.Account || [];
  // console.log(JSON.stringify(accounts, null, 2))
  const map = {};
  for (const acc of accounts) {
    map[acc.Id] = acc.Name || acc.Id;
  }
  return map;
};

// ── AR Overpayments — Sirf Payment entity ──
export const fetchAROverpayments = async (accessToken, realmId) => {
  const results = [];

  const accountMap = await fetchAccountMap(accessToken, realmId);

  const payRes = await qboQuery(
    accessToken, realmId,
    "SELECT * FROM Payment MAXRESULTS 1000"
  );
  // console.log(
  //    JSON.stringify(payRes, null, 2)
  // );

  const payments = payRes?.Payment || [];

  for (const p of payments) {
    if (p.UnappliedAmt > 0) {
      const bankId = p.DepositToAccountRef?.value || '';
      const bankName = bankId ? (accountMap[bankId] || bankId) : '';
      results.push({
        TXN_ID: p.Id,
        REFERENCE_NO: p.PaymentRefNum || p.Id,
        TYPE: 'Payment',
        DATE: p.TxnDate || '',
        ENTITY: p.CustomerRef?.name || '',
        BANK: bankName,
        BANK_ID: bankId,
        FOREIGN_BALANCE: p.UnappliedAmt || 0,
        CURRENCY: p.CurrencyRef?.value || 'USD',
        EXCHANGE: p.ExchangeRate || 1,

      });
    }
  }

  console.log(`✅ AR Overpayments fetched: ${results.length}`);
  return results;
};

// ── AP Overpayments — Sirf BillPayment entity ──
export const fetchAPOverpayments = async (accessToken, realmId) => {
  const results = [];

  const accountMap = await fetchAccountMap(accessToken, realmId);

  const bpRes = await qboQuery(
    accessToken, realmId,
    "SELECT * FROM BillPayment MAXRESULTS 1000"
  );
  const billPayments = bpRes?.BillPayment || [];

  for (const bp of billPayments) {
    if (bp.UnappliedAmt > 0) {
      const bankId = bp.CheckPayment?.BankAccountRef?.value || '';
      const bankName = bankId ? (accountMap[bankId] || bankId) : '';

      results.push({
        TXN_ID: bp.Id,
        REFERENCE_NO: bp.DocNumber || bp.Id,
        TYPE: 'BillPayment',
        DATE: bp.TxnDate || '',
        ENTITY: bp.VendorRef?.name || '',
        BANK: bankName,
        BANK_ID: bankId,              // ← Add karo
        OPEN_BALANCE: bp.UnappliedAmt || 0,
        CURRENCY: bp.CurrencyRef?.value || 'USD',
        EXCHANGE: bp.ExchangeRate || 1,
      });
    }
  }

  console.log(`✅ AP Overpayments fetched: ${results.length}`);
  return results;
};

// ── Backward compatibility ──
export const fetchOverpayments = async (accessToken, realmId) => {
  const ar = await fetchAROverpayments(accessToken, realmId);
  const ap = await fetchAPOverpayments(accessToken, realmId);
  return [...ar, ...ap];
};