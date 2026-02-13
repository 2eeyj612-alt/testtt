import React, { useMemo, useState } from 'react';
import { FileData } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ComposedChart, Line
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Minus, Download, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { exportComparisonData } from '../services/exportService';

interface ComparisonDashboardProps {
  files: FileData[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#3b82f6', '#a855f7'];

type SortKey = 'amount' | 'quantity' | 'count' | 'productName' | 'growthAmount' | 'growthQuantity';
type SortDirection = 'asc' | 'desc';

export const ComparisonDashboard: React.FC<ComparisonDashboardProps> = ({ files }) => {
  const isMulti = files.length > 2;
  const isTwoFiles = files.length === 2;
  const [searchTerm, setSearchTerm] = useState('');

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'amount',
    direction: 'desc',
  });

  // Comparison Logic for 2 files
  const twoFileStats = useMemo(() => {
    if (!isTwoFiles) return null;
    const [file1, file2] = files;
    
    const amountDelta = file2.totalNetAmount - file1.totalNetAmount;
    const amountGrowth = file1.totalNetAmount !== 0 ? (amountDelta / file1.totalNetAmount) * 100 : 0;
    
    const qtyDelta = file2.totalNetQuantity - file1.totalNetQuantity;
    const qtyGrowth = file1.totalNetQuantity !== 0 ? (qtyDelta / file1.totalNetQuantity) * 100 : 0;

    const countDelta = file2.totalNetCount - file1.totalNetCount;
    const countGrowth = file1.totalNetCount !== 0 ? (countDelta / file1.totalNetCount) * 100 : 0;

    return { amountDelta, amountGrowth, qtyDelta, qtyGrowth, countDelta, countGrowth, file1, file2 };
  }, [files, isTwoFiles]);

  // Trend Data for Multi-file
  const trendData = useMemo(() => {
    return files.map(f => ({
      name: f.fileName,
      amount: f.totalNetAmount,
      quantity: f.totalNetQuantity 
    }));
  }, [files]);

