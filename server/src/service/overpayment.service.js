// import { qboQuery, qboClient } from "./qboClient.js";


// const fetchAllRecords = async (
//   accessToken,
//   realmId,
//   entity
// ) => {
//   let allRecords = [];
//   let startPosition = 1;
//   const pageSize = 1000;

//   while (true) {
//     const query =
//       `SELECT * FROM ${entity}
//        MAXRESULTS ${pageSize}
//        STARTPOSITION ${startPosition}`;

//     const res =
//       await qboQuery(
//         accessToken,
//         realmId,
//         query
//       );

//     const records =
//       res?.[entity] || [];

//     allRecords = [
//       ...allRecords,
//       ...records
//     ];

//     if (records.length < pageSize)
//       break;

//     startPosition += pageSize;
//   }

//   return allRecords;
// };

// const fetchAccountMap = async (
//   accessToken,
//   realmId
// ) => {

//   const accounts =
//     await fetchAllRecords(
//       accessToken,
//       realmId,
//       "Account"
//     );

//   const map = {};

//   for (const acc of accounts) {
//     map[acc.Id] =
//       acc.Name || acc.Id;
//   }

//   return map;
// };




// export const fetchAROverpayments = async (accessToken, realmId, startDate, endDate) => {
//   const results = [];

//   let dateFilter = '';
//   if (startDate && endDate) {
//     dateFilter = ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
//   } else if (startDate) {
//     dateFilter = ` WHERE TxnDate >= '${startDate}'`;
//   } else if (endDate) {
//     dateFilter = ` WHERE TxnDate <= '${endDate}'`;
//   }

//   let allPayments = [];
//   let startPosition = 1;
//   const pageSize = 1000;

//   while (true) {
//     const query = `SELECT * FROM Payment${dateFilter} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
//     const res = await qboQuery(accessToken, realmId, query);
//     const records = res?.Payment || [];
//     allPayments = [...allPayments, ...records];
//     if (records.length < pageSize) break;
//     startPosition += pageSize;
//   }

//   console.log(`Total Payments: ${allPayments.length}`);

//   for (const p of allPayments) {
//     if (p.UnappliedAmt > 0) {
//       const bankId = p.DepositToAccountRef?.value || '';
//       results.push({
//         TXN_ID:          p.Id,
//         REFERENCE_NO:    p.PaymentRefNum || p.Id,
//         TYPE:            'Payment',
//         DATE:            p.TxnDate       || '',
//         ENTITY:          p.CustomerRef?.name || '',
//         BANK:            p.DepositToAccountRef?.name || '',
//         BANK_ID:         bankId,
//         FOREIGN_BALANCE: p.UnappliedAmt  || 0,
//         CURRENCY:        p.CurrencyRef?.value || '',
//         EXCHANGE:        p.ExchangeRate   || 1,
//       });
//     }
//   }

//   console.log(`✅ AR Overpayments fetched: ${results.length}`);
//   return results;
// };


// // ✅ fetchAPOverpayments mein date filter add karo
// export const fetchAPOverpayments = async (accessToken, realmId, startDate, endDate) => {
//   const results = [];
//   const client = qboClient(accessToken, realmId);

//   let dateFilter = '';
//   if (startDate && endDate) {
//     dateFilter = ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
//   } else if (startDate) {
//     dateFilter = ` WHERE TxnDate >= '${startDate}'`;
//   } else if (endDate) {
//     dateFilter = ` WHERE TxnDate <= '${endDate}'`;
//   }

//   let allBillPayments = [];
//   let startPosition = 1;
//   const pageSize = 1000;

//   while (true) {
//     const query = `SELECT * FROM BillPayment${dateFilter} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
//     const res = await qboQuery(accessToken, realmId, query);
//     const records = res?.BillPayment || [];
//     allBillPayments = [...allBillPayments, ...records];
//     if (records.length < pageSize) break;
//     startPosition += pageSize;
//   }

//   console.log(`✅ BillPayments fetched: ${allBillPayments.length}`);

//   for (const bp of allBillPayments) {
//     try {
//       const res  = await client.get(`/billpayment/${bp.Id}?minorversion=75`);
//       const full = res.data?.BillPayment || {};

//       const totalAmt = Number(full.TotalAmt) || 0;
//       const lines = full.Line || [];
//       let appliedAmt = 0;

