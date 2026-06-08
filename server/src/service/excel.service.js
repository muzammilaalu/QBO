// import ExcelJS from 'exceljs';

// const parseDate = (dateStr) => {
//   if (!dateStr) return '';
//   const d = new Date(dateStr);
//   return isNaN(d.getTime()) ? dateStr : d;
// };



// const INVOICE_HEADERS = [
//   { key: 'PAYMENT_ID',        header: 'Payment id',                 width: 15 },
//   { key: 'REFERENCE_NO',      header: 'Reference no',               width: 15 },
//   { key: 'NAME',              header: 'Name',                       width: 28 },
//   { key: 'ALLOCATION_DATE',   header: 'Allocation date',            width: 18 },
//   { key: 'CREDIT_NOTE_ID',    header: 'Source Txn ID',             width: 18 },
//   { key: 'CREDIT_NOTE_NO',    header: 'Source Txn No',             width: 15 },
//   { key: 'LINKED_REF_NO',     header: 'Linked Ref no',              width: 15 },
//   { key: 'LINKED_TXN_ID',     header: 'Linked txd id',              width: 15 },
//   { key: 'APPLIED_AMOUNT',    header: 'Applied Amount',             width: 15 },
//   { key: 'CREDIT_LINK_TYPE',  header: 'Source Transaction Type',    width: 22 },
//   { key: 'LINKED_TYPE',       header: 'Linked type',                width: 15 },
// ];

// // ── Bill Sheet Headers ──


// const BILL_HEADERS = [
//   { key: 'PAYMENT_ID',       header: 'Payment ID',             width: 15 },
//   { key: 'REFERENCE_NO',     header: 'Reference No',           width: 15 },
//   { key: 'NAME',             header: 'Vendor Name',            width: 28 },
//   { key: 'ALLOCATION_DATE',  header: 'Allocation Date',        width: 18 },

//   { key: 'CREDIT_NOTE_ID',   header: 'Source Txn ID',          width: 15 },
//   { key: 'CREDIT_NOTE_NO',   header: 'Source Txn No',          width: 20 },

//   { key: 'LINKED_REF_NO',    header: 'Linked Txn No',          width: 20 },
//   { key: 'LINKED_TXN_ID',    header: 'Linked Txn ID',          width: 15 },

//   { key: 'APPLIED_AMOUNT',   header: 'Applied Amount',         width: 18 },

//   { key: 'CREDIT_LINK_TYPE', header: 'Source Transaction Type', width: 25 },

//   { key: 'LINKED_TYPE',      header: 'Linked Type',        width: 20 },

// ];



// const HEADER_STYLE = {
//   font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
//   fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C5F2E' } },
//   alignment: { horizontal: 'center', vertical: 'middle' },
//   border: {
//     top:    { style: 'thin', color: { argb: 'FF000000' } },
//     bottom: { style: 'thin', color: { argb: 'FF000000' } },
//     left:   { style: 'thin', color: { argb: 'FF000000' } },
//     right:  { style: 'thin', color: { argb: 'FF000000' } },
//   },
// };

// const DATE_KEYS = [
//   'ALLOCATION_DATE',
//   'PAYMENT_DATE',
//   'TXN_DATE'
// ];
// const AMOUNT_KEYS = ['APPLIED_AMOUNT', 'TOTAL'];

// const addSheet = (workbook, sheetName, data, headers) => {
//   const ws = workbook.addWorksheet(sheetName);
//   ws.columns = headers.map(h => ({ key: h.key, width: h.width }));

//   // Header row
//   const headerRow = ws.addRow(headers.map(h => h.header));
//   headerRow.height = 28;
//   headerRow.eachCell(cell => Object.assign(cell, HEADER_STYLE));

//   // Date format
//   DATE_KEYS.forEach(key => {
//     const col = headers.findIndex(h => h.key === key) + 1;
//     if (col > 0) ws.getColumn(col).numFmt = 'yyyy-mm-dd';
//   });

//   // Data rows
//   data.forEach((record, index) => {
//     const rowData = headers.map(h => {
//       const val = record[h.key];
//       if (DATE_KEYS.includes(h.key)) return parseDate(val);
//       return val ?? '';
//     });

