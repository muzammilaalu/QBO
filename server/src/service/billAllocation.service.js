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

// Outstanding/Linked side types (transactions being paid)
const LINKED_TYPES = ['Bill', 'JournalEntry', 'Deposit', 'Check', 'Purchase', 'SalesReceipt', 'Charge'];

// Credit side types
const CREDIT_TYPES = ['VendorCredit'];

// Entity details fetch karo by type
const fetchEntityDetails = async (accessToken, realmId, txnId, txnType) => {
  try {
    const client = qboClient(accessToken, realmId);
    let endpoint = '';

    if (txnType === 'VendorCredit') endpoint = `/vendorcredit/${txnId}`;
    else if (txnType === 'JournalEntry') endpoint = `/journalentry/${txnId}`;
    else if (txnType === 'Deposit') endpoint = `/deposit/${txnId}`;
    else if (txnType === 'Bill') endpoint = `/bill/${txnId}`;
    else if (txnType === 'Check') endpoint = `/purchase/${txnId}`;  // ← QBO mein Check = Purchase
    else if (txnType === 'Purchase') endpoint = `/purchase/${txnId}`;
    else {
      // Unknown type — sirf ID return karo
      return { docNumber: txnId, txnDate: '', totalAmt: '' };
    }

    const res = await client.get(`${endpoint}?minorversion=75`);
    const entity = res.data?.VendorCredit
      || res.data?.JournalEntry
      || res.data?.Deposit
      || res.data?.Bill
      || res.data?.Purchase
      || {};

    let totalAmt = entity.TotalAmt || entity.TotalAmount || '';

    if (txnType === 'JournalEntry' && !totalAmt) {
      const lines = entity.Line || [];
      const creditLines = lines.filter(l =>
        l.JournalEntryLineDetail?.PostingType === 'Credit'
      );
      totalAmt = creditLines.reduce((sum, l) => sum + (l.Amount || 0), 0) || '';
    }

    return {
      docNumber: entity.DocNumber
        || (txnType === 'Deposit' ? `DEP-${txnId}` : txnId),
      txnDate: entity.TxnDate || '',
      totalAmt: totalAmt,
    };
  } catch (err) {
    console.log(`❌ Error fetching ${txnType} ${txnId}:`, err.message);
    return { docNumber: txnId, txnDate: '', totalAmt: '' };
  }
};