//       for (const line of lines) {
//         for (const lt of (line.LinkedTxn || [])) {
//           if (lt.TxnType === 'Bill') {
//             appliedAmt += Number(line.Amount) || 0;
//           }
//         }
//       }

//       const unappliedAmt = parseFloat((totalAmt - appliedAmt).toFixed(2));
//       const payType  = full.PayType || '';
//       let bankName   = '';
//       let bankId     = '';

//       if (payType === 'Check') {
//         bankId   = full.CheckPayment?.BankAccountRef?.value || '';
//         bankName = full.CheckPayment?.BankAccountRef?.name  || '';
//       } else if (payType === 'CreditCard') {
//         bankId   = full.CreditCardPayment?.CCAccountRef?.value || '';
//         bankName = full.CreditCardPayment?.CCAccountRef?.name  || '';
//       }

//       if (unappliedAmt > 0.01) {
//         results.push({
//           TXN_ID:       full.Id,
//           REFERENCE_NO: full.DocNumber   || full.Id,
//           TYPE:         payType          || 'BillPayment',
//           DATE:         full.TxnDate     || '',
//           ENTITY:       full.VendorRef?.name || '',
//           BANK:         bankName,
//           BANK_ID:      bankId,
//           OPEN_BALANCE: unappliedAmt,
//           CURRENCY:     full.CurrencyRef?.value || '',
//           EXCHANGE:     full.ExchangeRate || 1,
//         });
//       }
//     } catch (err) {
//       console.log(`❌ BillPayment ${bp.Id}:`, err.message);
//     }
//   }

//   console.log(`✅ AP Overpayments fetched: ${results.length}`);
//   return results;
// };









import { qboQuery, qboClient } from './qboClient.js';
import {
  getPaymentsFromCache,
  savePaymentsToCache,
  getEntityFromCache,
  saveEntityToCache,
} from '../config/database.js';

