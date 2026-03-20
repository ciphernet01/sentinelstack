'use client';

import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function LogUploadModal({ isOpen, onClose, onSuccess }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!files.length) return;

    setUploading(true);
    setUploadStatus({ type: 'info', message: 'Uploading files...' });

    try {
      for (const file of files) {
        await api.uploadLogs(file);
      }
      setUploadStatus({
        type: 'success',
        message: `Successfully uploaded ${files.length} file(s)`,
      });
      setFiles([]);
      onSuccess?.();
      setTimeout(() => {
        onClose();
        setUploadStatus(null);
      }, 1500);
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: error.response?.data?.detail || error.message || 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Log Files</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 rounded hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Supported Formats */}
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Supported formats: CSV, JSON, TXT, JSONL, Apache, Nginx logs
          </p>

          {/* File Upload Area */}
          <div
            className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-6 text-center hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Click to select files</p>
            <p className="text-xs text-gray-500 dark:text-slate-500">or drag and drop</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".log,.txt,.csv,.json,.jsonl"
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2 bg-gray-50 dark:bg-slate-800/50 p-3 rounded">
              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700"
                >
                  <span className="text-sm text-gray-700 dark:text-slate-300 truncate">{file.name}</span>
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Status Message */}
          {uploadStatus && (
            <div
              className={`p-3 rounded-lg flex items-start gap-2 ${
                uploadStatus.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                  : uploadStatus.type === 'error'
                  ? 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
                  : 'bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300'
              }`}
            >
              {uploadStatus.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : uploadStatus.type === 'error' ? (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <div className="w-5 h-5 border-2 border-current border-r-transparent rounded-full animate-spin" />
              )}
              <p className="text-sm">{uploadStatus.message}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!files.length || uploading}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
