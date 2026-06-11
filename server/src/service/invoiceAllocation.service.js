


// import { qboQuery, qboClient } from './qboClient.js';

// // Date filter ke saath fetchAllRecords
// // const fetchAllRecords = async (accessToken, realmId, entity, startDate, endDate) => {
// //   let allRecords = [];
// //   let startPosition = 1;
// //   const pageSize = 1000;

// //   // Date filter clause
// //   let dateFilter = '';
// //   if (startDate && endDate) {
// //     dateFilter = ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
// //   } else if (startDate) {
// //     dateFilter = ` WHERE TxnDate >= '${startDate}'`;
// //   } else if (endDate) {
// //     dateFilter = ` WHERE TxnDate <= '${endDate}'`;
// //   }

// //   while (true) {
// //     const query = `SELECT * FROM ${entity}${dateFilter} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
// //     const res = await qboQuery(accessToken, realmId, query);
// //     const records = res?.[entity] || [];
// //     allRecords = [...allRecords, ...records];
// //     if (records.length < pageSize) break;
// //     startPosition += pageSize;
// //   }
// //   return allRecords;
// // };

// const fetchAllRecords = async (accessToken, realmId, entity, startDate, endDate) => {
//   let allRecords = [];
//   let startPosition = 1;
//   const pageSize = 1000;

//   let whereClause = '';
//   const conditions = [];

//   // Date filter
//   if (startDate) conditions.push(`TxnDate >= '${startDate}'`);
//   if (endDate)   conditions.push(`TxnDate <= '${endDate}'`);

//   // ✅ Payment ke liye sirf TotalAmt = 0 wale fetch karo
//   if (entity === 'Payment') {
//     conditions.push(`TotalAmt = '0'`);
//   }

//   if (conditions.length > 0) {
//     whereClause = ` WHERE ${conditions.join(' AND ')}`;
//   }

//   while (true) {
//     const query = `SELECT * FROM ${entity}${whereClause} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
//     const res = await qboQuery(accessToken, realmId, query);
//     const records = res?.[entity] || [];
//     allRecords = [...allRecords, ...records];
//     if (records.length < pageSize) break;
//     startPosition += pageSize;
//   }

//   console.log(`✅ ${entity} fetched: ${allRecords.length}`);
//   return allRecords;
// };

// const getRefFromLineEx = (lineEx) => {
//   try {
//     const nameValues = lineEx?.any || [];
//     const refEntry = nameValues.find(nv => nv?.value?.Name === 'txnReferenceNumber');
//     return refEntry?.value?.Value || null;
//   } catch { return null; }
// };

// const getOpenBalanceFromLineEx = (lineEx) => {
//   try {
//     const nameValues = lineEx?.any || [];
//     const balEntry = nameValues.find(nv => nv?.value?.Name === 'txnOpenBalance');
//     return balEntry ? parseFloat(balEntry.value.Value) : null;
//   } catch { return null; }
// };

// const fetchEntityDetails = async (accessToken, realmId, txnId, txnType) => {
//   try {
//     const client = qboClient(accessToken, realmId);
//     let endpoint = '';
//     if (txnType === 'CreditMemo') endpoint = `/creditmemo/${txnId}`;
//     else if (txnType === 'Invoice') endpoint = `/invoice/${txnId}`;
//     else if (txnType === 'JournalEntry') endpoint = `/journalentry/${txnId}`;
//     else if (txnType === 'Deposit') endpoint = `/deposit/${txnId}`;
//     else if (txnType === 'Purchase') endpoint = `/purchase/${txnId}`;
//     else if (txnType === 'Check') endpoint = `/purchase/${txnId}`;
//     else return { docNumber: txnId, txnDate: '', totalAmt: '' };

//     const res = await client.get(`${endpoint}?minorversion=75`);
//     const entity = res.data?.CreditMemo
//       || res.data?.Invoice
//       || res.data?.JournalEntry
//       || res.data?.Deposit
//       || res.data?.Purchase
//       || {};

//     let totalAmt = entity.TotalAmt || entity.TotalAmount || '';
//     if (txnType === 'JournalEntry' && !totalAmt) {
//       const lines = entity.Line || [];
//       totalAmt = lines
//         .filter(l => l.JournalEntryLineDetail?.PostingType === 'Credit')
//         .reduce((sum, l) => sum + (l.Amount || 0), 0) || '';
//     }

