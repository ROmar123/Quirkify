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
import { ProductCondition, Rarity } from '../../types';
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

  const conditions: ProductCondition[] = ['New', 'Like New', 'Pre-owned', 'Refurbished'];
  const rarities: Rarity[] = ['Common', 'Limited', 'Rare', 'Super Rare', 'Unique'];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-black">Product Intake</h1>
        <p className="text-zinc-500 text-sm uppercase tracking-widest font-bold">AI-powered product identification and market analysis.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div 
            {...getRootProps()} 
            className={cn(
              "aspect-square border-2 border-dashed rounded-none flex flex-col items-center justify-center p-8 transition-all cursor-pointer overflow-hidden relative",
              isDragActive ? "border-black bg-zinc-50" : "border-zinc-100 hover:border-zinc-200",
              previews.length > 0 && "border-none"
            )}
          >
            <input {...getInputProps()} />
            {previews.length > 0 ? (
              <div className="grid grid-cols-2 grid-rows-2 gap-2 w-full h-full">
                {previews.map((p, i) => (
                  <div key={i} className={cn(
                    "relative group",
                    i === 0 && previews.length === 1 ? "col-span-2 row-span-2" : 
                    i === 0 && previews.length > 1 ? "col-span-2 row-span-1" : ""
                  )}>
                    <img src={p} className="w-full h-full object-cover" alt={`Preview ${i}`} />
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="absolute top-2 right-2 p-1 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {previews.length < 3 && (
                  <div className="flex items-center justify-center bg-zinc-50 border border-zinc-100 border-dashed">
                    <PlusCircle className="w-6 h-6 text-zinc-300" />
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-zinc-50 rounded-none flex items-center justify-center mb-4 border border-zinc-100">
                  <Camera className="w-8 h-8 text-zinc-300" />
                </div>
                <p className="text-zinc-400 text-center text-[10px] font-bold uppercase tracking-widest">
                  Drag & drop product images <br />
                  <span className="text-zinc-300">Up to 3 photos</span>
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 flex items-center gap-3 text-red-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-widest">{error}</p>
            </div>
          )}

          {files.length > 0 && !result && (
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full py-4 bg-black text-white rounded-none font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? 'Analyzing...' : 'Identify Product'}
            </button>
          )}
        </div>

        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 bg-green-50 rounded-none border border-green-100"
              >
                <CheckCircle2 className="w-16 h-16 text-green-500 mb-6" />
                <h3 className="text-sm font-bold uppercase tracking-widest mb-2 text-green-800">Success!</h3>
                <p className="text-green-600 text-[10px] uppercase tracking-widest leading-relaxed mb-8">
                  Product sent to review queue and images stored safely.
                </p>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={() => {
                      if (onSuccess) {
                        onSuccess();
                      } else {
                        navigate('/admin/reviews');
                      }
                    }}
                    className="w-full py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all"
                  >
                    View Review Queue
                  </button>
                  <button
                    onClick={() => setSuccess(false)}
                    className="w-full py-3 bg-white border border-green-200 text-green-600 text-[10px] font-bold uppercase tracking-widest hover:bg-green-100 transition-all"
                  >
                    Intake Another
                  </button>
                </div>
              </motion.div>
            ) : loading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 bg-zinc-50 rounded-none border border-zinc-100"
              >
                <div className="relative w-16 h-16 mb-6">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-2 border-zinc-100 border-t-black rounded-full"
                  />
                  <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-black" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2">Aura Vision is Thinking</h3>
                <p className="text-zinc-400 text-[10px] uppercase tracking-widest leading-relaxed">Scanning Cape Town market trends...</p>
              </motion.div>
            ) : editedResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="p-8 bg-white rounded-none border border-zinc-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[8px] font-bold tracking-widest text-zinc-400 uppercase">AI Analysis Result</span>
                    <div className={cn(
                      "px-2 py-1 rounded-none text-[8px] font-bold uppercase tracking-widest border",
                      (result?.confidenceScore || 0) > 0.8 ? "bg-green-50 border-green-100 text-green-600" : "bg-yellow-50 border-yellow-100 text-yellow-600"
                    )}>
                      {Math.round((result?.confidenceScore || 0) * 100)}% CONFIDENCE
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-4 mb-8">
                      <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Product Name</label>
                        <input 
                          type="text" 
                          value={editedResult.name}
                          onChange={(e) => setEditedResult({ ...editedResult, name: e.target.value })}
                          className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold uppercase tracking-tight focus:outline-none focus:border-black"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Description</label>
                        <textarea 
                          value={editedResult.description}
                          onChange={(e) => setEditedResult({ ...editedResult, description: e.target.value })}
                          className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs leading-relaxed focus:outline-none focus:border-black h-24"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Retail Price (ZAR)</label>
                          <input 
                            type="number" 
                            value={editedResult.retailPrice}
                            onChange={(e) => handleRetailPriceChange(Number(e.target.value))}
                            className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Markdown %</label>
                          <input 
                            type="number" 
                            value={editedResult.markdownPercentage}
                            onChange={(e) => handleMarkdownChange(Number(e.target.value))}
                            className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-black"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Condition</label>
                          <select 
                            value={editedResult.condition}
                            onChange={(e) => setEditedResult({ ...editedResult, condition: e.target.value as ProductCondition })}
                            className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-black appearance-none"
                          >
                            {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Quantity</label>
                          <input 
                            type="number" 
                            value={editedResult.stock}
                            onChange={(e) => setEditedResult({ ...editedResult, stock: Number(e.target.value) })}
                            className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-black"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold mb-2 uppercase tracking-tight">{editedResult.name}</h2>
                      <p className="text-zinc-500 text-xs mb-6 leading-relaxed">{editedResult.description}</p>
                      
                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="p-4 bg-zinc-50 rounded-none border border-zinc-100">
                          <span className="text-[8px] text-zinc-400 block mb-1 uppercase tracking-widest font-bold">RETAIL PRICE</span>
                          <span className="font-bold text-sm text-zinc-400 line-through">R{editedResult.retailPrice}</span>
                          <span className="text-[8px] text-quirky ml-2">-{editedResult.markdownPercentage}%</span>
                        </div>
                        <div className="p-4 bg-black text-white rounded-none border border-black">
                          <span className="text-[8px] text-zinc-500 block mb-1 uppercase tracking-widest font-bold">QUIRKIFY PRICE</span>
                          <span className="font-bold text-sm">R{editedResult.discountPrice}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="p-4 bg-zinc-50 rounded-none border border-zinc-100">
                          <span className="text-[8px] text-zinc-400 block mb-1 uppercase tracking-widest font-bold">CONDITION</span>
                          <span className="font-bold text-xs uppercase">{editedResult.condition}</span>
                        </div>
                        <div className="p-4 bg-zinc-50 rounded-none border border-zinc-100">
                          <span className="text-[8px] text-zinc-400 block mb-1 uppercase tracking-widest font-bold">STOCK</span>
                          <span className="font-bold text-xs">{editedResult.stock} UNITS</span>
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="flex-1 py-4 bg-zinc-100 text-black rounded-none font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                      >
                        {isEditing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                        {isEditing ? 'Save Changes' : 'Edit Details'}
                      </button>
                      <button
                        onClick={() => handleSave('rejected')}
                        disabled={loading}
                        className="px-6 py-4 bg-red-50 text-red-600 rounded-none font-bold uppercase tracking-widest text-[10px] hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                    
                    <button
                      onClick={() => handleSave('pending')}
                      disabled={loading}
                      className="w-full py-4 bg-black text-white rounded-none font-bold uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                      Approve & Send to Review
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div key="empty" className="h-full flex flex-col items-center justify-center text-center p-8 border border-zinc-100 rounded-none border-dashed bg-zinc-50">
                <Upload className="w-10 h-10 text-zinc-200 mb-4" />
                <p className="text-zinc-300 text-[10px] font-bold uppercase tracking-widest">Upload image for AI analysis</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