//     const row = ws.addRow(rowData);

//     const rowColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
//     row.eachCell((cell, colNumber) => {
//       cell.fill = {
//         type: 'pattern', pattern: 'solid',
//         fgColor: { argb: rowColor },
//       };
//       cell.border = {
//         top:    { style: 'hair', color: { argb: 'FFE5E7EB' } },
//         bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
//         left:   { style: 'hair', color: { argb: 'FFE5E7EB' } },
//         right:  { style: 'hair', color: { argb: 'FFE5E7EB' } },
//       };
//       const key = headers[colNumber - 1]?.key;
//       if (AMOUNT_KEYS.includes(key)) {
//         cell.numFmt = '#,##0.00';
//       }
//     });
//   });

//   ws.autoFilter = {
//     from: { row: 1, column: 1 },
//     to:   { row: 1, column: headers.length },
//   };
//   ws.views = [{ state: 'frozen', ySplit: 1 }];
//   return ws;
// };

// export const generateExcel = async (invoiceData, billData) => {
//   const workbook = new ExcelJS.Workbook();
//   workbook.creator = 'QBO Data Extraction Tool';
//   workbook.created = new Date();

//   addSheet(workbook, 'Invoice', invoiceData, INVOICE_HEADERS);
//   addSheet(workbook, 'Bill',    billData,    BILL_HEADERS);

//   const buffer = await workbook.xlsx.writeBuffer();
//   return buffer;
// };




import ExcelJS from 'exceljs';

const parseDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d;
};

// ── Invoice Sheet Headers ──
const INVOICE_HEADERS = [
  { key: 'PAYMENT_ID',        header: 'Payment id',                 width: 15 },
  { key: 'REFERENCE_NO',      header: 'Reference no',               width: 15 },
  { key: 'NAME',              header: 'Name',                       width: 28 },
  { key: 'ALLOCATION_DATE',   header: 'Allocation date',            width: 18 },
  { key: 'CREDIT_NOTE_ID',    header: 'Source Txn ID',              width: 18 },
  { key: 'CREDIT_NOTE_NO',    header: 'Source Txn No',              width: 15 },
  { key: 'LINKED_REF_NO',     header: 'Linked Ref no',              width: 15 },
  { key: 'LINKED_TXN_ID',     header: 'Linked txd id',              width: 15 },
  { key: 'APPLIED_AMOUNT',    header: 'Applied Amount',             width: 15 },
  { key: 'CREDIT_LINK_TYPE',  header: 'Source Transaction Type',    width: 22 },
  { key: 'LINKED_TYPE',       header: 'Linked type',                width: 15 },
];

// ── Bill Sheet Headers ──
const BILL_HEADERS = [
  { key: 'PAYMENT_ID',        header: 'Payment ID',                 width: 15 },
  { key: 'REFERENCE_NO',      header: 'Reference No',               width: 15 },
  { key: 'NAME',              header: 'Vendor Name',                width: 28 },
  { key: 'ALLOCATION_DATE',   header: 'Allocation Date',            width: 18 },
  { key: 'CREDIT_NOTE_ID',    header: 'Source Txn ID',              width: 15 },
  { key: 'CREDIT_NOTE_NO',    header: 'Source Txn No',              width: 20 },
  { key: 'LINKED_REF_NO',     header: 'Linked Txn No',              width: 20 },
  { key: 'LINKED_TXN_ID',     header: 'Linked Txn ID',              width: 15 },
  { key: 'APPLIED_AMOUNT',    header: 'Applied Amount',             width: 18 },
  { key: 'CREDIT_LINK_TYPE',  header: 'Source Transaction Type',    width: 25 },
  { key: 'LINKED_TYPE',       header: 'Linked Type',                width: 20 },
];


// ── AR Overpayment Headers ──
const AR_OVERPAYMENT_HEADERS = [
  { key: 'TXN_ID',          header: 'TXN ID',           width: 15 },
  { key: 'REFERENCE_NO',    header: 'Reference no',      width: 15 },
  { key: 'TYPE',            header: 'Type',              width: 18 },
  { key: 'DATE',            header: 'Date',              width: 15 },
  { key: 'ENTITY',          header: 'Customer',          width: 28 },
  { key: 'BANK',            header: 'Bank',              width: 20 },
  { key: 'FOREIGN_BALANCE', header: 'Unapplied Amount',   width: 18 },
  { key: 'CURRENCY',        header: 'Currency',          width: 12 },
  { key: 'EXCHANGE',        header: 'Exchange',          width: 12 },
];