//     return {
//       docNumber: entity.DocNumber || txnId,
//       txnDate: entity.TxnDate || '',
//       totalAmt: totalAmt,
//     };
//   } catch (err) {
//     console.log(`❌ Error fetching ${txnType} ${txnId}:`, err.message);
//     return { docNumber: txnId, txnDate: '', totalAmt: '' };
//   }
// };

// // ── Priority — CreditMemo highest, Invoice lowest ──
// const SOURCE_PRIORITY = {
//   'CreditMemo': 10,
//   'CreditCardCredit': 5,
//   'JournalEntry': 5,
//   'Deposit': 5,
//   'Purchase': 3,
//   'Check': 5,
//   'Invoice': 1,  // Invoice hamesha linked (receiving) side
// };

// const getPriority = (txnType) => SOURCE_PRIORITY[txnType] ?? 2;

// export const fetchInvoiceAllocations = async (accessToken, realmId, startDate, endDate) => {
//   const results = [];
//   const entityCache = {};
//   const client = qboClient(accessToken, realmId);

//   const getEntityDetails = async (txnId, txnType) => {
//     const key = `${txnType}_${txnId}`;
//     if (!entityCache[key]) {
//       entityCache[key] = await fetchEntityDetails(accessToken, realmId, txnId, txnType);
//     }
//     return entityCache[key];
//   };

//   const payments = await fetchAllRecords(accessToken, realmId, 'Payment', startDate, endDate);
//   console.log(`✅ Payments fetched: ${payments.length}`);

//   for (const payment of payments) {

//     // Full payment fetch karo
//     let fullPayment = {};

//     try {
//       const paymentRes = await client.get(
//         `/payment/${payment.Id}?minorversion=75`
//       );

//       fullPayment = paymentRes.data?.Payment || {};

//       if (payment.Id == 25427) {
//         console.log(
//           JSON.stringify(fullPayment, null, 2)
//         );
//       }

//       const amountReceived =
//         Number(fullPayment.TotalAmt || 0);

//       // Amount Received > 0 hai to skip
//       if (amountReceived > 0) {
//         console.log(
//           `⏭ Skipping Payment ${payment.Id} | Amount Received = ${amountReceived}`
//         );
//         continue;
//       }

//     } catch (err) {
//       console.log(
//         `❌ Payment ${payment.Id} detail fetch error:`,
//         err.message
//       );
//       continue;
//     }


//     const lines = payment.Line || [];
//     // ── Unique txns collect karo ──
//     const seenIds = new Set();
//     const uniqueLines = [];
//     for (const line of lines) {
//       for (const txn of (line.LinkedTxn || [])) {
//         if (!seenIds.has(txn.TxnId)) {
//           seenIds.add(txn.TxnId);
//           uniqueLines.push({ line, txn });
//         }
//       }
//     }

//     if (uniqueLines.length === 0) continue;

//     // ── Single txn — skip (koi allocation nahi) ──
//     if (uniqueLines.length === 1) continue;

//     const hasAllocationTxn = (lines) => {
//       return lines.some(
//         ({ txn }) => txn.TxnType !== 'Invoice'
//       );
//     };

//     if (!hasAllocationTxn(uniqueLines)) {
//       console.log(
//         `⏭ Skipping Payment ${payment.Id} - only Invoice links found`
//       );
//       continue;
//     }

//     // ── Multiple txns — Priority se source/linked separate karo ──
//     const sorted = [...uniqueLines].sort((a, b) => a.line.Amount - b.line.Amount);
//     const totalAmt = sorted.reduce((sum, e) => sum + e.line.Amount, 0);
//     const half = totalAmt / 2;

//     let runningSum = 0;
//     const group1 = [];
//     const group2 = [];

//     for (const entry of sorted) {
//       runningSum += entry.line.Amount;
//       if (runningSum <= half + 0.01) {
//         group1.push(entry);
//       } else {
//         group2.push(entry);
//       }
//     }

//     // CreditMemo wala group = source
//     const hasCM = (group) =>
//       group.some(
//         e => e.txn.TxnType === 'CreditMemo'
//       );

//     //Ye change invoice allocation ko aur accurate bana dega.
//     // const hasCM = (group) =>
//     //   group.some(
//     //     e =>
//     //       e.txn.TxnType === 'CreditMemo' ||
//     //       e.txn.TxnType === 'CreditCardCredit'
//     //   );

