export interface RawRow {
  [key: string]: any;
}

export interface ProductData {
  productName: string;
  quantity: number; // Raw paid quantity (Column H)
  refundQuantity: number; // Raw refund quantity (Column S)
  netQuantity: number; // Calculated (quantity - refundQuantity) (Column T)
  
  paymentCount: number; // Raw Payment Count (Column G - 결제수)
  refundCount: number; // Raw Refund Count (Column H - 환불건수)
  netCount: number; // Calculated (paymentCount - refundCount)

  amount: number; // Raw paid amount (Column J)
  refundAmount: number; // Raw refund amount (Column Q)
  netAmount: number; // Calculated (amount - refundAmount) (Column U)
  
  majorCategory?: string;
  minorCategory?: string;
  share?: number; // Calculated percentage of total net quantity
  raw: RawRow; // Keep original row for export
}

export interface FileData {
  fileName: string;
  data: ProductData[];
  totalAmount: number; // Total Gross Amount
  totalNetAmount: number; // Total Net Amount (Final Amount)
  totalNetQuantity: number;
  totalNetCount: number; // Total Net Transaction Count
}

export interface CategoryMapping {
  productName: string;
  major: string;
  minor: string;
}

export interface AggregatedCategory {
  name: string;
  amount: number; // This will represent Net Amount in dashboard
  quantity: number; // This represents Net Quantity
  count: number; // This represents Net Transaction Count
  share: number; // percentage 0-100
}

export enum AnalysisMode {
  SINGLE = 'SINGLE',
  COMPARE = 'COMPARE',
  NONE = 'NONE'
}