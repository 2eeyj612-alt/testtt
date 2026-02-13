import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, isLoading }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  const handleAnalyze = () => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-xl border border-slate-100">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">데이터 업로드</h2>
        <p className="text-slate-500">분석할 엑셀 파일(.xlsx, .xls)을 업로드하세요.</p>
        <p className="text-xs text-slate-400 mt-1">1개: 단일 분석 | 2개 이상: 비교 및 트렌드 분석</p>
      </div>

      <div
        className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          type="file"
          accept=".xlsx, .xls"
          multiple
          className="hidden"
          ref={inputRef}
          onChange={handleFileChange}
        />
        <Upload className="w-12 h-12 text-indigo-500 mb-4" />
        <p className="text-slate-600 font-medium">클릭하거나 파일을 여기로 드래그하세요</p>
        <p className="text-xs text-slate-400 mt-2">여러 파일을 한 번에 업로드 가능</p>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-6 space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <div className="flex items-center space-x-3 overflow-hidden">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                <span className="text-xs text-slate-400 flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="p-1 hover:bg-indigo-200 rounded-full transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={selectedFiles.length === 0 || isLoading}
        className={`w-full mt-8 py-3 px-6 rounded-lg font-semibold text-white transition-all shadow-md flex items-center justify-center
          ${selectedFiles.length === 0 || isLoading
            ? 'bg-slate-300 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
          }`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            AI 분석 중 ({selectedFiles.length}개 파일)...
          </>
        ) : (
          `${selectedFiles.length}개 파일 분석 시작하기`
        )}
      </button>
    </div>
  );
};