//     let sourceGroup, linkedGroup;
//     if (hasCM(group1)) {
//       sourceGroup = group1;
//       linkedGroup = group2;
//     } else if (hasCM(group2)) {
//       sourceGroup = group2;
//       linkedGroup = group1;
//     } else {
//       // No CreditMemo — priority se decide karo
//       const maxP1 = Math.max(...group1.map(e => getPriority(e.txn.TxnType)));
//       const maxP2 = Math.max(...group2.map(e => getPriority(e.txn.TxnType)));
//       if (maxP2 >= maxP1) {
//         sourceGroup = group2;
//         linkedGroup = group1;
//       } else {
//         sourceGroup = group1;
//         linkedGroup = group2;
//       }
//     }

//     // ── Case 1: Source + Linked dono hain ──
//     if (sourceGroup.length > 0 && linkedGroup.length > 0) {
//       for (const sEntry of sourceGroup) {
//         const sRef = await getEntityDetails(sEntry.txn.TxnId, sEntry.txn.TxnType);
//         const sRefNo = getRefFromLineEx(sEntry.line.LineEx) || sRef?.docNumber || sEntry.txn.TxnId;

//         for (const lEntry of linkedGroup) {
//           const lRef = await getEntityDetails(lEntry.txn.TxnId, lEntry.txn.TxnType);
//           const lRefNo = getRefFromLineEx(lEntry.line.LineEx) || lRef?.docNumber || lEntry.txn.TxnId;

//           // Smart amount logic
//           const appliedAmount = sourceGroup.length > linkedGroup.length
//             ? (getOpenBalanceFromLineEx(sEntry.line.LineEx) ?? sEntry.line.Amount)
//             : (getOpenBalanceFromLineEx(lEntry.line.LineEx) ?? lEntry.line.Amount);

//           results.push({
//             PAYMENT_ID: payment.Id,
//             REFERENCE_NO: payment.PaymentRefNum || payment.Id,
//             NAME: payment.CustomerRef?.name || '',
//             ALLOCATION_DATE: payment.TxnDate || '',
//             CREDIT_NOTE_ID: sEntry.txn.TxnId,
//             CREDIT_NOTE_NO: sRefNo,
//             LINKED_REF_NO: lRefNo,
//             LINKED_TXN_ID: lEntry.txn.TxnId,
//             APPLIED_AMOUNT: appliedAmount,
//             CREDIT_LINK_TYPE: sEntry.txn.TxnType,  // CreditMemo/JournalEntry/etc
//             LINKED_TYPE: lEntry.txn.TxnType,  // Invoice/Purchase/Deposit/etc

//           });
//         }
//       }
//     }

//     // ── Case 2: Same priority — har txn alag row ──
//     else {
//       for (const { line, txn } of uniqueLines) {
//         const ref = await getEntityDetails(txn.TxnId, txn.TxnType);
//         const refNo = getRefFromLineEx(line.LineEx) || ref?.docNumber || txn.TxnId;

//         results.push({
//           PAYMENT_ID: payment.Id,
//           REFERENCE_NO: payment.PaymentRefNum || payment.Id,
//           NAME: payment.CustomerRef?.name || '',
//           ALLOCATION_DATE: payment.TxnDate || '',
//           CREDIT_NOTE_ID: '',
//           CREDIT_NOTE_NO: '',
//           LINKED_REF_NO: refNo,
//           LINKED_TXN_ID: txn.TxnId,
//           APPLIED_AMOUNT: getOpenBalanceFromLineEx(line.LineEx) ?? line.Amount,
//           CREDIT_LINK_TYPE: '',
//           LINKED_TYPE: txn.TxnType,
//           TOTAL: '',
//         });
//       }
//     }
//   }

//   console.log(`✅ Final invoice allocation records: ${results.length}`);
//   return results;
// };








import { qboQuery, qboClient } from './qboClient.js';
import {
  getPaymentsFromCache,
  savePaymentsToCache,
  getEntityFromCache,
  saveEntityToCache,
} from '../config/database.js';

