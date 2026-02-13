import * as XLSX from 'xlsx';
import { FileData } from '../types';

// Helper to find column index by header name and apply percentage format
const applyPercentageFormat = (ws: XLSX.WorkSheet, headerNames: string[]) => {
  const ref = ws['!ref'];
  if (!ref) return;
  
  const range = XLSX.utils.decode_range(ref);
  const colIndices: number[] = [];

  // Find column indices
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const headerRef = XLSX.utils.encode_cell({ r: range.s.r, c: C });
    const cell = ws[headerRef];
    if (cell && headerNames.includes(cell.v)) {
      colIndices.push(C);
    }
  }

  // Apply format to data rows
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    for (const C of colIndices) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[cellRef]) {
        // Ensure the value is treated as a number
        ws[cellRef].t = 'n'; 
        // Set format to Percentage with 2 decimal places
        ws[cellRef].z = '0.00%'; 
      }
    }
  }
};

export const exportProcessedData = (fileData: FileData) => {
  // Sort the data by Major Category -> Minor Category -> Net Amount (Desc)
  const sortedData = [...fileData.data].sort((a, b) => {
    const majorCompare = (a.majorCategory || 'z').localeCompare(b.majorCategory || 'z', 'ko');
    if (majorCompare !== 0) return majorCompare;
    
    const minorCompare = (a.minorCategory || 'z').localeCompare(b.minorCategory || 'z', 'ko');
    if (minorCompare !== 0) return minorCompare;

    return b.netAmount - a.netAmount;
  });

  // Calculate hierarchical totals first
  const majorQtyMap = new Map<string, number>();
  const minorQtyMap = new Map<string, number>();

  fileData.data.forEach(item => {
    const major = item.majorCategory || '미분류';
    const minor = item.minorCategory || '기타';
    
    // Major Key: Just Name
    majorQtyMap.set(major, (majorQtyMap.get(major) || 0) + item.netQuantity);
    
    // Minor Key: Major|Minor
    const minorKey = `${major}|${minor}`;
    minorQtyMap.set(minorKey, (minorQtyMap.get(minorKey) || 0) + item.netQuantity);
  });

  // Create flatten rows
  const exportRows = sortedData.map(item => {
    const row: any = { ...item.raw };
    const major = item.majorCategory || '미분류';
    const minor = item.minorCategory || '기타';

    row['대분류'] = major;
    row['소분류'] = minor;
    row['최종결제수'] = item.netCount; // New Column
    row['최종수량'] = item.netQuantity; // T Column
    row['최종금액'] = item.netAmount;   // U Column (New)
    
    // Hierarchical Shares (Fraction 0-1)
    const totalQty = fileData.totalNetQuantity;
    const majorTotal = majorQtyMap.get(major) || 0;
    const minorTotal = minorQtyMap.get(`${major}|${minor}`) || 0;

    // 1. Major Share (Global): Major Qty / Total Qty
    row['대분류 비중(전체)'] = totalQty > 0 ? majorTotal / totalQty : 0;

    // 2. Minor Share (in Major): Minor Qty / Major Qty
    row['소분류 비중(대분류내)'] = majorTotal > 0 ? minorTotal / majorTotal : 0;

    // 3. Product Share (in Minor): Product Qty / Minor Qty
    row['상품 비중(소분류내)'] = minorTotal > 0 ? item.netQuantity / minorTotal : 0;

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  
  // Apply Percentage Format to all 3 columns
  applyPercentageFormat(worksheet, ['대분류 비중(전체)', '소분류 비중(대분류내)', '상품 비중(소분류내)']);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Analysis Result");

  const originalName = fileData.fileName.replace(/\.[^/.]+$/, "");
  const exportFileName = `${originalName}_analyzed.xlsx`;

  XLSX.writeFile(workbook, exportFileName);
};

export const exportComparisonData = (files: FileData[]) => {
  // 1. Collect all unique products and their categories
  const productMap = new Map<string, { major: string, minor: string }>();
  
  // Pre-calculate Major and Minor totals per file for share calculation
  const fileMajorQtyMaps: Map<string, number>[] = [];
  const fileMinorQtyMaps: Map<string, number>[] = [];

  files.forEach(file => {
    const majorMap = new Map<string, number>();
    const minorMap = new Map<string, number>();
    
    file.data.forEach(p => {
      // Collect product names
      if (!productMap.has(p.productName)) {
        productMap.set(p.productName, { 
          major: p.majorCategory || '미분류', 
          minor: p.minorCategory || '기타' 
        });
      }

      // Aggregate totals
      const major = p.majorCategory || '미분류';
      const minor = p.minorCategory || '기타';
      const minorKey = `${major}|${minor}`;

      majorMap.set(major, (majorMap.get(major) || 0) + p.netQuantity);
      minorMap.set(minorKey, (minorMap.get(minorKey) || 0) + p.netQuantity);
    });

    fileMajorQtyMaps.push(majorMap);
    fileMinorQtyMaps.push(minorMap);
  });

  // 2. Build rows
  const rows: any[] = [];
  const percentColumns: string[] = []; 
  
  const sortedProductNames = Array.from(productMap.keys()).sort((nameA, nameB) => {
    const catA = productMap.get(nameA)!;
    const catB = productMap.get(nameB)!;
    const majorCompare = catA.major.localeCompare(catB.major, 'ko');
    if (majorCompare !== 0) return majorCompare;
    const minorCompare = catA.minor.localeCompare(catB.minor, 'ko');
    if (minorCompare !== 0) return minorCompare;
    return nameA.localeCompare(nameB, 'ko');
  });

  const isTwoFiles = files.length === 2;

  sortedProductNames.forEach(productName => {
    const cats = productMap.get(productName)!;
    const major = cats.major;
    const minor = cats.minor;
    
    const row: any = {
      '대분류': major,
      '소분류': minor,
      '상품명': productName
    };

    let amounts: number[] = [];
    let quantities: number[] = [];
    let counts: number[] = [];

    // Add columns for each file
    files.forEach((file, idx) => {
      const product = file.data.find(p => p.productName === productName);
      const prefix = file.fileName.replace(/\.[^/.]+$/, ""); 
      
      const qty = product ? product.netQuantity : 0;
      const amt = product ? product.netAmount : 0;
      const count = product ? product.netCount : 0;

      row[`${prefix}_최종결제수`] = count;
      row[`${prefix}_최종수량`] = qty;
      row[`${prefix}_최종금액`] = amt;
      
      const totalQty = file.totalNetQuantity;
      const majorTotal = fileMajorQtyMaps[idx].get(major) || 0;
      const minorTotal = fileMinorQtyMaps[idx].get(`${major}|${minor}`) || 0;

      const majorShareCol = `${prefix}_대분류 비중(전체)`;
      row[majorShareCol] = totalQty > 0 ? majorTotal / totalQty : 0;
      if (!percentColumns.includes(majorShareCol)) percentColumns.push(majorShareCol);

      const minorShareCol = `${prefix}_소분류 비중(대분류내)`;
      row[minorShareCol] = majorTotal > 0 ? minorTotal / majorTotal : 0;
      if (!percentColumns.includes(minorShareCol)) percentColumns.push(minorShareCol);

      const prodShareCol = `${prefix}_상품 비중(소분류내)`;
      row[prodShareCol] = minorTotal > 0 ? qty / minorTotal : 0;
      if (!percentColumns.includes(prodShareCol)) percentColumns.push(prodShareCol);

      amounts.push(amt);
      quantities.push(qty);
      counts.push(count);
    });

    // If exactly 2 files, add Growth columns
    if (isTwoFiles) {
        // Payment Count Growth
        const prevCount = counts[0];
        const currCount = counts[1];
        const diffCount = currCount - prevCount;
        let percentCount = 0;
        if (prevCount === 0) {
            percentCount = currCount > 0 ? 1 : 0;
        } else {
            percentCount = diffCount / prevCount;
        }

        // Quantity Growth
        const prevQty = quantities[0];
        const currQty = quantities[1];
        const diffQty = currQty - prevQty;
        let percentQty = 0;
        if (prevQty === 0) {
            percentQty = currQty > 0 ? 1 : 0;
        } else {
            percentQty = diffQty / prevQty;
        }

        // Amount Growth
        const prevAmt = amounts[0];
        const currAmt = amounts[1];
        const diffAmt = currAmt - prevAmt;
        let percentAmt = 0;
        if (prevAmt === 0) {
            percentAmt = currAmt > 0 ? 1 : 0;
        } else {
            percentAmt = diffAmt / prevAmt;
        }

        row['결제건수 증감'] = diffCount;
        row['결제건수 증감률(%)'] = percentCount;
        row['수량 증감'] = diffQty;
        row['수량 증감률(%)'] = percentQty;
        row['금액 증감'] = diffAmt;
        row['금액 증감률(%)'] = percentAmt;

        if (!percentColumns.includes('결제건수 증감률(%)')) percentColumns.push('결제건수 증감률(%)');
        if (!percentColumns.includes('수량 증감률(%)')) percentColumns.push('수량 증감률(%)');
        if (!percentColumns.includes('금액 증감률(%)')) percentColumns.push('금액 증감률(%)');
    }

    rows.push(row);
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  applyPercentageFormat(worksheet, percentColumns);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Comparison Result");

  const exportFileName = `Comparison_Analysis_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(workbook, exportFileName);
};