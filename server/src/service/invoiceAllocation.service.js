


import { qboQuery, qboClient } from './qboClient.js';

const fetchAllRecords = async (accessToken, realmId, entity) => {
  let allRecords = [];
  let startPosition = 1;
  const pageSize = 1000;
  while (true) {
    const query = `SELECT * FROM ${entity} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
    const res = await qboQuery(accessToken, realmId, query);
    const records = res?.[entity] || [];
    allRecords = [...allRecords, ...records];
    if (records.length < pageSize) break;
    startPosition += pageSize;
  }
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
  try {
    const client = qboClient(accessToken, realmId);
    let endpoint = '';
    if (txnType === 'CreditMemo') endpoint = `/creditmemo/${txnId}`;
    else if (txnType === 'Invoice') endpoint = `/invoice/${txnId}`;
    else if (txnType === 'JournalEntry') endpoint = `/journalentry/${txnId}`;
    else if (txnType === 'Deposit') endpoint = `/deposit/${txnId}`;
    else if (txnType === 'Purchase') endpoint = `/purchase/${txnId}`;
    else if (txnType === 'Check') endpoint = `/purchase/${txnId}`;
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

    return {
      docNumber: entity.DocNumber || txnId,
      txnDate: entity.TxnDate || '',
      totalAmt: totalAmt,
    };
  } catch (err) {
    console.log(`❌ Error fetching ${txnType} ${txnId}:`, err.message);
    return { docNumber: txnId, txnDate: '', totalAmt: '' };
  }
};

// ── Priority — CreditMemo highest, Invoice lowest ──
const SOURCE_PRIORITY = {
  'CreditMemo': 10,
  'CreditCardCredit': 5,
  'JournalEntry': 5,
  'Deposit': 5,
  'Purchase': 3,
  'Check': 5,
  'Invoice': 1,  // Invoice hamesha linked (receiving) side
};

const getPriority = (txnType) => SOURCE_PRIORITY[txnType] ?? 2;

export const fetchInvoiceAllocations = async (accessToken, realmId) => {
  const results = [];
  const entityCache = {};

  const getEntityDetails = async (txnId, txnType) => {
    const key = `${txnType}_${txnId}`;
    if (!entityCache[key]) {
      entityCache[key] = await fetchEntityDetails(accessToken, realmId, txnId, txnType);
    }
    return entityCache[key];
  };

  const payments = await fetchAllRecords(accessToken, realmId, 'Payment');
  console.log(`✅ Payments fetched: ${payments.length}`);

  for (const payment of payments) {
    const lines = payment.Line || [];

    // ── Unique txns collect karo ──
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

    // ── Single txn — skip (koi allocation nahi) ──
    if (uniqueLines.length === 1) continue;

    // ── Multiple txns — Priority se source/linked separate karo ──
    const sorted = [...uniqueLines].sort((a, b) => a.line.Amount - b.line.Amount);
    const totalAmt = sorted.reduce((sum, e) => sum + e.line.Amount, 0);
    const half = totalAmt / 2;

    let runningSum = 0;
    const group1 = [];
    const group2 = [];

    for (const entry of sorted) {
      runningSum += entry.line.Amount;
      if (runningSum <= half + 0.01) {
        group1.push(entry);
      } else {
        group2.push(entry);
      }
    }

    // CreditMemo wala group = source
    const hasCM = (group) =>
      group.some(
        e => e.txn.TxnType === 'CreditMemo'
      );

    let sourceGroup, linkedGroup;
    if (hasCM(group1)) {
      sourceGroup = group1;
      linkedGroup = group2;
    } else if (hasCM(group2)) {
      sourceGroup = group2;
      linkedGroup = group1;
    } else {
      // No CreditMemo — priority se decide karo
      const maxP1 = Math.max(...group1.map(e => getPriority(e.txn.TxnType)));
      const maxP2 = Math.max(...group2.map(e => getPriority(e.txn.TxnType)));
      if (maxP2 >= maxP1) {
        sourceGroup = group2;
        linkedGroup = group1;
      } else {
        sourceGroup = group1;
        linkedGroup = group2;
      }
    }

    // ── Case 1: Source + Linked dono hain ──
    if (sourceGroup.length > 0 && linkedGroup.length > 0) {
      for (const sEntry of sourceGroup) {
        const sRef = await getEntityDetails(sEntry.txn.TxnId, sEntry.txn.TxnType);
        const sRefNo = getRefFromLineEx(sEntry.line.LineEx) || sRef?.docNumber || sEntry.txn.TxnId;

        for (const lEntry of linkedGroup) {
          const lRef = await getEntityDetails(lEntry.txn.TxnId, lEntry.txn.TxnType);
          const lRefNo = getRefFromLineEx(lEntry.line.LineEx) || lRef?.docNumber || lEntry.txn.TxnId;

          // Smart amount logic
          const appliedAmount = sourceGroup.length > linkedGroup.length
            ? (getOpenBalanceFromLineEx(sEntry.line.LineEx) ?? sEntry.line.Amount)
            : (getOpenBalanceFromLineEx(lEntry.line.LineEx) ?? lEntry.line.Amount);

          results.push({
            PAYMENT_ID: payment.Id,
            REFERENCE_NO: payment.PaymentRefNum || payment.Id,
            NAME: payment.CustomerRef?.name || '',
            ALLOCATION_DATE: payment.TxnDate || '',
            CREDIT_NOTE_ID: sEntry.txn.TxnId,
            CREDIT_NOTE_NO: sRefNo,
            LINKED_REF_NO: lRefNo,
            LINKED_TXN_ID: lEntry.txn.TxnId,
            APPLIED_AMOUNT: appliedAmount,
            CREDIT_LINK_TYPE: sEntry.txn.TxnType,  // CreditMemo/JournalEntry/etc
            LINKED_TYPE: lEntry.txn.TxnType,  // Invoice/Purchase/Deposit/etc

          });
        }
      }
    }

    // ── Case 2: Same priority — har txn alag row ──
    else {
      for (const { line, txn } of uniqueLines) {
        const ref = await getEntityDetails(txn.TxnId, txn.TxnType);
        const refNo = getRefFromLineEx(line.LineEx) || ref?.docNumber || txn.TxnId;

        results.push({
          PAYMENT_ID: payment.Id,
          REFERENCE_NO: payment.PaymentRefNum || payment.Id,
          NAME: payment.CustomerRef?.name || '',
          ALLOCATION_DATE: payment.TxnDate || '',
          CREDIT_NOTE_ID: '',
          CREDIT_NOTE_NO: '',
          LINKED_REF_NO: refNo,
          LINKED_TXN_ID: txn.TxnId,
          APPLIED_AMOUNT: getOpenBalanceFromLineEx(line.LineEx) ?? line.Amount,
          CREDIT_LINK_TYPE: '',
          LINKED_TYPE: txn.TxnType,
          TOTAL: '',
        });
      }
    }
  }

  console.log(`✅ Final invoice allocation records: ${results.length}`);
  return results;
};



// import { qboQuery, qboClient } from './qboClient.js';

// const fetchAllRecords = async (accessToken, realmId, entity) => {
//   let allRecords = [];
//   let startPosition = 1;
//   const pageSize = 1000;
//   while (true) {
//     const query = `SELECT * FROM ${entity} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
//     const res = await qboQuery(accessToken, realmId, query);
//     const records = res?.[entity] || [];
//     allRecords = [...allRecords, ...records];
//     if (records.length < pageSize) break;
//     startPosition += pageSize;
//   }
//   return allRecords;
// };

// const getLineExValue = (lineEx, name) => {
//   try {
//     const entry = (lineEx?.any || []).find(nv => nv?.value?.Name === name);
//     const val = entry?.value?.Value;
//     return (val !== undefined && val !== null && val !== '') ? val : null;
//   } catch { return null; }
// };

// const getRefNumber   = (lineEx) => getLineExValue(lineEx, 'txnReferenceNumber');
// const getOpenBalance = (lineEx) => {
//   const val = getLineExValue(lineEx, 'txnOpenBalance');
//   return val ? parseFloat(val) : null;
// };

// const getSourceScore = (entry) => {
//   const type   = entry.txn.TxnType;
//   const refNo  = getRefNumber(entry.line.LineEx);
//   const ob     = getOpenBalance(entry.line.LineEx);
//   const amount = entry.line.Amount;

//   let score = 0;

//   const typeScore = {
//     'CreditMemo':       60,
//     'CreditCardCredit': 45,
//     'JournalEntry':     40,
//     'Deposit':          10,
//     'Check':            15,
//     'Expense':          10,
//     'Purchase':         10,
//     'Invoice':           5,
//   };
//   score += typeScore[type] ?? 5;

//   // RefNo populated = +15
//   if (refNo) score += 15;

//   // OB > Amount — sirf credit types ke liye SOURCE signal
//   const creditTypes = new Set(['CreditMemo', 'CreditCardCredit', 'JournalEntry']);
//   if (creditTypes.has(type) && ob !== null && ob > amount + 0.01) {
//     score += 40;
//   }

//   // OB = 0 → strongly LINKED
//   if (ob !== null && ob === 0) score -= 30;

//   // Deposit/CreditCardCredit + RefNo EMPTY → LINKED
//   if (!refNo && (type === 'Deposit' || type === 'CreditCardCredit')) score -= 25;

//   // Expense/Invoice/Purchase + RefNo EMPTY → LINKED
//   if (!refNo && (type === 'Expense' || type === 'Invoice' || type === 'Purchase')) score -= 20;

//   return score;
// };

// const classifyByScore = (uniqueLines) => {
//   const scored = uniqueLines.map(entry => ({
//     ...entry,
//     score: getSourceScore(entry),
//   }));

//   scored.forEach(e => {
//     console.log(`  ${e.txn.TxnType}(${e.txn.TxnId}) score=${e.score} refNo=${getRefNumber(e.line.LineEx) || 'EMPTY'} ob=${getOpenBalance(e.line.LineEx)} amt=${e.line.Amount}`);
//   });

//   scored.sort((a, b) => b.score - a.score);

//   const maxScore = scored[0].score;
//   const minScore = scored[scored.length - 1].score;

//   if (maxScore === minScore) {
//     return { sourceEntries: [], linkedEntries: [] };
//   }

//   // Sabse bada score gap = SOURCE/LINKED boundary
//   let maxGap = 0;
//   let splitIndex = 0;
//   for (let i = 0; i < scored.length - 1; i++) {
//     const gap = scored[i].score - scored[i + 1].score;
//     if (gap > maxGap) {
//       maxGap = gap;
//       splitIndex = i;
//     }
//   }

//   // Gap < 10 = ambiguous → Case 2
//   if (maxGap < 10) {
//     return { sourceEntries: [], linkedEntries: [] };
//   }

//   return {
//     sourceEntries: scored.slice(0, splitIndex + 1),
//     linkedEntries: scored.slice(splitIndex + 1),
//   };
// };

// const fetchEntityDetails = async (accessToken, realmId, txnId, txnType) => {
//   try {
//     const client = qboClient(accessToken, realmId);
//     let endpoint = '';
//     if (txnType === 'CreditMemo')        endpoint = `/creditmemo/${txnId}`;
//     else if (txnType === 'Invoice')      endpoint = `/invoice/${txnId}`;
//     else if (txnType === 'JournalEntry') endpoint = `/journalentry/${txnId}`;
//     else if (txnType === 'Deposit')      endpoint = `/deposit/${txnId}`;
//     else if (txnType === 'Purchase')     endpoint = `/purchase/${txnId}`;
//     else if (txnType === 'Check')        endpoint = `/purchase/${txnId}`;
//     else if (txnType === 'Expense')      endpoint = `/purchase/${txnId}`;
//     else return { docNumber: txnId, txnDate: '', totalAmt: '' };

//     const res = await client.get(`${endpoint}?minorversion=75`);
//     const entity = res.data?.CreditMemo
//                 || res.data?.Invoice
//                 || res.data?.JournalEntry
//                 || res.data?.Deposit
//                 || res.data?.Purchase
//                 || {};

//     let totalAmt = entity.TotalAmt || entity.TotalAmount || '';
//     if (txnType === 'JournalEntry' && !totalAmt) {
//       const jeLines = entity.Line || [];
//       totalAmt = jeLines
//         .filter(l => l.JournalEntryLineDetail?.PostingType === 'Credit')
//         .reduce((sum, l) => sum + (l.Amount || 0), 0) || '';
//     }

//     return {
//       docNumber: entity.DocNumber || txnId,
//       txnDate:   entity.TxnDate   || '',
//       totalAmt:  totalAmt,
//     };
//   } catch (err) {
//     console.log(`❌ Error fetching ${txnType} ${txnId}:`, err.message);
//     return { docNumber: txnId, txnDate: '', totalAmt: '' };
//   }
// };

// export const fetchInvoiceAllocations = async (accessToken, realmId) => {
//   const results = [];
//   const entityCache = {};

//   const getEntityDetails = async (txnId, txnType) => {
//     const key = `${txnType}_${txnId}`;
//     if (!entityCache[key]) {
//       entityCache[key] = await fetchEntityDetails(accessToken, realmId, txnId, txnType);
//     }
//     return entityCache[key];
//   };

//   const payments = await fetchAllRecords(accessToken, realmId, 'Payment');
//   console.log(`✅ Payments fetched: ${payments.length}`);

//   for (const payment of payments) {
//     const lines = payment.Line || [];

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
//     if (uniqueLines.length === 1) continue;

//     console.log(`\n=== PAYMENT ${payment.Id} (${payment.PaymentRefNum}) ===`);
//     const { sourceEntries, linkedEntries } = classifyByScore(uniqueLines);

//     if (sourceEntries.length > 0 && linkedEntries.length > 0) {
//       for (const sEntry of sourceEntries) {
//         const sRef   = await getEntityDetails(sEntry.txn.TxnId, sEntry.txn.TxnType);
//         const sRefNo = getRefNumber(sEntry.line.LineEx) || sRef?.docNumber || sEntry.txn.TxnId;

//         for (const lEntry of linkedEntries) {
//           const lRef   = await getEntityDetails(lEntry.txn.TxnId, lEntry.txn.TxnType);
//           const lRefNo = getRefNumber(lEntry.line.LineEx) || lRef?.docNumber || lEntry.txn.TxnId;

//           const appliedAmount =
//             getOpenBalance(sEntry.line.LineEx) ??
//             getOpenBalance(lEntry.line.LineEx) ??
//             sEntry.line.Amount;

//           results.push({
//             PAYMENT_ID:       payment.Id,
//             REFERENCE_NO:     payment.PaymentRefNum || payment.Id,
//             NAME:             payment.CustomerRef?.name || '',
//             ALLOCATION_DATE:  payment.TxnDate || '',
//             CREDIT_NOTE_ID:   sEntry.txn.TxnId,
//             CREDIT_NOTE_NO:   sRefNo,
//             LINKED_REF_NO:    lRefNo,
//             LINKED_TXN_ID:    lEntry.txn.TxnId,
//             APPLIED_AMOUNT:   appliedAmount,
//             CREDIT_LINK_TYPE: sEntry.txn.TxnType,
//             LINKED_TYPE:      lEntry.txn.TxnType,
//             TOTAL:            sRef?.totalAmt || '',
//           });
//         }
//       }
//     } else {
//       // Ambiguous — alag rows
//       for (const { line, txn } of uniqueLines) {
//         const ref   = await getEntityDetails(txn.TxnId, txn.TxnType);
//         const refNo = getRefNumber(line.LineEx) || ref?.docNumber || txn.TxnId;

//         results.push({
//           PAYMENT_ID:       payment.Id,
//           REFERENCE_NO:     payment.PaymentRefNum || payment.Id,
//           NAME:             payment.CustomerRef?.name || '',
//           ALLOCATION_DATE:  payment.TxnDate || '',
//           CREDIT_NOTE_ID:   '',
//           CREDIT_NOTE_NO:   '',
//           LINKED_REF_NO:    refNo,
//           LINKED_TXN_ID:    txn.TxnId,
//           APPLIED_AMOUNT:   getOpenBalance(line.LineEx) ?? line.Amount,
//           CREDIT_LINK_TYPE: '',
//           LINKED_TYPE:      txn.TxnType,
//           TOTAL:            '',
//         });
//       }
//     }
//   }

//   console.log(`\n✅ Final invoice allocation records: ${results.length}`);
//   return results;
// };