import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { ComparisonDashboard } from './components/ComparisonDashboard';
import { FileData, AnalysisMode, CategoryMapping, ProductData } from './types';
import { parseExcel } from './services/excelService';
import { categorizeProductsWithAI } from './services/geminiService';
import { exportProcessedData } from './services/exportService';
import { LayoutDashboard, ArrowLeft, BrainCircuit } from 'lucide-react';

const App: React.FC = () => {
  const [analyzedData, setAnalyzedData] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AnalysisMode>(AnalysisMode.NONE);

  const handleFilesSelected = async (files: File[]) => {
    setIsLoading(true);
    setAnalyzedData([]);

    try {
      const parsedResults: FileData[] = [];
      let productsNeedingAI: string[] = [];

      // 1. Parse Excel Files
      for (const file of files) {
        const products = await parseExcel(file);
        
        // Calculate totals
        const totalNetQuantity = products.reduce((sum, item) => sum + item.netQuantity, 0);
        const totalAmount = products.reduce((sum, item) => sum + item.amount, 0);
        const totalNetAmount = products.reduce((sum, item) => sum + item.netAmount, 0);
        const totalNetCount = products.reduce((sum, item) => sum + item.netCount, 0);
        
        // Calculate Share based on Net Quantity
        const productsWithShare = products.map(p => ({
          ...p,
          share: totalNetQuantity > 0 ? (p.netQuantity / totalNetQuantity) * 100 : 0
        }));

        parsedResults.push({
          fileName: file.name,
          data: productsWithShare,
          totalAmount,
          totalNetAmount,
          totalNetQuantity,
          totalNetCount
        });

        // Collect names that didn't match custom logic
        productsWithShare.forEach(p => {
          if (!p.majorCategory) {
            productsNeedingAI.push(p.productName);
          }
        });
      }

      // 2. AI Categorization (only for unclassified items)
      const uniqueNames = Array.from(new Set(productsNeedingAI));
      let mappings: CategoryMapping[] = [];
      
      if (uniqueNames.length > 0) {
        mappings = await categorizeProductsWithAI(uniqueNames);
      }
      
      const mappingMap = new Map<string, { major: string, minor: string }>();
      mappings.forEach(m => mappingMap.set(m.productName, { major: m.major, minor: m.minor }));

      // 3. Apply Categories (Custom Logic preserved, AI applied to rest)
      const finalData: FileData[] = parsedResults.map(fileData => ({
        ...fileData,
        data: fileData.data.map(p => {
          // If already categorized by custom logic, keep it. Else use AI result.
          if (p.majorCategory) return p;

          const mapping = mappingMap.get(p.productName) || { major: '미분류', minor: '기타' };
          return { ...p, majorCategory: mapping.major, minorCategory: mapping.minor };
        })
      }));

      setAnalyzedData(finalData);
      setMode(files.length === 1 ? AnalysisMode.SINGLE : AnalysisMode.COMPARE);

    } catch (error) {
      console.error("Error processing files:", error);
      alert("파일 처리 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setAnalyzedData([]);
    setMode(AnalysisMode.NONE);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={handleReset}>
              <div className="bg-indigo-600 p-2 rounded-lg mr-3">
                <BrainCircuit className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-800">Sales Insight AI</span>
            </div>
            {mode !== AnalysisMode.NONE && (
               <div className="flex items-center">
                  <button 
                    onClick={handleReset}
                    className="flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    새로운 분석
                  </button>
               </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {mode === AnalysisMode.NONE ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="text-center mb-10 max-w-xl">
               <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                 데이터로 보는 <span className="text-indigo-600">비즈니스 인사이트</span>
               </h1>
               <p className="text-lg text-slate-600">
                 엑셀 파일을 업로드하면 <strong>책상세트 분류 규칙</strong>과 AI를 통해<br/>
                 최종수량 및 최종금액(환불 차감)을 자동 분석해드립니다.
               </p>
            </div>
            <FileUpload onFilesSelected={handleFilesSelected} isLoading={isLoading} />
          </div>
        ) : (
          <div className="animate-fade-in-up">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  {mode === AnalysisMode.SINGLE ? '월별 성과 분석 리포트' : '기간별 비교 분석 리포트'}
                </h2>
                <p className="text-slate-500 mt-1">
                  {analyzedData.map(f => f.fileName).join(' vs ')}
                </p>
              </div>
            </div>

            {mode === AnalysisMode.SINGLE && analyzedData[0] && (
              <Dashboard 
                data={analyzedData[0]} 
                onExport={() => exportProcessedData(analyzedData[0])} 
              />
            )}

            {mode === AnalysisMode.COMPARE && (
              <ComparisonDashboard files={analyzedData} />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;