// ── AR Overpayments ──
export const fetchAROverpayments = async (accessToken, realmId, startDate, endDate) => {
  const results = [];

  let allPayments = [];

  if (!startDate && !endDate) {
    // ✅ Cache check
    const cached = await getPaymentsFromCache(realmId);
    if (cached.length > 0) {
      console.log(`⚡ ${cached.length} payments from MongoDB cache (AR)`);
      allPayments = cached;
    } else {
      // Cache miss — QBO se fetch karo
      let startPosition = 1;
      const pageSize = 1000;
      while (true) {
        const query = `SELECT * FROM Payment MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
        const res = await qboQuery(accessToken, realmId, query);
        const records = res?.Payment || [];
        allPayments = [...allPayments, ...records];
        if (records.length < pageSize) break;
        startPosition += pageSize;
      }
      await savePaymentsToCache(realmId, allPayments);
    }
  } else {
    // Date filter hai — directly fetch
    const conditions = [];
    if (startDate) conditions.push(`TxnDate >= '${startDate}'`);
    if (endDate)   conditions.push(`TxnDate <= '${endDate}'`);
    const whereClause = ` WHERE ${conditions.join(' AND ')}`;

    let startPosition = 1;
    const pageSize = 1000;
    while (true) {
      const query = `SELECT * FROM Payment${whereClause} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
      const res = await qboQuery(accessToken, realmId, query);
      const records = res?.Payment || [];
      allPayments = [...allPayments, ...records];
      if (records.length < pageSize) break;
      startPosition += pageSize;
    }
  }

  console.log(`Total Payments: ${allPayments.length}`);

  for (const p of allPayments) {
    if (Number(p.UnappliedAmt) > 0) {
      results.push({
        TXN_ID:          p.Id,
        REFERENCE_NO:    p.PaymentRefNum        || p.Id,
        TYPE:            'Payment',
        DATE:            p.TxnDate              || '',
        ENTITY:          p.CustomerRef?.name    || '',
        BANK:            p.DepositToAccountRef?.name  || '',
        BANK_ID:         p.DepositToAccountRef?.value || '',
        FOREIGN_BALANCE: p.UnappliedAmt         || 0,
        CURRENCY:        p.CurrencyRef?.value   || '',
        EXCHANGE:        p.ExchangeRate          || 1,
      });
    }
  }

  console.log(`✅ AR Overpayments fetched: ${results.length}`);
  return results;
};

// ── AP Overpayments ──
export const fetchAPOverpayments = async (accessToken, realmId, startDate, endDate) => {
  const results = [];
  const client = qboClient(accessToken, realmId);

  // BillPayment fetch karo
  let allBillPayments = [];

  if (!startDate && !endDate) {
    // ✅ Cache check — BillPayment cache reuse karo
    const { BillPaymentCache, CACHE_TTL_MS } = await import('../config/database.js');
    const cutoff = new Date(Date.now() - CACHE_TTL_MS);
    const cached = await BillPaymentCache.find({
      realmId, fetchedAt: { $gt: cutoff },
    }).lean();

    if (cached.length > 0) {
      console.log(`⚡ ${cached.length} bill payments from MongoDB cache (AP)`);
      allBillPayments = cached.map(d => d.data);
    } else {
      let startPosition = 1;
      const pageSize = 1000;
      while (true) {
        const query = `SELECT * FROM BillPayment MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
        const res = await qboQuery(accessToken, realmId, query);
        const records = res?.BillPayment || [];
        allBillPayments = [...allBillPayments, ...records];
        if (records.length < pageSize) break;
        startPosition += pageSize;
      }

      // Cache mein save karo
      const { saveBillPaymentsToCache } = await import('../config/database.js');
      await saveBillPaymentsToCache(realmId, allBillPayments);
    }
  } else {
    const conditions = [];
    if (startDate) conditions.push(`TxnDate >= '${startDate}'`);
    if (endDate)   conditions.push(`TxnDate <= '${endDate}'`);
    const whereClause = ` WHERE ${conditions.join(' AND ')}`;

    let startPosition = 1;
    const pageSize = 1000;
    while (true) {
      const query = `SELECT * FROM BillPayment${whereClause} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
      const res = await qboQuery(accessToken, realmId, query);
      const records = res?.BillPayment || [];
      allBillPayments = [...allBillPayments, ...records];
      if (records.length < pageSize) break;
      startPosition += pageSize;
    }
  }

  console.log(`✅ BillPayments fetched: ${allBillPayments.length}`);

  for (const bp of allBillPayments) {
    try {
      // ✅ BillPayment detail cache check
      const cacheKey = `BillPaymentDetail_${bp.Id}`;
      let full = await getEntityFromCache(cacheKey, realmId);

      if (!full) {
        const res = await client.get(`/billpayment/${bp.Id}?minorversion=75`);
        full = res.data?.BillPayment || {};
        await saveEntityToCache(cacheKey, realmId, full);
      }

      const totalAmt = Number(full.TotalAmt) || 0;
      const lines = full.Line || [];
      let appliedAmt = 0;

      for (const line of lines) {
        for (const lt of (line.LinkedTxn || [])) {
          if (lt.TxnType === 'Bill') {
            appliedAmt += Number(line.Amount) || 0;
          }
        }
      }

      const unappliedAmt = parseFloat((totalAmt - appliedAmt).toFixed(2));
      const payType = full.PayType || '';
      let bankName  = '';
      let bankId    = '';

      if (payType === 'Check') {
        bankId   = full.CheckPayment?.BankAccountRef?.value || '';
        bankName = full.CheckPayment?.BankAccountRef?.name  || '';
      } else if (payType === 'CreditCard') {
        bankId   = full.CreditCardPayment?.CCAccountRef?.value || '';
        bankName = full.CreditCardPayment?.CCAccountRef?.name  || '';
      }

      if (unappliedAmt > 0.01) {
        results.push({
          TXN_ID:       full.Id,
          REFERENCE_NO: full.DocNumber        || full.Id,
          TYPE:         payType               || 'BillPayment',
          DATE:         full.TxnDate          || '',
          ENTITY:       full.VendorRef?.name  || '',
          BANK:         bankName,
          BANK_ID:      bankId,
          OPEN_BALANCE: unappliedAmt,
          CURRENCY:     full.CurrencyRef?.value || '',
          EXCHANGE:     full.ExchangeRate      || 1,
        });
      }

    } catch (err) {
      console.log(`❌ BillPayment ${bp.Id}:`, err.message);
    }
  }

  console.log(`✅ AP Overpayments fetched: ${results.length}`);
  return results;
};