// ── AP Overpayment Headers ──
const AP_OVERPAYMENT_HEADERS = [
  { key: 'TXN_ID',          header: 'TXN ID',           width: 15 },
  { key: 'REFERENCE_NO',    header: 'Reference no',      width: 15 },
  { key: 'TYPE',            header: 'Type',              width: 18 },
  { key: 'DATE',            header: 'Date',              width: 15 },
  { key: 'ENTITY',          header: 'Supplier',          width: 28 },
  { key: 'BANK',            header: 'Bank',              width: 20 },
  { key: 'OPEN_BALANCE',    header: 'Open balance',      width: 15 },
  { key: 'FOREIGN_BALANCE', header: 'Foreign balance',   width: 18 },
  { key: 'CURRENCY',        header: 'Currency',          width: 12 },
  { key: 'EXCHANGE',        header: 'Exchange',          width: 12 },
];

const HEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C5F2E' } },
  alignment: { horizontal: 'center', vertical: 'middle' },
  border: {
    top:    { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    left:   { style: 'thin', color: { argb: 'FF000000' } },
    right:  { style: 'thin', color: { argb: 'FF000000' } },
  },
};

const DATE_KEYS        = ['ALLOCATION_DATE', 'PAYMENT_DATE', 'TXN_DATE'];
const AMOUNT_KEYS      = ['APPLIED_AMOUNT', 'TOTAL'];
const OP_DATE_KEYS     = ['Date','DATE'];
const OP_AMOUNT_KEYS   = ['TotalAmount', 'UnappliedAmount','OPEN_BALANCE', 'FOREIGN_BALANCE', 'EXCHANGE'];

// ── Generic addSheet ──
const addSheet = (workbook, sheetName, data, headers, dateKeys, amountKeys) => {
  const ws = workbook.addWorksheet(sheetName);
  ws.columns = headers.map(h => ({ key: h.key, width: h.width }));

  const headerRow = ws.addRow(headers.map(h => h.header));
  headerRow.height = 28;
  headerRow.eachCell(cell => Object.assign(cell, HEADER_STYLE));

  dateKeys.forEach(key => {
    const col = headers.findIndex(h => h.key === key) + 1;
    if (col > 0) ws.getColumn(col).numFmt = 'yyyy-mm-dd';
  });

  data.forEach((record, index) => {
    const rowData = headers.map(h => {
      const val = record[h.key];
      if (dateKeys.includes(h.key)) return parseDate(val);
      return val ?? '';
    });

    const row = ws.addRow(rowData);
    const rowColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';

    row.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: rowColor },
      };
      cell.border = {
        top:    { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left:   { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right:  { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };
      const key = headers[colNumber - 1]?.key;
      if (amountKeys.includes(key)) {
        cell.numFmt = '#,##0.00';
      }
    });
  });

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: headers.length },
  };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return ws;
};

// ── Invoice + Bill Excel ──
export const generateExcel = async (invoiceData, billData) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QBO Data Extraction Tool';
  workbook.created = new Date();

  addSheet(workbook, 'Invoice', invoiceData, INVOICE_HEADERS, DATE_KEYS, AMOUNT_KEYS);
  addSheet(workbook, 'Bill',    billData,    BILL_HEADERS,    DATE_KEYS, AMOUNT_KEYS);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

// ── Overpayment Excel ──
export const generateOverpaymentExcel = async (data, type) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QBO Data Extraction Tool';
  workbook.created = new Date();

  const headers   = type === 'AP' ? AP_OVERPAYMENT_HEADERS : AR_OVERPAYMENT_HEADERS;
  const sheetName = type === 'AP' ? 'AP Overpayment'       : 'AR Overpayment';

  addSheet(workbook, sheetName, data, headers, OP_DATE_KEYS, OP_AMOUNT_KEYS);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};