import React, { useMemo, useState } from 'react';
import { FileData, AggregatedCategory } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { DollarSign, ShoppingCart, Tag, Download, Layers, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';

interface DashboardProps {
  data: FileData;
  onExport: () => void;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

type SortKey = 'amount' | 'quantity' | 'count' | 'productName';
type SortDirection = 'asc' | 'desc';

export const Dashboard: React.FC<DashboardProps> = ({ data, onExport }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'amount',
    direction: 'desc', // Default: Amount High to Low
  });

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Aggregate by Major Category for Charts
  const categoryStats = useMemo(() => {
    const stats: Record<string, AggregatedCategory> = {};
    
    data.data.forEach(item => {
      const cat = item.majorCategory || '미분류';
      if (!stats[cat]) {
        stats[cat] = { name: cat, amount: 0, quantity: 0, count: 0, share: 0 };
      }
      stats[cat].amount += item.netAmount;
      stats[cat].quantity += item.netQuantity;
      stats[cat].count += item.netCount;
    });

    return Object.values(stats)
      .map(cat => ({ ...cat, share: (cat.amount / data.totalNetAmount) * 100 }))
      .sort((a, b) => b.amount - a.amount);
  }, [data]);

  // Top Products for Charts
  const topProducts = useMemo(() => {
    return [...data.data]
      .sort((a, b) => b.netAmount - a.netAmount)
      .slice(0, 10);
  }, [data]);

  // Hierarchical Data for Table (Major -> Minor -> Products) with Sorting and Filtering
  const hierarchicalData = useMemo(() => {
    const structure: Record<string, {
      amount: number;
      quantity: number;
      count: number;
      minors: Record<string, {
        amount: number;
        quantity: number;
        count: number;
        products: typeof data.data;
      }>
    }> = {};

    data.data.forEach(item => {
      const major = item.majorCategory || '미분류';
      const minor = item.minorCategory || '기타';

      if (!structure[major]) {
        structure[major] = { amount: 0, quantity: 0, count: 0, minors: {} };
      }
      if (!structure[major].minors[minor]) {
        structure[major].minors[minor] = { amount: 0, quantity: 0, count: 0, products: [] };
      }

      structure[major].amount += item.netAmount;
      structure[major].quantity += item.netQuantity;
      structure[major].count += item.netCount;
      
      structure[major].minors[minor].amount += item.netAmount;
      structure[major].minors[minor].quantity += item.netQuantity;
      structure[major].minors[minor].count += item.netCount;
      structure[major].minors[minor].products.push(item);
    });

    // Helper to sort based on config
    const sortFn = (a: { amount: number; quantity: number, count: number, name?: string }, b: { amount: number; quantity: number, count: number, name?: string }) => {
      if (sortConfig.key === 'productName') {
        // For categories, sort by name if key is productName
        const nameA = a.name || '';
        const nameB = b.name || '';
        return sortConfig.direction === 'asc' 
          ? nameA.localeCompare(nameB, 'ko') 
          : nameB.localeCompare(nameA, 'ko');
      }
      let valA = 0; 
      let valB = 0;
      
      if (sortConfig.key === 'amount') { valA = a.amount; valB = b.amount; }
      else if (sortConfig.key === 'quantity') { valA = a.quantity; valB = b.quantity; }
      else if (sortConfig.key === 'count') { valA = a.count; valB = b.count; }

      return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    };
    
    // Helper for products
    const productSortFn = (a: typeof data.data[0], b: typeof data.data[0]) => {
      if (sortConfig.key === 'productName') {
        return sortConfig.direction === 'asc' 
          ? a.productName.localeCompare(b.productName, 'ko') 
          : b.productName.localeCompare(a.productName, 'ko');
      }
      let valA = 0; 
      let valB = 0;
      
      if (sortConfig.key === 'amount') { valA = a.netAmount; valB = b.netAmount; }
      else if (sortConfig.key === 'quantity') { valA = a.netQuantity; valB = b.netQuantity; }
      else if (sortConfig.key === 'count') { valA = a.netCount; valB = b.netCount; }

      return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    };

    // Filter by Search Term (Major Category) -> Sort Majors
    return Object.entries(structure)
      .filter(([majorKey]) => majorKey.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(([majorKey, majorData]) => ({
        name: majorKey,
        amount: majorData.amount,
        quantity: majorData.quantity,
        count: majorData.count,
        // Major Share: Major Qty / Total Qty
        share: data.totalNetQuantity > 0 ? (majorData.quantity / data.totalNetQuantity) * 100 : 0,
        // Sort Minors within Major
        minors: Object.entries(majorData.minors)
          .map(([minorKey, minorData]) => ({
            name: minorKey,
            amount: minorData.amount,
            quantity: minorData.quantity,
            count: minorData.count,
            // Minor Share: Minor Qty / Major Qty (Hierarchy)
            share: majorData.quantity > 0 ? (minorData.quantity / majorData.quantity) * 100 : 0,
            // Sort Products within Minor
            products: minorData.products
              .map(p => ({
                ...p,
                // Product Share: Product Qty / Minor Qty (Hierarchy)
                share: minorData.quantity > 0 ? (p.netQuantity / minorData.quantity) * 100 : 0
              }))
              .sort(productSortFn)
          }))
          .sort(sortFn)
      }))
      .sort(sortFn);
  }, [data, sortConfig, searchTerm]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(val);
  const formatNumber = (val: number) => new Intl.NumberFormat('ko-KR').format(val);

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (sortConfig.key !== colKey) return <ArrowUpDown className="w-4 h-4 text-slate-300 ml-1" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-indigo-600 ml-1" />
      : <ArrowDown className="w-4 h-4 text-indigo-600 ml-1" />;
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex justify-between items-center">
        {/* Search Input */}
        <div className="relative w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
            placeholder="대분류 검색 (예: 책상, 의자)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          onClick={onExport}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          <span>엑셀 다운로드</span>
        </button>
      </div>

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">총 최종금액 (환불 제외)</p>
              <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(data.totalNetAmount)}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
              <ShoppingCart size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">총 최종수량 (환불 제외)</p>
              <h3 className="text-2xl font-bold text-slate-800">{formatNumber(data.totalNetQuantity)}개</h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
              <Tag size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">분석 상품 수</p>
              <h3 className="text-2xl font-bold text-slate-800">{formatNumber(data.data.length)}개</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">카테고리별 매출 비중</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={2}
                  dataKey="amount"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {categoryStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 10 Products */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">매출 Top 10 상품</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={topProducts}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="productName" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="netAmount" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Table (Hierarchical) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">상품별 상세 성과 (대분류/소분류 합계 포함)</h3>
          <div className="text-sm text-slate-500 flex items-center">
            <Layers className="w-4 h-4 mr-1" />
            <span>
              {sortConfig.key === 'amount' ? '최종금액' : sortConfig.key === 'quantity' ? '최종수량' : sortConfig.key === 'count' ? '최종결제수' : '상품명'} 
              {' '}{sortConfig.direction === 'desc' ? '내림차순' : '오름차순'} 정렬됨
            </span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[800px] custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 sticky top-0 z-10 shadow-sm">
              <tr>
                <th 
                  className="px-6 py-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                  onClick={() => handleSort('productName')}
                >
                  <div className="flex items-center">
                    분류 / 상품명
                    <SortIcon colKey="productName" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 bg-slate-50 text-center cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                  onClick={() => handleSort('count')}
                >
                  <div className="flex items-center justify-center">
                    최종결제수
                    <SortIcon colKey="count" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 bg-slate-50 text-center cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                  onClick={() => handleSort('quantity')}
                >
                  <div className="flex items-center justify-center">
                    최종수량
                    <SortIcon colKey="quantity" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 bg-slate-50 text-center cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center justify-center">
                    최종금액
                    <SortIcon colKey="amount" />
                  </div>
                </th>
                <th className="px-6 py-4 bg-slate-50 text-center text-indigo-700">판매 비중 (수량)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hierarchicalData.length > 0 ? (
                hierarchicalData.map((major) => (
                  <React.Fragment key={major.name}>
                    {/* Major Category Header */}
                    <tr className="bg-slate-100 hover:bg-slate-200 transition-colors border-t-2 border-slate-200">
                      <td className="px-6 py-3 font-bold text-indigo-700 flex items-center">
                        <span className="bg-indigo-100 px-2 py-1 rounded mr-2 text-xs">대분류</span>
                        {major.name}
                      </td>
                      <td className="px-6 py-3 text-center font-bold text-slate-700">
                        {formatNumber(major.count)}
                      </td>
                      <td className="px-6 py-3 text-center font-bold text-slate-700">
                        {formatNumber(major.quantity)}
                      </td>
                      <td className="px-6 py-3 text-center font-bold text-slate-700">
                        {formatCurrency(major.amount)}
                      </td>
                      <td className="px-6 py-3 text-center font-bold text-indigo-700">
                         <div className="flex flex-col items-center">
                            <span>{major.share.toFixed(1)}%</span>
                            <span className="text-[10px] text-indigo-400 font-normal">(전체)</span>
                         </div>
                      </td>
                    </tr>

                    {major.minors.map((minor) => (
                      <React.Fragment key={`${major.name}-${minor.name}`}>
                        {/* Minor Category Header */}
                        <tr className="bg-slate-50 hover:bg-slate-100 transition-colors border-t border-slate-200">
                          <td className="px-6 py-2 pl-12 font-semibold text-slate-700 flex items-center">
                            <span className="bg-slate-200 px-2 py-0.5 rounded mr-2 text-[10px]">소분류</span>
                            {minor.name}
                          </td>
                          <td className="px-6 py-2 text-center font-semibold text-slate-600">
                            {formatNumber(minor.count)}
                          </td>
                          <td className="px-6 py-2 text-center font-semibold text-slate-600">
                            {formatNumber(minor.quantity)}
                          </td>
                          <td className="px-6 py-2 text-center font-semibold text-slate-600">
                            {formatCurrency(minor.amount)}
                          </td>
                          <td className="px-6 py-2 text-center text-slate-600 font-medium">
                            <div className="flex flex-col items-center">
                              <span>{minor.share.toFixed(1)}%</span>
                              <span className="text-[10px] text-slate-400 font-normal">(대분류 내)</span>
                            </div>
                          </td>
                        </tr>

                        {/* Products */}
                        {minor.products.map((product, idx) => (
                          <tr key={`${major.name}-${minor.name}-${idx}`} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-2 pl-16 text-slate-600 text-xs">
                              {product.productName}
                            </td>
                            <td className="px-6 py-2 text-center text-slate-600 text-xs">
                              {formatNumber(product.netCount)}
                              {product.refundCount > 0 && <span className="text-[10px] text-slate-400 ml-1">(-{product.refundCount})</span>}
                            </td>
                            <td className="px-6 py-2 text-center text-slate-600 text-xs">
                              {formatNumber(product.netQuantity)}
                              {product.refundQuantity > 0 && <span className="text-[10px] text-slate-400 ml-1">(-{product.refundQuantity})</span>}
                            </td>
                            <td className="px-6 py-2 text-center text-slate-600 text-xs">
                              {formatCurrency(product.netAmount)}
                              {product.refundAmount > 0 && <span className="text-[10px] text-rose-400 block">(-{formatCurrency(product.refundAmount)})</span>}
                            </td>
                            <td className="px-6 py-2 text-center text-slate-400 text-xs">
                               <div className="flex flex-col items-center">
                                  <span>{product.share?.toFixed(1)}%</span>
                                  <span className="text-[9px] text-slate-300">(소분류 내)</span>
                               </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};