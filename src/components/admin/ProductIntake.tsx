import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { identifyProduct } from '../../services/gemini';
import { uploadProductImage } from '../../services/storageService';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Upload, Loader2, CheckCircle2, AlertCircle, Sparkles, X, PlusCircle, Edit3, Trash2, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ProductCondition } from '../../types';
import { mapToStandardCategory } from '../../lib/categories';

interface ProductIntakeProps {
  onSuccess?: () => void;
}

export default function ProductIntake({ onSuccess }: ProductIntakeProps) {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [editedResult, setEditedResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (success && onSuccess) {
      const timer = setTimeout(() => {
        onSuccess();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, onSuccess]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = [...files, ...acceptedFiles].slice(0, 3);
    setFiles(newFiles);
    setPreviews(newFiles.map(f => URL.createObjectURL(f)));
    setResult(null);
    setEditedResult(null);
    setError(null);
    setSuccess(false);
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
    maxFiles: 3
  });

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    setPreviews(newFiles.map(f => URL.createObjectURL(f)));
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      console.log('Starting AI analysis...');
      const file = files[0];
      const reader = new FileReader();
      
      const analysisPromise = new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64 = (reader.result as string).split(',')[1];
            const analysis = await identifyProduct(base64);
            resolve(analysis);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const analysis: any = await analysisPromise;
      console.log('Analysis complete:', analysis);
      setResult(analysis);

      // Initialize edited result with default 40% markdown + standardized category
      const retailPrice = analysis.retailPrice || analysis.priceRange.max;
      setEditedResult({
        ...analysis,
        category: mapToStandardCategory(analysis.category || ''),
        retailPrice,
        discountPrice: Math.round(retailPrice * 0.6),
        markdownPercentage: 40,
        condition: 'New' as ProductCondition,
        stock: 1
      });
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkdownChange = (percentage: number) => {
    if (!editedResult) return;
    const discountPrice = Math.round(editedResult.retailPrice * (1 - percentage / 100));
    setEditedResult({ ...editedResult, markdownPercentage: percentage, discountPrice });
  };

  const handleRetailPriceChange = (price: number) => {
    if (!editedResult) return;
    const discountPrice = Math.round(price * (1 - editedResult.markdownPercentage / 100));
    setEditedResult({ ...editedResult, retailPrice: price, discountPrice });
  };

  const handleSave = async (status: 'pending' | 'rejected') => {
    if (!editedResult || files.length === 0 || loading) return;

    // Validate required fields
    if (!editedResult.name?.trim()) {
      setError('Product name is required');
      return;
    }
    if (!editedResult.description?.trim()) {
      setError('Description is required');
      return;
    }
    if (!editedResult.retailPrice || editedResult.retailPrice <= 0) {
      setError('Retail price is required and must be greater than 0');
      return;
    }
    if (!editedResult.stock || editedResult.stock <= 0) {
      setError('Stock must be at least 1');
      return;
    }
    if (!editedResult.category?.trim()) {
      setError('Category is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log(`Starting product save sequence with status: ${status}...`, { editedResult, filesCount: files.length });
      
      const authorUid = auth.currentUser?.uid;
      if (!authorUid) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // 1. Get a fresh doc ref
      const productDocRef = doc(collection(db, 'products'));
      const productId = productDocRef.id;
      console.log('Generated Product ID:', productId);

      // 2. Upload images
      console.log('Uploading images to storage...');
      const uploadedUrls = await Promise.all(
        files.map((file, index) => {
          console.log(`Uploading file ${index + 1}/${files.length}: ${file.name}`);
          return uploadProductImage(productId, file);
        })
      );

      if (uploadedUrls.length === 0) {
        throw new Error('Failed to upload images. Please try again.');
      }

      console.log('Images successfully uploaded:', uploadedUrls);

      // 3. Prepare final data
      const productData = {
        id: productId,
        ...editedResult,
        imageUrl: uploadedUrls[0],
        imageUrls: uploadedUrls,
        status,
        createdAt: new Date().toISOString(),
        authorUid
      };

      console.log('Final product data for Firestore:', productData);

      // 4. Save to Firestore
      await setDoc(productDocRef, productData);
      console.log('Firestore document created successfully.');
      
      // 5. Clear state and show success
      setResult(null);
      setEditedResult(null);
      setFiles([]);
      setPreviews([]);
      setSuccess(true);
    } catch (err) {
      console.error('CRITICAL SAVE ERROR:', err);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'products');
      } catch (firestoreErr: any) {
        setError(`Submission failed: ${firestoreErr.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-4 py-2.5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors';
  const labelCls = 'block text-xs font-bold text-purple-400 mb-1';
  const conditions: ProductCondition[] = ['New', 'Like New', 'Pre-owned', 'Refurbished'];

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black gradient-text">AI Product Intake</h1>
        <p className="text-purple-400 text-xs font-semibold mt-1">Upload photos — AI identifies the product, you review and approve</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: upload */}
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              'aspect-square border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-6 transition-all cursor-pointer overflow-hidden relative bg-white',
              isDragActive ? 'border-purple-400 bg-purple-50' : 'border-purple-100 hover:border-purple-300',
              previews.length > 0 && 'border-transparent p-0'
            )}
          >
            <input {...getInputProps()} />
            {previews.length > 0 ? (
              <div className="grid grid-cols-2 gap-1 w-full h-full">
                {previews.map((p, i) => (
                  <div key={i} className={cn('relative group', i === 0 && previews.length === 1 ? 'col-span-2 row-span-2' : i === 0 ? 'col-span-2' : '')}>
                    <img src={p} className="w-full h-full object-cover rounded-2xl" alt="" />
                    <button onClick={e => { e.stopPropagation(); removeFile(i); }}
                      className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {previews.length < 3 && (
                  <div className="flex items-center justify-center bg-purple-50 border-2 border-dashed border-purple-100 rounded-2xl">
                    <PlusCircle className="w-6 h-6 text-purple-300" />
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: 'linear-gradient(135deg, #FDF4FF, #EDE9FE)' }}>
                  <Camera className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-purple-400 text-center text-xs font-bold">Drag & drop photos</p>
                <p className="text-purple-300 text-xs mt-1">Up to 3 images</p>
              </>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2 text-red-600 text-xs font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          {files.length > 0 && !result && (
            <button onClick={handleAnalyze} disabled={loading}
              className="w-full py-3 rounded-2xl font-black text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? 'Analysing…' : 'Identify with AI'}
            </button>
          )}
        </div>

        {/* Right: result */}
        <div>
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 bg-green-50 rounded-3xl border border-green-100">
                <CheckCircle2 className="w-14 h-14 text-green-500 mb-4" />
                <h3 className="text-sm font-black text-green-800 mb-1">Sent to Review Queue!</h3>
                <p className="text-green-600 text-xs font-semibold mb-6">Product saved and awaiting approval.</p>
                <div className="flex flex-col gap-3 w-full">
                  <button onClick={() => onSuccess ? onSuccess() : navigate('/admin/reviews')}
                    className="w-full py-3 rounded-2xl text-sm font-black text-white hover:opacity-90 transition-all"
                    style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
                    View Review Queue
                  </button>
                  <button onClick={() => setSuccess(false)}
                    className="w-full py-3 rounded-2xl text-sm font-black text-purple-600 bg-purple-50 border-2 border-purple-100 hover:border-purple-300 transition-all">
                    Intake Another
                  </button>
                </div>
              </motion.div>
            ) : loading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border border-purple-100">
                <div className="relative w-16 h-16 mb-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 border-4 border-purple-100 border-t-purple-500 rounded-full" />
                  <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-purple-500" />
                </div>
                <p className="text-sm font-black text-purple-900">AI is thinking…</p>
                <p className="text-xs text-purple-400 font-semibold mt-1">Scanning Cape Town market trends</p>
              </motion.div>
            ) : editedResult ? (
              <motion.div key="result" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-sm">
                  {/* Confidence */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-purple-900">AI Result</span>
                    <span className={cn('px-3 py-1 rounded-full text-xs font-black border',
                      (result?.confidenceScore || 0) > 0.8
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-amber-50 border-amber-200 text-amber-700')}>
                      {Math.round((result?.confidenceScore || 0) * 100)}% confidence
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className={labelCls}>Product Name</label>
                        <input value={editedResult.name} onChange={e => setEditedResult({ ...editedResult, name: e.target.value })} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Description</label>
                        <textarea value={editedResult.description} onChange={e => setEditedResult({ ...editedResult, description: e.target.value })}
                          rows={3} className={cn(inputCls, 'resize-none')} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Retail Price (R)</label>
                          <input type="number" value={editedResult.retailPrice} onChange={e => handleRetailPriceChange(Number(e.target.value))} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Markdown %</label>
                          <input type="number" value={editedResult.markdownPercentage} onChange={e => handleMarkdownChange(Number(e.target.value))} className={inputCls} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Condition</label>
                          <select value={editedResult.condition} onChange={e => setEditedResult({ ...editedResult, condition: e.target.value as ProductCondition })} className={inputCls}>
                            {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Stock</label>
                          <input type="number" value={editedResult.stock} onChange={e => setEditedResult({ ...editedResult, stock: Number(e.target.value) })} className={inputCls} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h2 className="text-lg font-black text-purple-900">{editedResult.name}</h2>
                      <p className="text-xs text-purple-400 font-semibold leading-relaxed">{editedResult.description}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100">
                          <p className="text-[10px] font-bold text-purple-400 mb-0.5">Retail</p>
                          <p className="text-sm font-black text-purple-400 line-through">R{editedResult.retailPrice}</p>
                          <p className="text-[10px] text-pink-500 font-bold">-{editedResult.markdownPercentage}%</p>
                        </div>
                        <div className="p-3 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
                          <p className="text-[10px] font-bold opacity-80 mb-0.5">Sale Price</p>
                          <p className="text-lg font-black">R{editedResult.discountPrice}</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100">
                          <p className="text-[10px] font-bold text-purple-400 mb-0.5">Condition</p>
                          <p className="text-xs font-black text-purple-900">{editedResult.condition}</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100">
                          <p className="text-[10px] font-bold text-purple-400 mb-0.5">Stock</p>
                          <p className="text-xs font-black text-purple-900">{editedResult.stock} units</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setIsEditing(!isEditing)}
                      className="flex-1 py-2.5 rounded-2xl text-xs font-black text-purple-700 bg-purple-50 border-2 border-purple-100 hover:border-purple-300 transition-all flex items-center justify-center gap-1.5">
                      {isEditing ? <><Save className="w-3.5 h-3.5" />Done</> : <><Edit3 className="w-3.5 h-3.5" />Edit</>}
                    </button>
                    <button onClick={() => handleSave('rejected')} disabled={loading}
                      className="px-4 py-2.5 rounded-2xl text-xs font-black text-red-500 bg-red-50 border-2 border-red-100 hover:border-red-300 transition-all disabled:opacity-50 flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5" />Reject
                    </button>
                  </div>

                  <button onClick={() => handleSave('pending')} disabled={loading}
                    className="w-full mt-2 py-3 rounded-2xl text-sm font-black text-white disabled:opacity-50 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Send to Review Queue
                  </button>
                </div>
              </motion.div>
            ) : (
              <div key="empty" className="h-full flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border-2 border-dashed border-purple-100">
                <Upload className="w-10 h-10 text-purple-200 mb-3" />
                <p className="text-xs font-bold text-purple-400">Upload photos to start AI analysis</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