export const fetchBillAllocations = async (accessToken, realmId) => {
  const results = [];
  const entityCache = {};

  // ── Bill map ──
  const bills = await fetchAllRecords(accessToken, realmId, 'Bill');
  console.log(`✅ Bills fetched: ${bills.length}`);
  const billMap = {};
  for (const bill of bills) {
    billMap[bill.Id] = {
      docNumber: bill.DocNumber || bill.Id,
      txnDate: bill.TxnDate || '',
    };
  }

  // ── VendorCredit map ──
  const vendorCredits = await fetchAllRecords(accessToken, realmId, 'VendorCredit');
  console.log(`✅ VendorCredits fetched: ${vendorCredits.length}`);
  const vendorCreditMap = {};
  for (const vc of vendorCredits) {
    vendorCreditMap[vc.Id] = {
      docNumber: vc.DocNumber || vc.Id,
      txnDate: vc.TxnDate || '',
      totalAmt: vc.TotalAmt || '',
      vendorName: vc.VendorRef?.name || '',
    };
  }

  // Helper — entity details cache se lo
  const getEntityDetails = async (txnId, txnType) => {
    const key = `${txnType}_${txnId}`;
    if (!entityCache[key]) {
      // VendorCredit map mein check karo pehle
      if (txnType === 'VendorCredit' && vendorCreditMap[txnId]) {
        entityCache[key] = vendorCreditMap[txnId];
      } else {
        entityCache[key] = await fetchEntityDetails(accessToken, realmId, txnId, txnType);
      }
    }
    return entityCache[key];
  };

  // ── BillPayments ──
  const billPayments = await fetchAllRecords(accessToken, realmId, 'BillPayment');
  console.log(`✅ BillPayments fetched: ${billPayments.length}`);

  // for (const bp of billPayments) {
   
  //   const lines = bp.Line || [];

  //   lines.forEach(line => {
  //     (line.LinkedTxn || []).forEach(txn => {
  //       console.log(`BP ${bp.Id} → TxnType: ${txn.TxnType}, TxnId: ${txn.TxnId}`);
  //     });
  //   });

  //   // Credit side — VendorCredit only
  //   const creditLines = lines.filter(l =>
  //     (l.LinkedTxn || []).some(lt => CREDIT_TYPES.includes(lt.TxnType))
  //   );

  //   // Linked/Outstanding side — Bill, JournalEntry, Deposit
  //   const linkedLines = lines.filter(l =>
  //     (l.LinkedTxn || []).some(lt => LINKED_TYPES.includes(lt.TxnType))
  //   );

  //   // Sirf credit wali payments process karo
  //   if (creditLines.length === 0) continue;

  //   for (const creditLine of creditLines) {
  //     const creditTxn = (creditLine.LinkedTxn || []).find(lt =>
  //       CREDIT_TYPES.includes(lt.TxnType)
  //     );
  //     if (!creditTxn) continue;

  //     // Credit details
  //     const creditRef = await getEntityDetails(creditTxn.TxnId, creditTxn.TxnType);
  //     const creditNo = getRefFromLineEx(creditLine.LineEx) || creditRef?.docNumber || creditTxn.TxnId;
  //     const creditDate = creditRef?.txnDate || '';
  //     const creditTotal = creditRef?.totalAmt || '';

  //     if (linkedLines.length > 0) {
  //       // Har linked entity ke saath ek row
  //       for (const linkedLine of linkedLines) {
  //         const linkedTxn = (linkedLine.LinkedTxn || []).find(lt =>
  //           LINKED_TYPES.includes(lt.TxnType)
  //         );
  //         if (!linkedTxn) continue;

  //         // Linked entity details fetch karo
  //         let linkedRef = {};
  //         if (linkedTxn.TxnType === 'Bill') {
  //           linkedRef = billMap[linkedTxn.TxnId] || {};
  //         } else {
  //           linkedRef = await getEntityDetails(linkedTxn.TxnId, linkedTxn.TxnType);
  //         }

  //         const linkedRefNo = getRefFromLineEx(linkedLine.LineEx) || linkedRef?.docNumber || linkedTxn.TxnId;
  //         const linkedDate = linkedRef?.txnDate || '';

  //         results.push({
  //           PAYMENT_ID: bp.Id,
  //           REFERENCE_NO: bp.DocNumber || bp.Id,
  //           NAME: bp.VendorRef?.name || creditRef?.vendorName || '',
  //           ALLOCATION_DATE: bp.TxnDate || '',
  //           CREDIT_NOTE_ID: creditTxn.TxnId,         // Credit side ID
  //           CREDIT_NOTE_NO: creditNo,                 // Credit side DocNumber
  //           LINKED_REF_NO: linkedRefNo,              // Linked side DocNumber (Journal #9 / Bill #8001)
  //           LINKED_TXN_ID: linkedTxn.TxnId,          // Linked side ID
  //           APPLIED_AMOUNT: getOpenBalanceFromLineEx(linkedLine.LineEx) ?? linkedLine.Amount,
  //           CREDIT_LINK_TYPE: creditTxn.TxnType,        // ← VendorCredit (credit side type)
  //           LINKED_TYPE: linkedTxn.TxnType,        // ← JournalEntry / Bill (linked side type)
  //           TOTAL: creditTotal,
  //         });
  //       }
  //     } else {
  //       // Linked nahi — standalone credit row
  //       results.push({
  //         PAYMENT_ID: bp.Id,
  //         REFERENCE_NO: bp.DocNumber || bp.Id,
  //         NAME: bp.VendorRef?.name || creditRef?.vendorName || '',
  //         ALLOCATION_DATE: bp.TxnDate || '',
  //         CREDIT_NOTE_ID: creditTxn.TxnId,
  //         CREDIT_NOTE_NO: creditNo,
  //         LINKED_REF_NO: '',
  //         LINKED_TXN_ID: '',
  //         APPLIED_AMOUNT: creditLine.Amount,
  //         CREDIT_LINK_TYPE: creditTxn.TxnType,
  //         LINKED_TYPE: '',
  //         TOTAL: creditTotal,
  //       });
  //     }
  //   }
  // }

    for (const bp of billPayments) {

    console.log(
      "=============================="
    );

    console.log(
      JSON.stringify(bp, null, 2)
    );

    const lines = bp.Line || [];

    lines.forEach(line => {
      (line.LinkedTxn || []).forEach(txn => {
        console.log(
          `BP ${bp.Id} → TxnType: ${txn.TxnType}, TxnId: ${txn.TxnId}`
        );
      });
    });

    // Credit side — VendorCredit only
    const creditLines = lines.filter(l =>
      (l.LinkedTxn || []).some(lt => CREDIT_TYPES.includes(lt.TxnType))
    );

    // Linked/Outstanding side — Bill, JournalEntry, Deposit
    const linkedLines = lines.filter(l =>
      (l.LinkedTxn || []).some(lt => LINKED_TYPES.includes(lt.TxnType))
    );

    // Sirf credit wali payments process karo
    if (creditLines.length === 0) continue;

    for (const creditLine of creditLines) {
      const creditTxn = (creditLine.LinkedTxn || []).find(lt =>
        CREDIT_TYPES.includes(lt.TxnType)
      );
      if (!creditTxn) continue;

      // Credit details
      const creditRef = await getEntityDetails(creditTxn.TxnId, creditTxn.TxnType);
      const creditNo = getRefFromLineEx(creditLine.LineEx) || creditRef?.docNumber || creditTxn.TxnId;
      const creditDate = creditRef?.txnDate || '';
      const creditTotal = creditRef?.totalAmt || '';

      if (linkedLines.length > 0) {
        // Har linked entity ke saath ek row
        for (const linkedLine of linkedLines) {
          const linkedTxn = (linkedLine.LinkedTxn || []).find(lt =>
            LINKED_TYPES.includes(lt.TxnType)
          );
          if (!linkedTxn) continue;

          // Linked entity details fetch karo
          let linkedRef = {};
          if (linkedTxn.TxnType === 'Bill') {
            linkedRef = billMap[linkedTxn.TxnId] || {};
          } else {
            linkedRef = await getEntityDetails(linkedTxn.TxnId, linkedTxn.TxnType);
          }

          const linkedRefNo = getRefFromLineEx(linkedLine.LineEx) || linkedRef?.docNumber || linkedTxn.TxnId;
          const linkedDate = linkedRef?.txnDate || '';

          results.push({
            PAYMENT_ID: bp.Id,
            REFERENCE_NO: bp.DocNumber || bp.Id,
            NAME: bp.VendorRef?.name || creditRef?.vendorName || '',
            ALLOCATION_DATE: bp.TxnDate || '',
            CREDIT_NOTE_ID: creditTxn.TxnId,         // Credit side ID
            CREDIT_NOTE_NO: creditNo,                 // Credit side DocNumber
            LINKED_REF_NO: linkedRefNo,              // Linked side DocNumber (Journal #9 / Bill #8001)
            LINKED_TXN_ID: linkedTxn.TxnId,          // Linked side ID
            APPLIED_AMOUNT: getOpenBalanceFromLineEx(linkedLine.LineEx) ?? linkedLine.Amount,
            CREDIT_LINK_TYPE: creditTxn.TxnType,        // ← VendorCredit (credit side type)
            LINKED_TYPE: linkedTxn.TxnType,        // ← JournalEntry / Bill (linked side type)
            TOTAL: creditTotal,
          });
        }
      } else {
        // Linked nahi — standalone credit row
        results.push({
          PAYMENT_ID: bp.Id,
          REFERENCE_NO: bp.DocNumber || bp.Id,
          NAME: bp.VendorRef?.name || creditRef?.vendorName || '',
          ALLOCATION_DATE: bp.TxnDate || '',
          CREDIT_NOTE_ID: creditTxn.TxnId,
          CREDIT_NOTE_NO: creditNo,
          LINKED_REF_NO: '',
          LINKED_TXN_ID: '',
          APPLIED_AMOUNT: creditLine.Amount,
          CREDIT_LINK_TYPE: creditTxn.TxnType,
          LINKED_TYPE: '',
          TOTAL: creditTotal,
        });
      }
    }
  }
  console.log(`✅ Final bill allocation records: ${results.length}`);
  return results;
};