  // Category Breakdown Comparison (for Chart)
  const categoryData = useMemo(() => {
    const getCategoryMap = (data: FileData) => {
      const map: Record<string, number> = {};
      data.data.forEach(d => {
        const key = d.majorCategory || '미분류';
        map[key] = (map[key] || 0) + d.netAmount;
      });
      return map;
    };

    const maps = files.map(f => getCategoryMap(f));
    const allCats = new Set<string>();
    maps.forEach(m => Object.keys(m).forEach(k => allCats.add(k)));

    return Array.from(allCats).map(cat => {
      const row: any = { name: cat };
      let totalAmount = 0;
      files.forEach((f, idx) => {
        const val = maps[idx][cat] || 0;
        row[f.fileName] = val;
        totalAmount += val;
      });
      return { ...row, totalAmount };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [files]);

  // Detailed Hierarchical Data for Table with Filter
  const hierarchicalData = useMemo(() => {
    // Structure: Major -> Minor -> Products
    const structure: Record<string, {
      stats: number[][]; // [fileIndex][0=qty, 1=amt, 2=count]
      minors: Record<string, {
        stats: number[][];
        products: {
          name: string;
          stats: number[][];
        }[]
      }>
    }> = {};

    // Initialize structure
    files.forEach((file, fileIdx) => {
      file.data.forEach(p => {
        const major = p.majorCategory || '미분류';
        const minor = p.minorCategory || '기타';

        if (!structure[major]) {
          structure[major] = { 
            stats: files.map(() => [0, 0, 0]), 
            minors: {} 
          };
        }
        if (!structure[major].minors[minor]) {
          structure[major].minors[minor] = { 
            stats: files.map(() => [0, 0, 0]), 
            products: [] 
          };
        }

        // Add Product Stats
        let productEntry = structure[major].minors[minor].products.find(prod => prod.name === p.productName);
        if (!productEntry) {
          productEntry = { name: p.productName, stats: files.map(() => [0, 0, 0]) };
          structure[major].minors[minor].products.push(productEntry);
        }
        
        productEntry.stats[fileIdx][0] = p.netQuantity;
        productEntry.stats[fileIdx][1] = p.netAmount;
        productEntry.stats[fileIdx][2] = p.netCount;

        // Add to Minor Stats
        structure[major].minors[minor].stats[fileIdx][0] += p.netQuantity;
        structure[major].minors[minor].stats[fileIdx][1] += p.netAmount;
        structure[major].minors[minor].stats[fileIdx][2] += p.netCount;

        // Add to Major Stats
        structure[major].stats[fileIdx][0] += p.netQuantity;
        structure[major].stats[fileIdx][1] += p.netAmount;
        structure[major].stats[fileIdx][2] += p.netCount;
      });
    });

    // Helper: Calculate Sort Value
    const getSortValue = (stats: number[][]) => {
      // If sorting by growth (only valid for 2 files)
      if (isTwoFiles) {
        if (sortConfig.key === 'growthAmount') {
          return stats[1][1] - stats[0][1];
        }
        if (sortConfig.key === 'growthQuantity') {
          return stats[1][0] - stats[0][0];
        }
      }
      
      // Default: sum across all files
      let idx = 1; // amount
      if (sortConfig.key === 'quantity') idx = 0;
      if (sortConfig.key === 'count') idx = 2;
      
      return stats.reduce((sum, s) => sum + s[idx], 0);
    };

    const sortFn = (a: { stats: number[][], name?: string }, b: { stats: number[][], name?: string }) => {
      if (sortConfig.key === 'productName') {
         // Sort categories alphabetically
        const nameA = a.name || '';
        const nameB = b.name || '';
        return sortConfig.direction === 'asc' 
          ? nameA.localeCompare(nameB, 'ko') 
          : nameB.localeCompare(nameA, 'ko');
      }
      const valA = getSortValue(a.stats);
      const valB = getSortValue(b.stats);
      return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    };

    // Filter Majors by Search Term -> Sort
    const sortedMajors = Object.entries(structure)
      .filter(([key]) => key.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(([key, data]) => ({ name: key, ...data }))
      .sort(sortFn);

    return sortedMajors.map((major) => {
      // Sort Minors
      const sortedMinors = Object.entries(major.minors)
        .map(([key, data]) => ({ name: key, ...data }))
        .sort(sortFn);

      return {
        ...major,
        minors: sortedMinors.map((minor) => ({
          ...minor,
          // Sort Products
          products: minor.products.sort((a, b) => {
            if (sortConfig.key === 'productName') {
              return sortConfig.direction === 'asc' 
                ? a.name.localeCompare(b.name, 'ko') 
                : b.name.localeCompare(a.name, 'ko');
            }
            const valA = getSortValue(a.stats);
            const valB = getSortValue(b.stats);
            return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
          })
        }))
      };
    });
  }, [files, sortConfig, isTwoFiles, searchTerm]);


  const formatCurrency = (val: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(val);
  const formatNumber = (val: number) => new Intl.NumberFormat('ko-KR').format(val);
  const formatPercent = (val: number) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;

  const TrendIcon = ({ val }: { val: number }) => {
    if (val > 0) return <ArrowUpRight className="w-5 h-5 text-emerald-500" />;
    if (val < 0) return <ArrowDownRight className="w-5 h-5 text-rose-500" />;
    return <Minus className="w-5 h-5 text-slate-400" />;
  };

  const TrendText = ({ val }: { val: number }) => {
    const color = val > 0 ? 'text-emerald-600' : val < 0 ? 'text-rose-600' : 'text-slate-500';
    return <span className={`text-sm font-semibold ${color} ml-1`}>{formatPercent(val)}</span>;
  };

  // Helper to render the Growth Column Cell
  const GrowthCell = ({ stats, type, isHeader = false }: { stats?: number[][], type: 'amount' | 'quantity', isHeader?: boolean }) => {
    if (isHeader) {
      return (
        <th className="px-6 py-4 bg-slate-50 text-center border-l-2 border-slate-200">
          <div className="flex flex-col">
            <span className="text-slate-800 font-bold mb-1">{type === 'amount' ? '금액 증감' : '수량 증감'}</span>
            <div className="text-[10px] text-slate-400">{type === 'amount' ? '금액 (증감률)' : '수량 (증감률)'}</div>
          </div>
        </th>
      );
    }

    if (!stats || stats.length < 2) return null;

    const idx = type === 'amount' ? 1 : 0;
    const prev = stats[0][idx];
    const curr = stats[1][idx];
    const diff = curr - prev;
    
    // Calculate percentage: if prev is 0, consider it 100% growth if curr > 0
    let percent = 0;
    if (prev === 0) {
        percent = curr > 0 ? 100 : 0;
    } else {
        percent = (diff / prev) * 100;
    }

    const colorClass = diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-400';
    const bgClass = diff > 0 ? 'bg-emerald-50' : diff < 0 ? 'bg-rose-50' : 'bg-slate-50';

    return (
      <td className={`px-6 py-2 text-center border-l-2 border-slate-100 ${bgClass}`}>
        <div className="flex flex-col items-center justify-center">
          <span className={`text-xs font-bold ${colorClass}`}>
            {diff > 0 ? '+' : ''}{type === 'amount' ? formatCurrency(diff) : formatNumber(diff)}
          </span>
          <span className={`text-[10px] ${colorClass}`}>
            ({diff > 0 ? '+' : ''}{percent.toFixed(1)}%)
          </span>
        </div>
      </td>
    );
  };

  return (
    <div className="space-y-8">
      {/* 1. Comparison Summary (Only for 2 files) */}
      {!isMulti && twoFileStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Revenue Comparison */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendIcon val={twoFileStats.amountGrowth} />
            </div>
            <h3 className="text-slate-500 font-medium mb-4">최종금액 비교</h3>
            <div className="flex items-end justify-between mb-4">
               <div>
                  <p className="text-xs text-slate-400 mb-1">{twoFileStats.file1.fileName}</p>
                  <p className="text-lg font-semibold text-slate-600">{formatCurrency(twoFileStats.file1.totalNetAmount)}</p>
               </div>
               <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">{twoFileStats.file2.fileName}</p>
                  <p className="text-2xl font-bold text-slate-800">{formatCurrency(twoFileStats.file2.totalNetAmount)}</p>
               </div>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm text-slate-500">전월 대비 증감</span>
              <div className="flex items-center">
                 <TrendIcon val={twoFileStats.amountGrowth} />
                 <TrendText val={twoFileStats.amountGrowth} />
                 <span className="text-xs text-slate-400 ml-2">({formatCurrency(twoFileStats.amountDelta)})</span>
              </div>
            </div>
          </div>

          {/* Quantity Comparison (Net Quantity) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendIcon val={twoFileStats.qtyGrowth} />
            </div>
            <h3 className="text-slate-500 font-medium mb-4">최종수량 비교 (환불 제외)</h3>
            <div className="flex items-end justify-between mb-4">
               <div>
                  <p className="text-xs text-slate-400 mb-1">{twoFileStats.file1.fileName}</p>
                  <p className="text-lg font-semibold text-slate-600">{twoFileStats.file1.totalNetQuantity.toLocaleString()}개</p>
               </div>
               <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">{twoFileStats.file2.fileName}</p>
                  <p className="text-2xl font-bold text-slate-800">{twoFileStats.file2.totalNetQuantity.toLocaleString()}개</p>
               </div>
            </div>
             <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm text-slate-500">전월 대비 증감</span>
              <div className="flex items-center">
                 <TrendIcon val={twoFileStats.qtyGrowth} />
                 <TrendText val={twoFileStats.qtyGrowth} />
                  <span className="text-xs text-slate-400 ml-2">({twoFileStats.qtyDelta > 0 ? '+' : ''}{twoFileStats.qtyDelta})</span>
              </div>
            </div>
          </div>

          {/* Transaction Count Comparison (Net Count) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendIcon val={twoFileStats.countGrowth} />
            </div>
            <h3 className="text-slate-500 font-medium mb-4">최종결제건수 비교 (환불 제외)</h3>
            <div className="flex items-end justify-between mb-4">
               <div>
                  <p className="text-xs text-slate-400 mb-1">{twoFileStats.file1.fileName}</p>
                  <p className="text-lg font-semibold text-slate-600">{twoFileStats.file1.totalNetCount.toLocaleString()}건</p>
               </div>
               <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">{twoFileStats.file2.fileName}</p>
                  <p className="text-2xl font-bold text-slate-800">{twoFileStats.file2.totalNetCount.toLocaleString()}건</p>
               </div>
            </div>
             <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm text-slate-500">전월 대비 증감</span>
              <div className="flex items-center">
                 <TrendIcon val={twoFileStats.countGrowth} />
                 <TrendText val={twoFileStats.countGrowth} />
                  <span className="text-xs text-slate-400 ml-2">({twoFileStats.countDelta > 0 ? '+' : ''}{twoFileStats.countDelta})</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Trend Analysis (For > 2 files) */}
      {isMulti && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">전체 기간 성과 트렌드</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid stroke="#f5f5f5" vertical={false} />
                <XAxis dataKey="name" scale="point" padding={{ left: 30, right: 30 }} />
                <YAxis yAxisId="left" orientation="left" tickFormatter={(v) => `${(v/10000).toFixed(0)}만`} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                   formatter={(value: any, name: any) => [
                     name === 'amount' ? formatCurrency(value) : `${Number(value).toLocaleString()}개`,
                     name === 'amount' ? '최종금액' : '최종수량'
                   ]}
                   labelStyle={{ color: '#334155' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="amount" name="최종금액" fill="#6366f1" barSize={30} radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="quantity" name="최종수량" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3. Category Comparison Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6">카테고리별 매출 분석 (최종금액 기준)</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={categoryData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(val) => `${val / 10000}만`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              {files.map((file, index) => (
                <Bar 
                  key={file.fileName} 
                  dataKey={file.fileName} 
                  fill={COLORS[index % COLORS.length]} 
                  radius={[4, 4, 0, 0]} 
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Detailed Data Table with Totals */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
          <h3 className="text-lg font-bold text-slate-800">상품별 상세 비교 (대분류/소분류 합계)</h3>
          
          <div className="flex items-center space-x-3">
             {/* Search Input */}
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                  <Search className="h-3 w-3 text-slate-400" />
                </div>
                <input
                  type="text"
                  className="block w-40 pl-7 pr-2 py-1.5 border border-slate-300 rounded-lg text-xs leading-4 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out"
                  placeholder="대분류 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>

             <div className="h-6 w-px bg-slate-200 mx-2"></div>

             {/* Sort Controls */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
              <button
                 onClick={() => setSortConfig({ ...sortConfig, key: 'productName' })}
                 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                   sortConfig.key === 'productName' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                 }`}
               >
                 상품명순
               </button>
               <button
                 onClick={() => setSortConfig({ ...sortConfig, key: 'count' })}
                 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                   sortConfig.key === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                 }`}
               >
                 최종결제수순
               </button>
               <button
                 onClick={() => setSortConfig({ ...sortConfig, key: 'quantity' })}
                 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                   sortConfig.key === 'quantity' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                 }`}
               >
                 최종수량순
               </button>
               <button
                 onClick={() => setSortConfig({ ...sortConfig, key: 'amount' })}
                 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                   sortConfig.key === 'amount' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                 }`}
               >
                 최종금액순
               </button>
               {isTwoFiles && (
                <>
                <button
                  onClick={() => setSortConfig({ ...sortConfig, key: 'growthQuantity' })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    sortConfig.key === 'growthQuantity' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  수량증감순
                </button>
                <button
                  onClick={() => setSortConfig({ ...sortConfig, key: 'growthAmount' })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    sortConfig.key === 'growthAmount' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  금액증감순
                </button>
                </>
               )}
            </div>
             <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
               <button
                 onClick={() => setSortConfig({ ...sortConfig, direction: 'asc' })}
                 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center ${
                   sortConfig.direction === 'asc' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                 }`}
               >
                 <ArrowUp className="w-3 h-3 mr-1" /> 오름차순
               </button>
               <button
                 onClick={() => setSortConfig({ ...sortConfig, direction: 'desc' })}
                 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center ${
                   sortConfig.direction === 'desc' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                 }`}
               >
                 <ArrowDown className="w-3 h-3 mr-1" /> 내림차순
               </button>
            </div>

            <div className="h-6 w-px bg-slate-200 mx-2"></div>

            <button
              onClick={() => exportComparisonData(files)}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm"
            >
              <Download className="w-4 h-4" />
              <span>엑셀 다운로드</span>
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-[800px] custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 bg-slate-50">분류 / 상품명</th>
                {files.map((file, idx) => (
                  <th key={idx} className="px-6 py-4 bg-slate-50 text-center border-l border-slate-200">
                    <div className="flex flex-col">
                      <span className="text-slate-800 font-bold mb-1 truncate max-w-[150px] mx-auto" title={file.fileName}>
                        {file.fileName.replace(/\.[^/.]+$/, "")}
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                        <span>최종결제수</span>
                        <span>최종수량(비중)</span>
                        <span>최종금액</span>
                      </div>
                    </div>
                  </th>
                ))}
                {isTwoFiles && <GrowthCell type="quantity" isHeader />}
                {isTwoFiles && <GrowthCell type="amount" isHeader />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hierarchicalData.map((major) => (
                <React.Fragment key={major.name}>
                  {/* Major Category Total Row */}
                  <tr className="bg-slate-100 hover:bg-slate-200 transition-colors">
                    <td className="px-6 py-3 font-bold text-indigo-700 flex items-center">
                      <span className="bg-indigo-100 px-2 py-1 rounded mr-2 text-xs">대분류</span>
                      {major.name}
                    </td>
                    {major.stats.map((stat, idx) => {
                      const totalQty = files[idx].totalNetQuantity;
                      // Major Share: Major / Total
                      const share = totalQty > 0 ? (stat[0] / totalQty) * 100 : 0;
                      return (
                        <td key={idx} className="px-6 py-3 text-center border-l border-slate-200">
                          <div className="grid grid-cols-3 gap-2 font-bold text-slate-700 items-center">
                            <span className="text-slate-500">{formatNumber(stat[2])}</span>
                            <div className="flex flex-col items-center justify-center text-slate-600">
                                <span>{formatNumber(stat[0])}</span>
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] font-normal text-slate-400">({share.toFixed(1)}%)</span>
                                  <span className="text-[9px] text-indigo-300 font-normal scale-90">(전체)</span>
                                </div>
                            </div>
                            <span>{formatCurrency(stat[1])}</span>
                          </div>
                        </td>
                      );
                    })}
                    {isTwoFiles && <GrowthCell type="quantity" stats={major.stats} />}
                    {isTwoFiles && <GrowthCell type="amount" stats={major.stats} />}
                  </tr>

                  {major.minors.map((minor) => (
                    <React.Fragment key={`${major.name}-${minor.name}`}>
                      {/* Minor Category Total Row */}
                      <tr className="bg-slate-50 hover:bg-slate-100 transition-colors">
                        <td className="px-6 py-2 pl-12 font-semibold text-slate-700 flex items-center">
                           <span className="bg-slate-200 px-2 py-0.5 rounded mr-2 text-[10px]">소분류</span>
                           {minor.name}
                        </td>
                        {minor.stats.map((stat, idx) => {
                           const majorQty = major.stats[idx][0];
                           // Minor Share: Minor / Major
                           const share = majorQty > 0 ? (stat[0] / majorQty) * 100 : 0;
                           return (
                            <td key={idx} className="px-6 py-2 text-center border-l border-slate-200">
                              <div className="grid grid-cols-3 gap-2 font-semibold text-slate-600 text-xs items-center">
                                <span className="text-slate-500">{formatNumber(stat[2])}</span>
                                <div className="flex flex-col items-center justify-center">
                                    <span>{formatNumber(stat[0])}</span>
                                    <div className="flex flex-col items-center">
                                      <span className="text-[10px] font-normal text-slate-400">({share.toFixed(1)}%)</span>
                                      <span className="text-[9px] text-slate-300 font-normal scale-90">(대분류 내)</span>
                                    </div>
                                </div>
                                <span>{formatCurrency(stat[1])}</span>
                              </div>
                            </td>
                           );
                        })}
                        {isTwoFiles && <GrowthCell type="quantity" stats={minor.stats} />}
                        {isTwoFiles && <GrowthCell type="amount" stats={minor.stats} />}
                      </tr>

                      {/* Product Rows */}
                      {minor.products.map((product, pIdx) => (
                        <tr key={`${major.name}-${minor.name}-${pIdx}`} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-2 pl-16 text-slate-600 text-xs">
                            {product.name}
                          </td>
                          {product.stats.map((stat, idx) => {
                            const minorQty = minor.stats[idx][0];
                            // Product Share: Product / Minor
                            const share = minorQty > 0 ? (stat[0] / minorQty) * 100 : 0;
                            return (
                              <td key={idx} className="px-6 py-2 text-center border-l border-slate-100 group-hover:border-slate-200">
                                <div className="grid grid-cols-3 gap-2 text-xs items-center">
                                  <span className={stat[2] > 0 ? "text-slate-500" : "text-slate-300"}>
                                    {formatNumber(stat[2])}
                                  </span>
                                  <div className="flex flex-col items-center justify-center">
                                      <span className={stat[0] > 0 ? "text-slate-800" : "text-slate-300"}>
                                        {formatNumber(stat[0])}
                                      </span>
                                      {stat[0] > 0 && <span className="text-[9px] text-slate-400">({share.toFixed(1)}%)</span>}
                                  </div>
                                  <span className={stat[1] > 0 ? "text-slate-800" : "text-slate-300"}>
                                    {stat[1] > 0 ? formatCurrency(stat[1]) : '-'}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                          {isTwoFiles && <GrowthCell type="quantity" stats={product.stats} />}
                          {isTwoFiles && <GrowthCell type="amount" stats={product.stats} />}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};