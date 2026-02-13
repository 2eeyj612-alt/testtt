import * as XLSX from 'xlsx';
import { ProductData, RawRow } from '../types';

// Codes provided by user for "600폭 책장"
const BOOKSHELF_600_CODES = [
  'DSCC065N', 'DSCC065SN', 'DSCC065SSN', 
  'DSCC066', 'DSCC066S', 'DSCC066SS',
  'DSCC465S', 'DSCC465SS', 
  'DSCC466S', 'DSCC466SS',
  'DSCAB0605', 'DSCAB0605S', 
  'DSCAB0606', 'DSCAB0606S'
];

// Codes provided by user for "보드"
const BOARD_CODES = ['DSBAB1117M', 'DSBAB0817M', 'DSBAA0817M', 'DSBAA1117M'];

// Custom logic defined by user
const applyCustomCategorization = (productName: string): { major: string, minor: string } | null => {
  // 1. Accessories Priority Check (가방걸이, 수직배선커버)
  if (productName.includes('가방걸이') || productName.includes('수직배선커버')) {
    return { major: '악세서리', minor: '기타' };
  }

  // 2. Control Logic (Priority: Accessory -> Motion Desk / Control)
  if (productName.includes('컨트롤')) {
    return { major: '모션데스크', minor: '컨트롤' };
  }

  // 3. Standing Desk Logic (Priority: Accessory -> Desk / Standing Desk)
  if (productName.includes('스탠딩데스크')) {
    return { major: '책상', minor: '스탠딩데스크' };
  }

  // 4. Deep Wood Bookshelf (Priority: Accessory -> Bookshelf / Deep Wood)
  if (productName.includes('목제깊은') || productName.includes('깊은 목제')) {
    return { major: '책장', minor: '목제깊은책장' };
  }

  // 5. 600폭 책장 Logic (Priority based on specific codes)
  const isBookshelf600 = BOOKSHELF_600_CODES.some(code => productName.includes(code));
  if (isBookshelf600) {
    const major = '600폭 책장';
    let minor = '일반형'; // Default

    if (productName.includes('깊은')) {
      minor = '깊은수납형';
    } else if (productName.includes('서랍')) {
      minor = '서랍형';
    }
    
    return { major, minor };
  }

  // 6. 보드 Logic (Specific Codes)
  const isBoard = BOARD_CODES.some(code => productName.includes(code));
  if (isBoard) {
    const major = '보드';
    let minor = '기타';

    if (productName.includes('화이트')) {
      minor = '화이트보드';
    } else if (productName.includes('목제')) {
      minor = '목제보드';
    }

    return { major, minor };
  }

  // 7. Desk Set Logic
  if (productName.includes('책상세트')) {
    const major = '책상세트';
    let minor = '기타';

    if (productName.includes('모션 멀티')) {
      minor = '모션멀티';
    } else if (productName.includes('모션 책상')) {
      minor = '모션책상세트';
    } else if (productName.includes('멀티책상') && !productName.includes('모션')) {
      minor = '멀티세트';
    } else if (productName.includes('콘센트형')) {
      minor = '콘센트형 책상세트';
    } else if (productName.includes('멀티세트')) {
       minor = '멀티세트';
    }
    
    return { major, minor };
  }

  // 8. 독서실 Logic
  if (productName.includes('800x600 독서실') || productName.includes('낮은 칸막이') || productName.includes('스터디룸')) {
    const major = '독서실';
    let minor = '기타';

    if (productName.includes('800x600 독서실')) {
      minor = '독서실책상';
    } else if (productName.includes('낮은 칸막이')) {
      minor = '낮은칸막이';
    } else if (productName.includes('스터디룸')) {
      minor = '스터디룸';
    }

    return { major, minor };
  }

  // 9. 모션데스크 Logic
  if (['프리미엄', '플러스', '포레그', '스마트', '알파'].some(keyword => productName.includes(keyword))) {
    const major = '모션데스크';
    let minor = '기타';

    if (productName.includes('프리미엄')) {
      minor = '프리미엄';
    } else if (productName.includes('플러스')) {
      minor = '플러스';
    } else if (productName.includes('테이블 포레그') || productName.includes('데스크 포레그') || productName.includes('포레그')) {
      minor = '포레그';
    } else if (productName.includes('스마트')) {
      minor = '스마트';
    } else if (productName.includes('알파')) {
      minor = '알파';
    }

    return { major, minor };
  }

  // 10. 서랍 Logic
  if (productName.includes('3단 서랍') || productName.includes('슬림서랍') || productName.includes('400폭 서랍')) {
    const major = '서랍';
    let minor = '기타';

    if (productName.includes('3단 슬림서랍')) {
      minor = '3단슬림서랍';
    } else if (productName.includes('2단 슬림서랍')) {
      minor = '2단슬림서랍';
    } else if (productName.includes('400폭 서랍')) {
      minor = '400폭서랍';
    } else if (productName.includes('3단 서랍')) {
      minor = '600폭서랍';
    }

    return { major, minor };
  }

  // 11. H형 Logic (Updated: 책상 > H형)
  if (productName.includes('h형') || productName.includes('H형')) {
    return { major: '책상', minor: 'H형' };
  }

  // 12. Chair Set Logic (Prioritized over generic Chair)
  // 대분류 의자 -> 4인, 6인 포함 시 -> 대분류 테이블 / 소분류 의자세트
  if ((productName.includes('4인') || productName.includes('6인')) && (productName.includes('의자') || productName.includes('벤치'))) {
    return { major: '테이블', minor: '의자세트' };
  }

  // 13. 벤치 Logic (New: 의자 > 벤치)
  if (productName.includes('벤치')) {
    return { major: '의자', minor: '벤치' };
  }

  // 14. 파티션/스크린 Logic (Updated: 페트 3면 added, 악세서리 filter)
  if (productName.includes('파티션') || productName.includes('스크린') || productName.includes('페트 3면')) {
    // Exception: If it contains '악세서리', move to Accessories
    if (productName.includes('악세서리')) {
      return { major: '악세서리', minor: '기타' };
    }

    const major = '파티션/스크린';
    let minor = '기타';

    if (productName.includes('라이트파티션')) {
      minor = '라이트파티션';
    } else if (productName.includes('페트 3면')) {
      minor = '페트3면';
    } else if (productName.includes('펠트')) {
      minor = '펠트';
    } else if (productName.includes('전면')) {
      minor = '목제';
    } else if (productName.includes('파티션')) {
      minor = '파티션';
    }
    
    return { major, minor };
  }

  // 15. S01 Logic
  if (productName.includes('S01')) {
    return { major: 'S01', minor: 'S01' };
  }

  // 16. 철제선반장 Logic
  if (productName.includes('철제선반장')) {
    return { major: '철제선반장', minor: '철제선반장' };
  }

  // 17. 행거 Logic
  if (productName.includes('행거')) {
    return { major: '행거', minor: '행거' };
  }

  // 18. 의자 Logic
  if (productName.includes('의자')) {
    return { major: '의자', minor: '의자' };
  }

  // 19. 모니터받침대 Logic
  if (productName.includes('받침대')) {
    const major = '모니터받침대';
    const minor = productName.includes('고속') ? '고무충' : '모니터받침대';
    return { major, minor };
  }

  // 20. 책상 Logic (Extended)
  if (['컴퓨터 책상', '멀티데스크', '멀티테이블', '베이직', '노트북', '하부가림'].some(k => productName.includes(k))) {
    const major = '책상';
    let minor = '기타';

    if (productName.includes('컴퓨터 책상')) minor = '컴퓨터책상';
    else if (productName.includes('멀티데스크')) minor = '멀티데스크';
    else if (productName.includes('멀티테이블')) minor = '멀티테이블';
    else if (productName.includes('베이직')) minor = '베이직';
    else if (productName.includes('노트북')) minor = '노트북';
    else if (productName.includes('하부가림')) minor = '하부가림';

    return { major, minor };
  }

  // 21. 책장 Logic (Generic)
  if (productName.includes('책장')) {
    if (productName.includes('액세서리')) {
      return { major: '악세서리', minor: '기타' };
    }

    const major = '책장';
    let minor = '기타';

    if (productName.includes('목제깊은') || productName.includes('깊은 목제')) {
      minor = '목제깊은책장';
    } else if (productName.includes('목제')) {
      minor = '목제';
    } else if (productName.includes('철제')) {
      minor = '철제';
    }

    return { major, minor };
  }

  // 22. 테이블 Logic (Updated)
  if (productName.includes('테이블')) {
    const major = '테이블';
    let minor = '기타';

    // Priority Set Logic: 4인/6인 + 세트
    if ((productName.includes('4인') || productName.includes('6인')) && productName.includes('세트')) {
      minor = '4/6인세트';
    } else if (productName.includes('1600x800 타원형')) {
      minor = '타원형';
    } else if (productName.includes('600폭 타원형')) {
      minor = '타원형사이드';
    } else if (productName.includes('빅테이블')) {
      minor = '빅테이블';
    } else if (productName.includes('550x550')) {
      minor = '550';
    } else if (productName.includes('식탁 세트')) {
      minor = '식탁세트';
    } else if (productName.includes('소파테이블')) {
      minor = '소파테이블';
    } else if (productName.includes('스탠딩') || productName.includes('스탠딩테이블')) {
      minor = '스탠딩';
    } else if (productName.includes('원형') || productName.includes('원형테이블')) {
      minor = '원형';
    } else if (productName.includes('4인') || productName.includes('6인')) {
      minor = '4/6인 테이블';
    } else if (productName.includes('다목적')) {
      minor = '다목적';
    }

    return { major, minor };
  }

  // 23. Fallback (나머지는 악세서리)
  return { major: '악세서리', minor: '기타' };
};

