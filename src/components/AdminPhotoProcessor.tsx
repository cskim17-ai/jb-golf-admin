import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Download, CheckCircle2, Play, RotateCcw, FileImage } from 'lucide-react';
import JSZip from 'jszip';

interface ImageFile {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: number;
}

interface ProcessedResult {
  originalName: string;
  newName: string;
  type: 'thumb' | 'original';
  size: number;
  blob: Blob;
}

interface AdminPhotoProcessorProps {
  showAlert: (message: string) => void;
  showConfirm: (message: string, callback: () => void) => void;
}

export default function AdminPhotoProcessor({ showAlert }: AdminPhotoProcessorProps) {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ProcessedResult[]>([]);
  const [stats, setStats] = useState({
    originalTotal: 0,
    convertedTotal: 0,
    saved: 0,
    percentage: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 폴더 선택 핸들러
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const imageExtensions = ['jpg', 'jpeg', 'png'];
    const newImages: ImageFile[] = [];

    const fileList = Array.from(files);
    fileList.forEach((file: File, index: number) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext && imageExtensions.includes(ext)) {
        newImages.push({
          id: `img_${Date.now()}_${index}`,
          file,
          name: file.name,
          size: file.size,
          preview: URL.createObjectURL(file)
        });
      }
    });

    if (newImages.length === 0) {
      showAlert('선택한 폴더에 이미지 파일(JPG, JPEG, PNG)이 없습니다.');
      return;
    }

    setImages(newImages);
    setSelectedIds(new Set(newImages.map(img => img.id)));
    setResults([]);
    // Reset stats
    setStats({ originalTotal: 0, convertedTotal: 0, saved: 0, percentage: 0 });
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(images.map(img => img.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 이미지 변환 로직
  const processImages = async () => {
    if (selectedIds.size === 0) {
      showAlert('변환할 이미지를 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    const selectedImages = images.filter(img => selectedIds.has(img.id));
    setProgress({ current: 0, total: selectedImages.length });

    const processedResults: ProcessedResult[] = [];
    let originalTotalSize = 0;
    let convertedTotalSize = 0;

    for (let i = 0; i < selectedImages.length; i++) {
      const imgFile = selectedImages[i];
      originalTotalSize += imgFile.size;
      
      try {
        const bitmap = await createImageBitmap(imgFile.file);
        
        // 1. 썸네일 변환 (300x300 내외, 20KB 이내)
        const thumbBlob = await resizeAndConvert(bitmap, 300, 300, 0.6); // 퀄리티 조절로 용량 맞춤
        processedResults.push({
          originalName: imgFile.name,
          newName: `thumb_${imgFile.name.split('.')[0]}.webp`,
          type: 'thumb',
          size: thumbBlob.size,
          blob: thumbBlob
        });

        // 2. 원본 축소 (1200x1200px, 100KB 이내)
        const mainBlob = await resizeAndConvert(bitmap, 1200, 1200, 0.7);
        processedResults.push({
          originalName: imgFile.name,
          newName: `${imgFile.name.split('.')[0]}.webp`,
          type: 'original',
          size: mainBlob.size,
          blob: mainBlob
        });

        convertedTotalSize += thumbBlob.size + mainBlob.size;
        setProgress({ current: i + 1, total: selectedImages.length });
      } catch (err) {
        console.error(`Error processing ${imgFile.name}:`, err);
      }
    }

    setResults(processedResults);
    const saved = originalTotalSize - convertedTotalSize;
    const percentage = originalTotalSize > 0 ? (saved / originalTotalSize) * 100 : 0;
    
    setStats({
      originalTotal: originalTotalSize,
      convertedTotal: convertedTotalSize,
      saved,
      percentage
    });
    
    setIsProcessing(false);
    showAlert(`${selectedImages.length}개의 이미지 변환이 완료되었습니다.`);
  };

  const resizeAndConvert = (bitmap: ImageBitmap, maxWidth: number, maxHeight: number, quality: number): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      let width = bitmap.width;
      let height = bitmap.height;

      // 비율 유지하며 리사이징
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, width, height);
      }

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/webp', quality);
    });
  };

  // ZIP 다운로드
  const downloadZip = async () => {
    if (results.length === 0) return;

    const zip = new JSZip();
    results.forEach(res => {
      zip.file(res.newName, res.blob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted_images_${new Date().getTime()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl serif italic text-white">사진속성변경</h2>
        <div className="relative">
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFolderSelect}
            multiple
            // @ts-ignore
            webkitdirectory=""
            directory=""
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-lime text-forest px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] transition-all"
          >
            <FolderOpen size={20} />
            폴더 선택하기
          </button>
        </div>
      </div>

      {/* Info Notice Box */}
      <div className="glass p-6 rounded-[30px] border border-white/10 bg-white/5 space-y-2">
        <ul className="text-sm space-y-1.5 opacity-80 list-disc ml-5">
          <li>JPG, JPEG, PNG 파일만 선택됩니다</li>
          <li>썸네일: 300x300px, 약 10~20KB, WebP (파일명 앞에 <span className="text-lime font-bold">thumb_</span> 추가)</li>
          <li>원본 축소: 1200x1200px, 100KB 이내, WebP (파일명 유지)</li>
          <li>변환된 파일은 ZIP 압축하여 다운로드됩니다</li>
        </ul>
      </div>

      {/* Selection Area */}
      {images.length > 0 && !isProcessing && (
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <h3 className="text-xl font-bold">
              이미지 파일 ({images.length}개) — <span className="text-lime">{selectedIds.size}개 선택됨</span>
            </h3>
            <div className="flex gap-4 text-xs font-bold opacity-60">
              <button onClick={selectAll} className="hover:text-lime transition-colors">전체 선택</button>
              <button onClick={deselectAll} className="hover:text-lime transition-colors">전체 해제</button>
            </div>
          </div>

          <div className="glass p-6 rounded-[30px] border border-white/10 bg-white/5 max-h-[400px] overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((img) => (
                <div 
                  key={img.id}
                  onClick={() => toggleSelect(img.id)}
                  className={`relative aspect-[4/3] rounded-2xl overflow-hidden border-2 cursor-pointer transition-all group ${
                    selectedIds.has(img.id) ? 'border-lime' : 'border-white/10 opacity-50'
                  }`}
                >
                  <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-black/60 text-[10px] truncate">
                    <p className="font-bold">{img.name}</p>
                    <p className="opacity-60">{formatSize(img.size)}</p>
                  </div>
                  {selectedIds.has(img.id) && (
                    <div className="absolute top-2 right-2 bg-lime text-forest rounded-full p-0.5">
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={processImages}
            disabled={selectedIds.size === 0}
            className="w-full bg-lime/90 hover:bg-lime text-forest py-4 rounded-[40px] font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-40"
          >
            <Play size={20} />
            선택한 {selectedIds.size}개 이미지 변환 시작
          </button>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="glass p-12 rounded-[40px] border border-white/10 bg-white/5 text-center space-y-6">
          <div className="w-24 h-24 border-4 border-lime/20 border-t-lime rounded-full animate-spin mx-auto" />
          <div className="space-y-2">
            <p className="text-2xl font-bold">이미지 변환 중...</p>
            <p className="opacity-60">{progress.current} / {progress.total} 진행 중</p>
          </div>
          <div className="w-full max-w-md mx-auto bg-white/10 rounded-full h-2 overflow-hidden">
            <motion.div 
              className="bg-lime h-full"
              initial={{ width: 0 }}
              animate={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Conversion Results Summary */}
      {results.length > 0 && !isProcessing && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass p-6 rounded-[30px] border border-white/10 bg-white/5 text-center">
              <p className="text-[10px] tracking-widest uppercase opacity-40 font-bold mb-1">원본 총 용량</p>
              <p className="text-2xl font-bold">{formatSize(stats.originalTotal)}</p>
            </div>
            <div className="glass p-6 rounded-[30px] border border-white/10 bg-white/5 text-center">
              <p className="text-[10px] tracking-widest uppercase opacity-40 font-bold mb-1">변환 후 총 용량</p>
              <p className="text-2xl font-bold">{formatSize(stats.convertedTotal)}</p>
            </div>
            <div className="glass p-6 rounded-[30px] border border-white/10 bg-white/5 text-center">
              <p className="text-[10px] tracking-widest uppercase opacity-40 font-bold mb-1">절약된 용량</p>
              <p className="text-2xl font-bold text-lime">{formatSize(stats.saved)}</p>
            </div>
            <div className="glass p-6 rounded-[30px] border border-white/10 bg-lime/10 text-center">
              <p className="text-[10px] tracking-widest uppercase opacity-40 font-bold mb-1">절약률</p>
              <p className="text-4xl font-bold text-lime">{Math.round(stats.percentage)}%</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">변환 결과 ({results.length}개 파일)</h3>
              <button 
                onClick={downloadZip}
                className="bg-lime text-forest px-6 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(163,230,53,0.3)] transition-all"
              >
                <Download size={18} />
                ZIP으로 다운로드
              </button>
            </div>

            <div className="glass rounded-[30px] border border-white/10 overflow-hidden divide-y divide-white/5">
              {results.slice(0, 50).map((res, i) => (
                <div key={i} className="flex items-center justify-between p-4 px-6 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={res.type === 'thumb' ? 'text-lime' : 'text-white/60'}>
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="flex items-center gap-2">
                       <FileImage size={16} className="opacity-40" />
                       <span className="text-sm font-medium">{res.newName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className={`text-[10px] px-2 py-1 rounded bg-white/10 font-bold ${res.type === 'thumb' ? 'text-lime/80' : 'opacity-60'}`}>
                      {res.type === 'thumb' ? '썸네일' : '원본'}
                    </span>
                    <span className="text-xs opacity-60 min-w-[60px] text-right">{formatSize(res.size)}</span>
                  </div>
                </div>
              ))}
              {results.length > 50 && (
                <div className="p-4 text-center opacity-40 text-xs italic">
                  외 {results.length - 50}개의 파일이 더 있습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clear/Reset */}
      {images.length > 0 && !isProcessing && (
        <div className="flex justify-center pt-8">
           <button 
             onClick={() => {
               setImages([]);
               setResults([]);
               setSelectedIds(new Set());
             }}
             className="text-white/40 hover:text-red-400 flex items-center gap-2 text-sm transition-all"
           >
             <RotateCcw size={16} /> 화면 초기화
           </button>
        </div>
      )}
    </motion.div>
  );
}