const fetchAllRecords = async (accessToken, realmId, entity, startDate, endDate) => {
  let allRecords = [];
  let startPosition = 1;
  const pageSize = 1000;

  const conditions = [];
  if (startDate) conditions.push(`TxnDate >= '${startDate}'`);
  if (endDate)   conditions.push(`TxnDate <= '${endDate}'`);
  if (entity === 'Payment') conditions.push(`TotalAmt = '0'`);

  const whereClause = conditions.length > 0
    ? ` WHERE ${conditions.join(' AND ')}`
    : '';

  while (true) {
    const query = `SELECT * FROM ${entity}${whereClause} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
    const res = await qboQuery(accessToken, realmId, query);
    const records = res?.[entity] || [];
    allRecords = [...allRecords, ...records];
    if (records.length < pageSize) break;
    startPosition += pageSize;
  }

  console.log(`✅ ${entity} fetched: ${allRecords.length}`);
  return allRecords;
};

const getRefFromLineEx = (lineEx) => {
  try {
    const nameValues = lineEx?.any || [];
    const refEntry = nameValues.find(nv => nv?.value?.Name === 'txnReferenceNumber');
    return refEntry?.value?.Value || null;
  } catch { return null; }
};

const getOpenBalanceFromLineEx = (lineEx) => {
  try {
    const nameValues = lineEx?.any || [];
    const balEntry = nameValues.find(nv => nv?.value?.Name === 'txnOpenBalance');
    return balEntry ? parseFloat(balEntry.value.Value) : null;
  } catch { return null; }
};

const fetchEntityDetails = async (accessToken, realmId, txnId, txnType) => {
  // ✅ MongoDB cache check
  const cacheKey = `${txnType}_${txnId}`;
  const cached = await getEntityFromCache(cacheKey, realmId);
  if (cached) return cached;

  try {
    const client = qboClient(accessToken, realmId);
    let endpoint = '';
    if (txnType === 'CreditMemo')        endpoint = `/creditmemo/${txnId}`;
    else if (txnType === 'Invoice')      endpoint = `/invoice/${txnId}`;
    else if (txnType === 'JournalEntry') endpoint = `/journalentry/${txnId}`;
    else if (txnType === 'Deposit')      endpoint = `/deposit/${txnId}`;
    else if (txnType === 'Purchase')     endpoint = `/purchase/${txnId}`;
    else if (txnType === 'Check')        endpoint = `/purchase/${txnId}`;
    else if (txnType === 'Expense')      endpoint = `/purchase/${txnId}`;
    else return { docNumber: txnId, txnDate: '', totalAmt: '' };

    const res = await client.get(`${endpoint}?minorversion=75`);
    const entity = res.data?.CreditMemo
                || res.data?.Invoice
                || res.data?.JournalEntry
                || res.data?.Deposit
                || res.data?.Purchase
                || {};

    let totalAmt = entity.TotalAmt || entity.TotalAmount || '';
    if (txnType === 'JournalEntry' && !totalAmt) {
      const lines = entity.Line || [];
      totalAmt = lines
        .filter(l => l.JournalEntryLineDetail?.PostingType === 'Credit')
        .reduce((sum, l) => sum + (l.Amount || 0), 0) || '';
    }

    const result = {
      docNumber: entity.DocNumber || txnId,
      txnDate:   entity.TxnDate   || '',
      totalAmt:  totalAmt,
    };

    // ✅ MongoDB mein save karo
    await saveEntityToCache(cacheKey, realmId, result);
    return result;

  } catch (err) {
    console.log(`❌ Error fetching ${txnType} ${txnId}:`, err.message);
    return { docNumber: txnId, txnDate: '', totalAmt: '' };
  }
};

const SOURCE_PRIORITY = {
  'CreditMemo':       10,
  'CreditCardCredit':  5,
  'JournalEntry':      5,
  'Deposit':           5,
  'Purchase':          3,
  'Check':             5,
  'Invoice':           1,
};
const getPriority = (txnType) => SOURCE_PRIORITY[txnType] ?? 2;

export const fetchInvoiceAllocations = async (accessToken, realmId, startDate, endDate) => {
  const results = [];
  const entityCache = {};

  const getEntityDetails = async (txnId, txnType) => {
    const key = `${txnType}_${txnId}`;
    if (!entityCache[key]) {
      entityCache[key] = await fetchEntityDetails(accessToken, realmId, txnId, txnType);
    }
    return entityCache[key];
  };

  // ✅ Cache logic
  let payments = [];
  if (!startDate && !endDate) {
    const cached = await getPaymentsFromCache(realmId);
    if (cached.length > 0) {
      console.log(`⚡ ${cached.length} payments from MongoDB cache`);
      payments = cached;
    } else {
      payments = await fetchAllRecords(accessToken, realmId, 'Payment', null, null);
      await savePaymentsToCache(realmId, payments);
    }
  } else {
    payments = await fetchAllRecords(accessToken, realmId, 'Payment', startDate, endDate);
  }

  console.log(`✅ Payments to process: ${payments.length}`);

  for (const payment of payments) {
    const lines = payment.Line || [];

    const seenIds = new Set();
    const uniqueLines = [];
    for (const line of lines) {
      for (const txn of (line.LinkedTxn || [])) {
        if (!seenIds.has(txn.TxnId)) {
          seenIds.add(txn.TxnId);
          uniqueLines.push({ line, txn });
        }
      }
    }

    if (uniqueLines.length === 0) continue;
    if (uniqueLines.length === 1) continue;

    const hasNonInvoice = uniqueLines.some(({ txn }) => txn.TxnType !== 'Invoice');
    if (!hasNonInvoice) continue;

    const sorted = [...uniqueLines].sort((a, b) => a.line.Amount - b.line.Amount);
    const totalAmt = sorted.reduce((sum, e) => sum + e.line.Amount, 0);
    const half = totalAmt / 2;

    let runningSum = 0;
    const group1 = [], group2 = [];

    for (const entry of sorted) {
      runningSum += entry.line.Amount;
      if (runningSum <= half + 0.01) group1.push(entry);
      else group2.push(entry);
    }

    const hasCM = (group) => group.some(e => e.txn.TxnType === 'CreditMemo');

    let sourceGroup, linkedGroup;
    if (hasCM(group1))      { sourceGroup = group1; linkedGroup = group2; }
    else if (hasCM(group2)) { sourceGroup = group2; linkedGroup = group1; }
    else {
      const maxP1 = Math.max(...group1.map(e => getPriority(e.txn.TxnType)));
      const maxP2 = Math.max(...group2.map(e => getPriority(e.txn.TxnType)));
      if (maxP2 >= maxP1) { sourceGroup = group2; linkedGroup = group1; }
      else                 { sourceGroup = group1; linkedGroup = group2; }
    }

    if (sourceGroup.length > 0 && linkedGroup.length > 0) {
      for (const sEntry of sourceGroup) {
        const sRef   = await getEntityDetails(sEntry.txn.TxnId, sEntry.txn.TxnType);
        const sRefNo = getRefFromLineEx(sEntry.line.LineEx) || sRef?.docNumber || sEntry.txn.TxnId;

        for (const lEntry of linkedGroup) {
          const lRef   = await getEntityDetails(lEntry.txn.TxnId, lEntry.txn.TxnType);
          const lRefNo = getRefFromLineEx(lEntry.line.LineEx) || lRef?.docNumber || lEntry.txn.TxnId;

          const appliedAmount = sourceGroup.length > linkedGroup.length
            ? (getOpenBalanceFromLineEx(sEntry.line.LineEx) ?? sEntry.line.Amount)
            : (getOpenBalanceFromLineEx(lEntry.line.LineEx) ?? lEntry.line.Amount);

          results.push({
            PAYMENT_ID:       payment.Id,
            REFERENCE_NO:     payment.PaymentRefNum || payment.Id,
            NAME:             payment.CustomerRef?.name || '',
            ALLOCATION_DATE:  payment.TxnDate || '',
            CREDIT_NOTE_ID:   sEntry.txn.TxnId,
            CREDIT_NOTE_NO:   sRefNo,
            LINKED_REF_NO:    lRefNo,
            LINKED_TXN_ID:    lEntry.txn.TxnId,
            APPLIED_AMOUNT:   appliedAmount,
            CREDIT_LINK_TYPE: sEntry.txn.TxnType,
            LINKED_TYPE:      lEntry.txn.TxnType,
          });
        }
      }
    } else {
      for (const { line, txn } of uniqueLines) {
        const ref   = await getEntityDetails(txn.TxnId, txn.TxnType);
        const refNo = getRefFromLineEx(line.LineEx) || ref?.docNumber || txn.TxnId;

        results.push({
          PAYMENT_ID:       payment.Id,
          REFERENCE_NO:     payment.PaymentRefNum || payment.Id,
          NAME:             payment.CustomerRef?.name || '',
          ALLOCATION_DATE:  payment.TxnDate || '',
          CREDIT_NOTE_ID:   '',
          CREDIT_NOTE_NO:   '',
          LINKED_REF_NO:    refNo,
          LINKED_TXN_ID:    txn.TxnId,
          APPLIED_AMOUNT:   getOpenBalanceFromLineEx(line.LineEx) ?? line.Amount,
          CREDIT_LINK_TYPE: '',
          LINKED_TYPE:      txn.TxnType,
        });
      }
    }
  }

  console.log(`✅ Final invoice allocation records: ${results.length}`);
  return results;
};