export const parseExcel = async (file: File): Promise<ProductData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<RawRow>(worksheet);

        const normalizedData: ProductData[] = jsonData.map((row) => {
          const keys = Object.keys(row);
          
          // Heuristic matching
          const nameKey = keys.find(k => /상품명|품목명|Item|Product Name/i.test(k)); // I Column
          const paidQtyKey = keys.find(k => /결제상품수량|주문수량|Qty|Quantity/i.test(k)); // H Column (In user's previous context)
          const amountKey = keys.find(k => /결제금액|매출액|판매금액|Total Amount/i.test(k)); // J Column
          
          const refundQtyKey = keys.find(k => /환불수량|반품수량|Refund Qty/i.test(k)); // S Column
          const refundAmountKey = keys.find(k => /환불금액|반품금액|Refund Amount/i.test(k)); // Q Column

          // New: Transaction/Order Count (Column G vs H as per user request)
          // Look for keys matching "결제수" (Payment Count) and "환불건수" (Refund Count)
          const paymentCountKey = keys.find(k => /결제수|주문건수|Payment Count|Order Count/i.test(k));
          const refundCountKey = keys.find(k => /환불건수|반품건수|Refund Count/i.test(k));

          const productName = nameKey ? String(row[nameKey]).trim() : 'Unknown Product';
          
          // Quantities (Item Count)
          const quantity = paidQtyKey ? (Number(row[paidQtyKey]) || 0) : 0;
          const refundQuantity = refundQtyKey ? (Number(row[refundQtyKey]) || 0) : 0;
          const netQuantity = quantity - refundQuantity;

          // Counts (Transaction Count)
          const paymentCount = paymentCountKey ? (Number(row[paymentCountKey]) || 0) : 0;
          const refundCount = refundCountKey ? (Number(row[refundCountKey]) || 0) : 0;
          const netCount = paymentCount - refundCount;

          // Amounts
          const amount = amountKey ? (Number(row[amountKey]) || 0) : 0;
          const refundAmount = refundAmountKey ? (Number(row[refundAmountKey]) || 0) : 0;
          const netAmount = amount - refundAmount;

          // Apply Custom Logic
          const customCat = applyCustomCategorization(productName);
          const majorCategory = customCat ? customCat.major : undefined;
          const minorCategory = customCat ? customCat.minor : undefined;

          return { 
            productName, 
            quantity, 
            refundQuantity,
            netQuantity, 
            paymentCount,
            refundCount,
            netCount,
            amount,
            refundAmount,
            netAmount,
            majorCategory, 
            minorCategory,
            raw: row 
          };
        }).filter(item => item.productName !== 'Unknown Product' && (item.quantity > 0 || item.amount > 0 || item.netQuantity > 0 || item.netCount > 0));

        resolve(normalizedData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};